import { ConfigInterface } from "./Config.ts";

const filename = "/auth.json";

export class Auths {
  private auths: { [k: string]: string } = {};
  private config: ConfigInterface;

  constructor(config: ConfigInterface) {
    this.config = config;
    this.loadRedirects();
  }

  public async addRedirect(
    key: string,
    identifier: string,
    save = true,
  ): Promise<void> {
    this.auths[this.cleanKey(key)] = identifier;
    if (save) await this.saveRedirects();
  }

  public isAuthed(key: string): boolean {
    return typeof this.auths[this.cleanKey(key)] === "string";
  }

  private cleanKey(key: string): string {
    return key.toLowerCase().trim();
  }

  public async loadRedirects(): Promise<void> {
    try {
      const raw = await Deno.readFile(this.config.dataDir + filename);
      const text = new TextDecoder().decode(raw);
      const json = JSON.parse(text);
      if (typeof json == "object" && json != null && !(json instanceof Array)) {
        this.auths = Object.assign({}, json);
        console.log("Loaded Auths");
      }
    } catch (e) {
      console.log("Failed to load auths", e);
    }
    await this.saveRedirects();
  }

  public async saveRedirects(): Promise<void> {
    try {
      await Deno.mkdir(this.config.dataDir, { recursive: true });
      await Deno.writeFile(
        this.config.dataDir + filename,
        new TextEncoder().encode(JSON.stringify(this.auths, null, 2)),
      );
      console.log("Saved Auths");
    } catch (e) {
      console.error("Failed to save auths", e);
    }
  }
}
