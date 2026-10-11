import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeInternalPath } from "@/lib/safe-redirect";

// GitHub Pages does not support server-side route fallback. public/404.html
// forwards the requested URL to the site root with this temporary parameter.
type Search = { __ghpages_redirect?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    __ghpages_redirect:
      typeof search.__ghpages_redirect === "string"
        ? search.__ghpages_redirect
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.__ghpages_redirect) {
      const destination = safeInternalPath(search.__ghpages_redirect);
      throw redirect({ href: destination });
    }

    // A primeira tela do Morada360 é o acesso do usuário.
    // A rota raiz encaminha para o login e mantém /auth como tela central de autenticação.
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
