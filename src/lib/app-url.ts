import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * Build an absolute callback URL that respects Vite's deployment base path.
 * This supports both root-hosted deployments and sub-path deployments such as
 * GitHub Pages without allowing a caller-supplied external redirect.
 */
export function buildAppUrl(path: string, origin: string, baseUrl: string): string {
  const safePath = safeInternalPath(path).replace(/^\/+/, "");
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const appBase = new URL(normalizedBase, origin);
  return new URL(safePath, appBase).toString();
}
