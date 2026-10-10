/**
 * Validate a redirect target before passing it to the client-side router.
 * Only relative paths on the current origin are accepted.
 */
export function safeInternalPath(path?: string): string {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\\\") ||
    path.includes("\\\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return "/app";
  }

  // Parse against a fixed same-origin base and reject any origin change.
  try {
    const parsed = new URL(path, "https://morada360.invalid");
    if (parsed.origin !== "https://morada360.invalid") return "/app";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/app";
  }
}
