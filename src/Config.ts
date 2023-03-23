import { parseFlags } from "../deps.ts";

class Config {
  private flags;

  constructor() {
    this.flags = parseFlags(Deno.args, {
      string: ["port"],
      default: {
        // dataDir: Deno.env.get("REDIRECT_DATA_DIR") ?? "./data",
        port: Deno.env.get("REDIRECT_PORT") ?? "8080",
      },
    });
  }

  public get dataDir(): string {
    return "./data/"; // this.flags.dataDir;
  }

  public get port(): number {
    return parseInt(this.flags.port);
  }
}

export type ConfigInterface = Config;

export const config = new Config();
