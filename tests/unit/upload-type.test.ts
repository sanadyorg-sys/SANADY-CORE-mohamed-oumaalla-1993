import { describe, expect, it } from "vitest";
import { fileType } from "@/lib/upload";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("fileType", () => {
  it("maps the ZIP type reported by Windows to the one the bucket accepts", () => {
    expect(fileType(file("ressources.zip", "application/x-zip-compressed"))).toBe("application/zip");
  });

  it("falls back to the extension when the browser reports no type", () => {
    expect(fileType(file("fiche.docx", ""))).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(fileType(file("Cours.PDF", "application/octet-stream"))).toBe("application/pdf");
  });

  it("keeps a correct type as is, and does not invent one for unknown files", () => {
    expect(fileType(file("video.mp4", "video/mp4"))).toBe("video/mp4");
    expect(fileType(file("film.mov", "video/quicktime"))).toBe("video/quicktime");
    expect(fileType(file("inconnu.xyz", ""))).toBe("");
  });
});
