import { describe, expect, it } from "vitest";
import { detectSourceType, fileKey, validateFile } from "@/features/datasets/upload-utils";

function makeFile(name: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)]);
  return new File([blob], name, { type: "text/csv" });
}

describe("upload-utils", () => {
  it("detects source types from extensions", () => {
    expect(detectSourceType("data.csv")).toBe("csv");
    expect(detectSourceType("report.XLSX")).toBe("excel");
    expect(detectSourceType("dump.sql")).toBe("sql");
    expect(detectSourceType("notes.txt")).toBeNull();
  });

  it("accepts a valid CSV under the size limit", () => {
    expect(validateFile(makeFile("ok.csv", 1024))).toEqual({ ok: true });
  });

  it("rejects unsupported types", () => {
    const res = validateFile(makeFile("bad.txt", 1024));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Unsupported/);
  });

  it("rejects empty files", () => {
    expect(validateFile(makeFile("empty.csv", 0)).ok).toBe(false);
  });

  it("rejects files over 100MB", () => {
    const res = validateFile(makeFile("huge.csv", 101 * 1024 * 1024));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/100MB/);
  });

  it("builds a stable duplicate-detection key", () => {
    expect(fileKey(makeFile("a.csv", 10))).toBe(fileKey(makeFile("a.csv", 10)));
    expect(fileKey(makeFile("a.csv", 10))).not.toBe(fileKey(makeFile("a.csv", 20)));
  });
});
