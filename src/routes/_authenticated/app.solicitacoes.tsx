import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type RequestRow = Database["public"]["Tables"]["service_requests"]["Row"];
const PAGE_SIZE = 20;
const STATUSES = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_morador: "Aguardando morador",
  atendida: "Atendida",
  recusada: "Recusada",
  cancelada: "Cancelada",
} as const;
const PRIORITIES = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" } as const;
const CATEGORIES = {
  cadastro: "Cadastro",
  manutencao: "Manutenção",
  documentos: "Documentos",
  financeiro: "Financeiro",
  convivencia: "Convivência",
  outro: "Outro",
} as const;

export const Route = createFileRoute("/_authenticated/app/solicitacoes")({
  head: () => ({ meta: [{ title: "Solicitações — Morada360" }] }),
  component: ServiceRequestsPage,
});

function ServiceRequestsPage() {
  const { current, userId } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const manager = isManager(current?.role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ["service-requests", associationId, search, statusFilter, page],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return { items: [] as RequestRow[], count: 0 };
      let query = supabase
        .from("service_requests")
        .select("id,association_id,title,description,category,priority,status,created_by,resolution_notes,created_at,updated_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("created_at", { ascending: false });
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as RequestRow[], count: count ?? 0 };
    },
  });

  async function createRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "outro");
    const priority = String(form.get("priority") ?? "normal");
    if (title.length < 1 || title.length > 160) {
      toast.error("O título deve ter entre 1 e 160 caracteres.");
      return;
    }
    if (description.length < 1 || description.length > 5000) {
      toast.error("A descrição deve ter entre 1 e 5.000 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("service_requests").insert({
        association_id: associationId, created_by: userId, title, description, category, priority,
      });
      if (error) throw error;
      toast.success("Solicitação registrada.");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["service-requests", associationId] });
    } catch {
      toast.error("Não foi possível registrar a solicitação. Verifique sua associação e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: RequestRow, status: keyof typeof STATUSES) {
    if (!associationId || !manager) return;
    setUpdatingId(item.id);
    try {
      const { data, error } = await supabase.from("service_requests")
        .update({ status })
        .eq("id", item.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Solicitação não encontrada ou sem permissão para alterá-la.");
        return;
      }
      toast.success("Situação atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["service-requests", associationId] });
    } catch {
      toast.error("Não foi possível atualizar a situação.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!current) return null;
  const total = requests.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Solicitações"
        description={manager ? "Gerencie as solicitações recebidas da comunidade." : "Registre solicitações e acompanhe as que você abriu."}
        action={<Button onClick={() => setFormOpen((open) => !open)}><Plus className="mr-2 h-4 w-4" /> Nova solicitação</Button>}
      />
      {formOpen && (
        <form onSubmit={createRequest} className="mb-6 space-y-4 rounded-lg border bg-card p-5 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="request-title">Título *</Label><Input id="request-title" name="title" required maxLength={160} /></div>
            <div>
              <Label htmlFor="request-category">Categoria</Label>
              <select id="request-category" name="category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="outro">
                {Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="request-priority">Prioridade</Label>
              <select id="request-priority" name="priority" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="normal">
                {Object.entries(PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div><Label htmlFor="request-description">Descrição *</Label><Textarea id="request-description" name="description" required maxLength={5000} rows={5} /></div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Registrando…" : "Registrar solicitação"}</Button>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar solicitação" placeholder="Buscar pelo título…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
        <select aria-label="Filtrar por situação" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
          <option value="all">Todas as situações</option>
          {Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {requests.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm"><p>Não foi possível carregar as solicitações. Verifique sua conexão e permissões.</p><Button variant="link" className="px-0" onClick={() => void requests.refetch()}>Tentar novamente</Button></div>}

      <div className="overflow-hidden rounded-lg border bg-card">
        {requests.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando solicitações…</p> :
          requests.data?.items.length ? <div className="divide-y">{requests.data.items.map((item) => (
            <article key={item.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.title}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{STATUSES[item.status as keyof typeof STATUSES] ?? item.status}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs">Prioridade: {PRIORITIES[item.priority as keyof typeof PRIORITIES] ?? item.priority}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{CATEGORIES[item.category as keyof typeof CATEGORIES] ?? item.category} · {new Date(item.created_at).toLocaleString("pt-BR")}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.description}</p>
                  {item.resolution_notes && <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm"><strong>Observações:</strong> {item.resolution_notes}</p>}
                </div>
                {manager && <div className="w-full sm:w-52"><Label htmlFor={`request-status-${item.id}`}>Atualizar situação</Label><select id={`request-status-${item.id}`} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={item.status} disabled={updatingId === item.id} onChange={(event) => void updateStatus(item, event.target.value as keyof typeof STATUSES)}>{Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}
              </div>
            </article>
          ))}</div> : <EmptyState><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><ClipboardList className="h-6 w-6" /></div><p>Nenhuma solicitação encontrada para os filtros selecionados.</p></EmptyState>}
      </div>

      <div className="page-pagination mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground"><span>{total} solicitação(ões)</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0 || requests.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button><span>Página {page + 1} de {totalPages}</span><Button variant="outline" size="sm" disabled={page + 1 >= totalPages || requests.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
    </>
  );
}
