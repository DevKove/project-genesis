import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Clock3, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type JoinRequest = {
  id: string;
  association_id: string;
  association_name: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  requested_at: string;
};

export function JoinRequestsPanel({
  associationId,
  userId,
  canManage,
}: {
  associationId: string;
  userId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ["association-join-requests", associationId],
    enabled: Boolean(associationId && canManage),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("association_join_requests")
        .select("id,association_id,association_name,user_id,full_name,email,status,requested_at")
        .eq("association_id", associationId)
        .eq("status", "pendente")
        .order("requested_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as JoinRequest[];
    },
    refetchInterval: canManage ? 30000 : false,
  });

  async function review(request: JoinRequest, decision: "aprovado" | "rejeitado") {
    const { data, error } = await supabase.rpc("review_association_join_request", {
      _request_id: request.id,
      _decision: decision,
      _note: null,
    });
    if (error) {
      toast.error(error.code === "42501" ? "Somente o administrador pode analisar solicitações." : "Não foi possível atualizar a solicitação. Atualize a lista e tente novamente.");
      return;
    }
    if (data !== decision) {
      toast.error("A solicitação não foi atualizada. Recarregue a lista.");
      return;
    }
    toast.success(decision === "aprovado" ? "Membro aprovado e acesso liberado." : "Solicitação recusada.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["association-join-requests", associationId] }),
      queryClient.invalidateQueries({ queryKey: ["members", associationId] }),
      queryClient.invalidateQueries({ queryKey: ["memberships", userId] }),
      queryClient.invalidateQueries({ queryKey: ["stats", associationId] }),
    ]);
  }

  if (!canManage) return null;

  return (
    <section className="mb-6 rounded-xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><BellRing className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">Solicitações de acesso</h2>
            <p className="mt-1 text-sm text-muted-foreground">Novos cadastros que aguardam a decisão do administrador desta associação.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"><Clock3 className="h-3.5 w-3.5" /> {requests.data?.length ?? 0} pendente(s)</span>
      </div>

      {requests.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando solicitações…</p>
      ) : requests.isError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
          <span>Não foi possível carregar as solicitações.</span>
          <Button variant="outline" size="sm" onClick={() => void requests.refetch()}>Tentar novamente</Button>
        </div>
      ) : requests.data?.length ? (
        <div className="mt-4 divide-y">
          {requests.data.map((request) => (
            <article key={request.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="break-words">{request.full_name}</span></div>
                <p className="mt-1 break-all text-sm text-muted-foreground">{request.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">Solicitado em {new Date(request.requested_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" onClick={() => void review(request, "aprovado")}><Check className="mr-1.5 h-4 w-4" /> Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => void review(request, "rejeitado")}><X className="mr-1.5 h-4 w-4" /> Recusar</Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma solicitação pendente. Novos pedidos aparecerão aqui automaticamente.</p>
      )}
    </section>
  );
}
