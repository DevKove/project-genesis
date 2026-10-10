import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";

type AuditRow = Database["public"]["Tables"]["audit_logs"]["Row"];
const PAGE_SIZE = 25;

const ENTITY_LABELS: Record<string, string> = {
  associations: "Associação",
  vendors: "Prestadores",
  association_members: "Membros",
  units: "Unidades",
  residents: "Moradores",
  invitations: "Convites",
  announcements: "Comunicados",
  incidents: "Ocorrências",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "Criação",
  update: "Alteração",
  delete: "Exclusão",
};

export const Route = createFileRoute("/_authenticated/app/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Morada360" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { current } = useAssoc();
  const associationId = current?.association_id;
  const canReadAudit = current?.role === "admin" || current?.role === "presidente";
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);

  const audit = useQuery({
    queryKey: ["audit", associationId, actionFilter, entityFilter, search, fromDate, toDate, page],
    enabled: Boolean(associationId && canReadAudit),
    queryFn: async () => {
      if (!associationId) return { items: [] as AuditRow[], count: 0 };
      let query = supabase
        .from("audit_logs")
        .select("id,association_id,user_id,action,entity,entity_id,details,created_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("created_at", { ascending: false });

      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      if (entityFilter !== "all") query = query.eq("entity", entityFilter);
      if (search.trim()) query = query.ilike("entity_id", `%${search.trim()}%`);
      if (fromDate) query = query.gte("created_at", new Date(`${fromDate}T00:00:00`).toISOString());
      if (toDate) query = query.lte("created_at", new Date(`${toDate}T23:59:59.999`).toISOString());

      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  if (!current) return null;
  if (!canReadAudit) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">O histórico de auditoria está disponível para administradores e presidentes autorizados da associação.</p>
      </div>
    );
  }

  const total = audit.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Histórico de auditoria" description="Consulte as alterações registradas na associação." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" aria-label="Buscar identificador do registro" placeholder="ID do registro…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        </div>
        <select aria-label="Filtrar por ação" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(0); }}>
          <option value="all">Todas as ações</option>
          <option value="insert">Criação</option>
          <option value="update">Alteração</option>
          <option value="delete">Exclusão</option>
        </select>
        <select aria-label="Filtrar por módulo" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={entityFilter} onChange={(event) => { setEntityFilter(event.target.value); setPage(0); }}>
          <option value="all">Todos os módulos</option>
          {Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Input aria-label="Data inicial" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} />
        <Input aria-label="Data final" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); setPage(0); }} />
      </div>

      {audit.isError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">
          <p>Não foi possível carregar o histórico. Verifique sua permissão e conexão.</p>
          <Button variant="link" className="px-0" onClick={() => void audit.refetch()}>Tentar novamente</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {audit.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando histórico…</p>
        ) : audit.data?.items.length ? (
          <div className="divide-y">
            {audit.data.items.map((entry) => (
              <article key={entry.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                      <span className="font-medium">{ENTITY_LABELS[entry.entity] ?? entry.entity}</span>
                      <span className="text-xs text-muted-foreground">Registro: {entry.entity_id ?? "—"}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Responsável: {entry.user_id ? `${entry.user_id.slice(0, 8)}…` : "Sistema"} · {new Date(entry.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">Evento #{entry.id}</span>
                </div>
                {entry.details && (
                  <details className="mt-3 rounded-lg bg-muted/30 p-3">
                    <summary className="cursor-pointer text-sm font-medium">Ver detalhes registrados</summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{JSON.stringify(entry.details, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><History className="h-6 w-6" /></div>
            <p>Nenhum evento de auditoria encontrado para os filtros selecionados.</p>
          </EmptyState>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{total} evento(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || audit.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
          <span>Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || audit.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>
    </>
  );
}
