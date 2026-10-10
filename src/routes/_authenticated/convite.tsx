import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Search = { token?: string };

export const Route = createFileRoute("/_authenticated/convite")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Aceitar convite — Morada360" }] }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const validToken = Boolean(token && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token));

  async function acceptInvitation() {
    if (!token || !validToken) {
      toast.error("O link do convite é inválido.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error) {
        if (error.code === "42501") {
          toast.error("O convite solicita um papel de liderança que só pode ser concedido por um administrador.");
        } else if (error.code === "28000") {
          toast.error("Este convite não corresponde à sua conta ou não pode ser aceito por ela.");
        } else if (error.code === "22023") {
          toast.error("O convite é inválido, expirou ou já foi utilizado.");
        } else {
          toast.error("Não foi possível aceitar o convite. Verifique sua conta e tente novamente.");
        }
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["memberships"] });
      toast.success("Convite aceito. Você já pode acessar a associação.");
      await navigate({ to: "/app" });
    } catch {
      toast.error("Não foi possível aceitar o convite agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></div>
        <h1 className="text-2xl font-bold">Aceitar convite</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Confirme o convite para vincular sua conta à associação. O e-mail da sua conta precisa corresponder ao destinatário do convite.</p>
        {!token || !validToken ? (
          <div role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            O link não contém um token válido. Peça ao responsável da associação para gerar um novo convite.
          </div>
        ) : (
          <div className="mt-6 rounded-lg bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div><p className="font-medium">Link de convite identificado</p><p className="mt-1 text-sm text-muted-foreground">O servidor verificará a validade, o e-mail, a expiração e as permissões de quem enviou o convite antes de conceder acesso.</p></div>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => void acceptInvitation()} disabled={loading || !validToken}>{loading ? "Verificando convite…" : "Aceitar convite"}</Button>
          <Button variant="outline" onClick={() => void navigate({ to: "/app" })}>Voltar ao painel</Button>
        </div>
      </section>
    </div>
  );
}
