import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock3, ShieldCheck, ShieldX, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/app/admin-aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovação de cadastros — Morada360" }] }),
  component: AccountApprovalsPage,
});

type RequestRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  requested_association_id: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
};

const roleOptions = [
  ["morador", "Morador"],
  ["funcionario", "Funcionário"],
  ["conselheiro", "Conselheiro"],
  ["secretario", "Secretário"],
  ["tesoureiro", "Tesoureiro"],
  ["presidente", "Presidente"],
  ["admin", "Administrador da associação"],
] as const;

function AccountApprovalsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [associationByUser, setAssociationByUser] = useState<Record<string, string>>({});
  const [roleByUser, setRoleByUser] = useState<Record<string, Database["public"]["Enums"]["assoc_role"]>>({});
  const [busyUser, setBusyUser] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        if (alive) void navigate({ to: "/auth" });
        return;
      }
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id).eq("role", "platform_admin").maybeSingle();
      if (!alive) return;
      if (error || !data) setIsPlatformAdmin(false);
      else setIsPlatformAdmin(true);
    })();
    return () => { alive = false; };
  }, [navigate]);

  const associations = useQuery({
    queryKey: ["admin-approval-associations"],
    enabled: isPlatformAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("associations").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const requests = useQuery({
    queryKey: ["admin-account-requests"],
    enabled: isPlatformAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_pending_account_access");
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
  });

  async function review(row: RequestRow, decision: "approved" | "rejected") {
    setBusyUser(row.user_id);
    try {
      const associationId = associationByUser[row.user_id] ?? row.requested_association_id ?? "";
      const role = roleByUser[row.user_id] ?? "morador";
      const { error } = await supabase.rpc("review_account_access", {
        _user_id: row.user_id,
        _decision: decision,
        _association_id: decision === "approved" && associationId ? associationId : null,
        _association_role: role,
        _note: null,
      });
      if (error) throw error;
      toast.success(decision === "approved" ? "Cadastro aprovado e acesso liberado." : "Solicitação recusada.");
      await queryClient.invalidateQueries({ queryKey: ["admin-account-requests"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível revisar o cadastro.";
      toast.error(message);
    } finally {
      setBusyUser(null);
    }
  }

  if (isPlatformAdmin === null) return <div className="p-8 text-sm text-muted-foreground">Verificando permissões administrativas…</div>;
  if (!isPlatformAdmin) return <section className="rounded-lg border bg-card p-8"><ShieldX className="mb-3 h-8 w-8 text-destructive" /><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador principal pode analisar cadastros e liberar contas.</p><Button className="mt-5" variant="outline" onClick={() => void navigate({ to: "/app" })}>Voltar ao painel</Button></section>;

  return (
    <div className="space-y-6">
      <PageHeader title="Aprovação de cadastros" description="Analise o perfil solicitado antes de liberar o acesso. As permissões são aplicadas no banco de dados." />
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-muted-foreground">A conta continua bloqueada enquanto estiver pendente. Selecione a associação e o perfil adequados; a escolha não concede privilégios de administrador da plataforma.</p></div>
      {requests.isLoading ? <p className="text-sm text-muted-foreground">Carregando solicitações…</p> : null}
      {requests.isError ? <section className="rounded-lg border p-5"><p className="text-sm text-destructive">Não foi possível carregar os cadastros pendentes. Verifique se a migração de aprovação foi aplicada no Supabase.</p><Button className="mt-3" variant="outline" onClick={() => void requests.refetch()}>Tentar novamente</Button></section> : null}
      {!requests.isLoading && !requests.isError && (requests.data?.length ?? 0) === 0 ? <section className="rounded-lg border bg-card p-8 text-center"><Check className="mx-auto mb-3 h-8 w-8 text-primary" /><h2 className="font-semibold">Nenhum cadastro pendente</h2><p className="mt-1 text-sm text-muted-foreground">Novas solicitações aparecerão aqui.</p></section> : null}
      <div className="space-y-4">
        {(requests.data ?? []).map((row) => {
          const selectedAssociation = associationByUser[row.user_id] ?? row.requested_association_id ?? "";
          const selectedRole = roleByUser[row.user_id] ?? "morador";
          return <section key={row.id} className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3"><div className="rounded-lg bg-muted p-2"><UserRound className="h-5 w-5" /></div><div><h2 className="font-semibold">{row.full_name || "Nome não informado"}</h2><p className="text-sm text-muted-foreground">{row.email}</p><p className="mt-1 text-xs text-muted-foreground">Solicitado em {new Date(row.requested_at).toLocaleString("pt-BR")}</p></div></div>
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-3 py-1 text-xs font-medium text-warning"><Clock3 className="h-3.5 w-3.5" /> Pendente</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="font-medium">Associação (opcional)</span><select className="w-full rounded-md border bg-background px-3 py-2" value={selectedAssociation} onChange={(e) => setAssociationByUser((old) => ({ ...old, [row.user_id]: e.target.value }))}><option value="">Sem vínculo por enquanto</option>{(associations.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Perfil a conceder</span><select className="w-full rounded-md border bg-background px-3 py-2" value={selectedRole} onChange={(e) => setRoleByUser((old) => ({ ...old, [row.user_id]: e.target.value as Database["public"]["Enums"]["assoc_role"] }))}>{roleOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busyUser === row.user_id} onClick={() => void review(row, "rejected")}><ShieldX className="mr-2 h-4 w-4" /> Recusar</Button><Button disabled={busyUser === row.user_id} onClick={() => void review(row, "approved")}>{busyUser === row.user_id ? "Processando…" : <><Check className="mr-2 h-4 w-4" /> Aprovar cadastro</>}</Button></div>
          </section>;
        })}
      </div>
    </div>
  );
}
