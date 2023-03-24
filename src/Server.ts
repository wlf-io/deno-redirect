import { Auths } from "./Auth.ts";
import { ConfigInterface } from "./Config.ts";
import { Redirects } from "./Redirect.ts";

const assertStringLen = (
  str: string,
  len: number,
  type = "STRING",
): str is string => {
  type = type.toUpperCase();
  if (typeof str !== "string") throw "INVALID " + type;
  if (str.length < len) throw "INVALID " + type;
  return true;
};

export class Server {
  private redirects: Redirects;
  private config: ConfigInterface;
  private auths: Auths;
  private listener: Deno.Listener | null = null;

  constructor(redirects: Redirects, auths: Auths, config: ConfigInterface) {
    this.redirects = redirects;
    this.auths = auths;
    this.config = config;
  }

  async start() {
    this.listener = Deno.listen({ port: this.config.port, transport: "tcp" });
    console.log("Listening on port: ", this.config.port);
    for await (const connection of this.listener) {
      this.serveConnection(connection);
    }
  }

  private async serveConnection(conn: Deno.Conn) {
    if (conn.remoteAddr.transport !== "tcp") {
      conn.close();
      return;
    }

    const httpConn = Deno.serveHttp(conn);
    for await (const request of httpConn) {
      const url = new URL(request.request.url);
      const path = url.pathname.split("/").filter(
        (p) => p.length,
      );
      const type = path.shift() || "";
      if (type.length < 3) {
        await request.respondWith(new Response("Bad Request", { status: 400 }));
      } else if (type == "register") {
        this.authedRequestResponse(request, async (data) => {
          if (data.type === "token") {
            const identifier = data.identifier || "";
            assertStringLen(identifier, 5, "IDENTIFIER");
            return await this.auths.addAuth(identifier);
          } else {
            const key = (data.key || "").trim().toLowerCase();
            assertStringLen(key, 3, "KEY");
            if (["ping", "register", "reload"].includes(key)) {
              throw "INVALID KEY";
            }
            const url = data.url || "";
            assertStringLen(url, 3, "URL");
            this.redirects.addRedirect(key, url);
          }
          return "done";
        });
      } else if (type == "reload") {
        this.authedRequestResponse(
          request,
          async (_data: { [k: string]: string }) => {
            await this.auths.loadAuths();
            return "done";
          },
        );
      } else if (type == "ping") {
        await request.respondWith(new Response("pong", { status: 200 }));
      } else {
        const redir = this.redirects.getRedirect(type);
        if (redir) {
          const newUrl = redir + (redir.endsWith("/") ? "" : "/") + path.join("/") + url.search;
          await request.respondWith(new Response(newUrl,{
            status: 302,
            headers: {
                Location: newUrl
            }
          }));
          console.log("Redirect ", conn.remoteAddr.hostname, type, newUrl);
        } else {
          await request.respondWith(new Response("Not Found", { status: 404 }));
        }
      }
    }
  }

  private async authedRequestResponse(
    request: Deno.RequestEvent,
    cb: (data: { [k: string]: string }) => Promise<string>,
  ): Promise<void> {
    try {
      if (request.request.method !== "POST") throw "POST METHOD ONLY";
      const data = await this.getAuthedRequestJSON(request);
      const resp = await cb(data);
      await request.respondWith(new Response(resp || "done", { status: 200 }));
    } catch (e) {
      let er = e;
      if (typeof e == "string") {
        er = new RegisterError(e);
      }
      if (!(er instanceof RegisterError)) {
        await request.respondWith(new Response("FAILURE", { status: 500 }));
      } else {
        await request.respondWith(new Response(er.message, { status: e.code }));
      }
    }
  }

  stop() {
    this.listener?.close();
  }

  private getAuthedRequestJSON = async (
    request: Deno.RequestEvent,
  ): Promise<{ [k: string]: string }> => {
    const json = await request.request.json();
    if (typeof json !== "object" || json == null || json instanceof Array) {
      throw "INVALID JSON";
    }
    const token = json.token || "";
    assertStringLen(token, 10, "TOKEN");
    if (!this.auths.isAuthed(token)) {
      throw new RegisterError("UNAUTHORIZED", 401);
    }
    return json;
  };
}

class RegisterError extends Error {
  private _code: number;
  constructor(error: string, code = 400) {
    super(error);
    this._code = code;
  }

  public get code(): number {
    return this._code;
  }
}
