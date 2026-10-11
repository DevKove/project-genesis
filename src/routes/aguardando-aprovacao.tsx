import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock3, ShieldCheck, ShieldX } from "lucide-react";

export const Route = createFileRoute("/aguardando-aprovacao")({
  head: () => ({ meta: [{ title: "Aguardando aprovação — Morada360" }] }),
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "pending" | "approved" | "rejected" | "unavailable">("loading");
  const [requestingAgain, setRequestingAgain] = useState(false);

  const checkStatus = useCallback(async () => {
    setStatus("loading");
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setStatus("unavailable");
        return;
      }
      const { data, error } = await supabase.from("profiles").select("account_status").eq("id", userData.user.id).maybeSingle();
      if (error || !data) {
        setStatus("unavailable");
        return;
      }
      setStatus(data.account_status);
      if (data.account_status === "approved") {
        void navigate({ to: "/app" });
      }
    } catch {
      setStatus("unavailable");
    }
  }, [navigate]);

  useEffect(() => { void checkStatus(); }, [checkStatus]);

  async function requestAgain() {
    setRequestingAgain(true);
    try {
      const { error } = await supabase.rpc("request_account_reapproval");
      if (error) {
        toast.error("Não foi possível reenviar a solicitação. Tente novamente ou entre em contato com o suporte.");
        return;
      }
      setStatus("pending");
      toast.success("Solicitação reenviada. O administrador poderá analisar seu cadastro novamente.");
    } catch {
      toast.error("Não foi possível reenviar a solicitação. Verifique sua conexão e tente novamente.");
    } finally {
      setRequestingAgain(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  }

  const content = {
    loading: { icon: Clock3, title: "Verificando seu cadastro", message: "Estamos consultando o estado da sua solicitação." },
    pending: { icon: Clock3, title: "Cadastro aguardando aprovação", message: "Sua conta foi criada, mas o acesso permanece bloqueado até a análise do administrador. Você poderá entrar assim que seu cadastro for aprovado." },
    approved: { icon: ShieldCheck, title: "Cadastro aprovado", message: "Seu acesso foi liberado. Redirecionando para o sistema." },
    rejected: { icon: ShieldX, title: "Acesso não autorizado", message: "O administrador não aprovou esta solicitação. Entre em contato com a administração caso precise de esclarecimentos." },
    unavailable: { icon: ShieldX, title: "Não foi possível verificar o cadastro", message: "A conta não será liberada sem confirmação do servidor. Tente novamente ou entre novamente no sistema." },
  }[status];
  const Icon = content.icon;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-7 w-7" /></div>
        <h1 className="text-2xl font-semibold">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {status === "rejected" && <Button onClick={() => void requestAgain()} disabled={requestingAgain}>{requestingAgain ? "Enviando solicitação…" : "Solicitar nova autorização"}</Button>}
          <Button variant="outline" onClick={() => void checkStatus()} disabled={status === "loading" || requestingAgain}>Verificar novamente</Button>
          <Button variant={status === "rejected" ? "ghost" : "default"} onClick={() => void signOut()}>Sair</Button>
        </div>
      </section>
    </main>
  );
}
