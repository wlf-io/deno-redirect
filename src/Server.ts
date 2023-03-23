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
      const path = new URL(request.request.url).pathname.split("/").filter(
        (p) => p.length,
      );
      const type = path[0] || "";
      if (path.length < 1) {
        request.respondWith(new Response("Bad Request", { status: 400 }));
      } else if (type == "register") {
        this.authedRequestResponse(request, (data)=>{
            const key = (data.key || "").trim().toLowerCase();
            assertStringLen(key, 3, "KEY");
            if(["ping","register","reload"].includes(key)){
                return Promise.reject("INVALID KEY");
            }
            const url = data.url || "";
            assertStringLen(url, 3, "URL");
            this.redirects.addRedirect(key, url);
            return Promise.resolve("done");
        });
      } else if(type == "reload") {
        this.authedRequestResponse(request,async (_data:{[k:string]:string}) => {
            await this.auths.loadRedirects();
            return "done";
        });
      } else if(type == "ping") {
        request.respondWith(new Response("pong",{status:200}));
      } else {
        const redir = this.redirects.getRedirect(type);
        if (redir) {
          request.respondWith(Response.redirect(redir, 302));
          console.log("Redirect ", conn.remoteAddr.hostname, type, redir);
        } else {
          request.respondWith(new Response("Not Found", { status: 404 }));
        }
      }
    }
  }

  private async authedRequestResponse(request: Deno.RequestEvent, cb: (data:{[k:string]:string})=>Promise<string>) : Promise<void>{
    try {
        if (request.request.method !== "POST") throw "POST METHOD ONLY";
        const data = await this.getAuthedRequestJSON(request);
        const resp = await cb(data);
        request.respondWith(new Response(resp || "done", { status: 200 }));
      } catch (e) {
        let er = e;
        if (typeof e == "string") {
          er = new RegisterError(e);
        }
        if (!(er instanceof RegisterError)) {
          request.respondWith(new Response("FAILURE", { status: 500 }));
        } else {
          request.respondWith(new Response(er.message, { status: e.code }));
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
