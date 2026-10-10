import { describe, expect, it } from "vitest";
import { buildAppUrl } from "./app-url";

describe("buildAppUrl", () => {
  it("builds callback URLs on a root deployment", () => {
    expect(buildAppUrl("/auth?redirect=%2Fapp", "https://morada.example", "/"))
      .toBe("https://morada.example/auth?redirect=%2Fapp");
  });

  it("preserves the configured base path on sub-path deployments", () => {
    expect(buildAppUrl("/auth?redirect=%2Fapp", "https://devkove.github.io", "/project-genesis/"))
      .toBe("https://devkove.github.io/project-genesis/auth?redirect=%2Fapp");
    expect(buildAppUrl("/reset-password", "https://devkove.github.io", "/project-genesis/"))
      .toBe("https://devkove.github.io/project-genesis/reset-password");
  });

  it("rejects external paths and falls back to the dashboard", () => {
    expect(buildAppUrl("https://evil.example", "https://morada.example", "/"))
      .toBe("https://morada.example/app");
    expect(buildAppUrl("//evil.example", "https://morada.example", "/"))
      .toBe("https://morada.example/app");
  });
});
