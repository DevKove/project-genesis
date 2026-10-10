import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it("keeps valid internal paths and query strings", () => {
    expect(safeInternalPath("/app")).toBe("/app");
    expect(safeInternalPath("/app/nova?origem=convite")).toBe("/app/nova?origem=convite");
    expect(safeInternalPath("/app#resumo")).toBe("/app#resumo");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/app");
    expect(safeInternalPath("//evil.example/path")).toBe("/app");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/app");
  });

  it("rejects backslash and control-character variants", () => {
    expect(safeInternalPath("/\\\\evil.example")).toBe("/app");
    expect(safeInternalPath("/app\\\\..\\\\auth")).toBe("/app");
    expect(safeInternalPath("/app\nLocation: https://evil.example")).toBe("/app");
  });

  it("uses the dashboard as the fallback for missing or malformed values", () => {
    expect(safeInternalPath(undefined)).toBe("/app");
    expect(safeInternalPath("")).toBe("/app");
    expect(safeInternalPath("app")).toBe("/app");
  });
});
