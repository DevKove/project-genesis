import { createFileRoute, redirect } from "@tanstack/react-router";

// A primeira tela do Morada360 é o acesso do usuário.
// A rota raiz encaminha para o login e mantém /auth como tela central de autenticação.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
