import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin-aprovacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/app/admin-aprovacoes" });
  },
});
