import { Redirects } from "./Redirect.ts";
import { config } from "./Config.ts";
import { Server } from "./Server.ts";
import { VERSION } from "./version.ts";
import { Auths } from "./Auth.ts";

console.log("DENO REDIR: ", VERSION);

const redirects = new Redirects(config);
const auths = new Auths(config);

const server = new Server(redirects, auths, config);

server.start();

Deno.addSignalListener("SIGINT", async () => {
  server.stop();
  await redirects.saveRedirects();
  Deno.exit();
});
