import { ConfigInterface } from "./Config.ts";

const redirectFile = "redirects.json";

export class Redirects {
  private redirects: { [k: string]: string } = {};
  private config: ConfigInterface;

  constructor(config: ConfigInterface) {
    this.config = config;
    this.loadRedirects();
  }

  public async addRedirect(
    key: string,
    url: string,
    save = true,
  ): Promise<void> {
    this.redirects[this.cleanKey(key)] = url;
    if (save) await this.saveRedirects();
  }

  public getRedirect(key: string): string | null {
    return this.redirects[this.cleanKey(key)] ?? null;
  }

  private cleanKey(key: string): string {
    return key.toLowerCase().trim();
  }

  private async loadRedirects(): Promise<void> {
    try {
      const raw = await Deno.readFile(this.config.dataDir + redirectFile);
      const text = new TextDecoder().decode(raw);
      const json = JSON.parse(text);
      if (typeof json == "object" && json != null && !(json instanceof Array)) {
        this.redirects = Object.assign({}, json);
        console.log("Loaded Redirects");
      }
    } catch (e) {
      console.log(
        "Failed to load redirects",
        (e instanceof Deno.errors.NotFound) ? "" : e,
      );
    }
    await this.saveRedirects();
  }

  public async saveRedirects(): Promise<void> {
    try {
      await Deno.mkdir(this.config.dataDir, { recursive: true });
      await Deno.writeFile(
        this.config.dataDir + redirectFile,
        new TextEncoder().encode(JSON.stringify(this.redirects, null, 2)),
      );
      console.log("Saved Redirects");
    } catch (e) {
      console.error("Failed to save redirects", e);
    }
  }
}
