import { normalizeFramerProjectTarget } from "../../../../modules/integrations/providers/framer-project-url";

const ID = "AbCdEfGhIjKlMnOpQrSt";

describe("normalizeFramerProjectTarget", () => {
  it("accepts a raw 20-character project id", () => {
    expect(normalizeFramerProjectTarget(ID)).toBe(ID);
  });

  it("extracts the id from an editor URL", () => {
    expect(normalizeFramerProjectTarget(`https://framer.com/projects/My-Site--${ID}`)).toBe(ID);
  });

  it("strips query, hash, and trailing path", () => {
    expect(normalizeFramerProjectTarget(`https://www.framer.com/projects/My-Site--${ID}/canvas?node=1#x`)).toBe(ID);
  });

  it("accepts a URL without protocol", () => {
    expect(normalizeFramerProjectTarget(`framer.com/projects/My-Site--${ID}`)).toBe(ID);
  });

  it("strips the editor suffix after the 20-character id", () => {
    expect(normalizeFramerProjectTarget("https://framer.com/projects/Alive-Eyes--ciftteW00GGfesoI7YBa-g4orW")).toBe(
      "ciftteW00GGfesoI7YBa"
    );
  });

  it("rejects published site URLs", () => {
    expect(() => normalizeFramerProjectTarget("https://mysite.framer.app")).toThrow(/editor address bar/);
  });
});
