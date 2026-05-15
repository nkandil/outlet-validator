import { describe, expect, it } from "vitest";
import { parseOutletFile } from "./file";

describe("file parsing", () => {
  it("preserves Arabic text from UTF-8 CSV files", async () => {
    const csvBytes = new TextEncoder().encode("id,lat,lng,name\n1,30,31,كوكا كولا\n");
    const file = {
      name: "arabic.csv",
      arrayBuffer: async () => csvBytes.buffer
    } as File;

    const parsed = await parseOutletFile(file);

    expect(parsed.rows[0].name).toBe("كوكا كولا");
  });

  it("preserves Arabic text from Windows-1256 CSV files", async () => {
    const csvBytes = new Uint8Array([
      ...new TextEncoder().encode("id,lat,lng,name\n1,30,31,"),
      0xdf,
      0xe6,
      0xdf,
      0xc7,
      0x20,
      0xdf,
      0xe6,
      0xe1,
      0xc7,
      0x0a
    ]);
    const file = {
      name: "arabic.csv",
      arrayBuffer: async () => csvBytes.buffer
    } as File;

    const parsed = await parseOutletFile(file);

    expect(parsed.rows[0].name).toBe("كوكا كولا");
  });
});
