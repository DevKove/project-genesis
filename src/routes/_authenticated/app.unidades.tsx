import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type UnitRow = Database["public"]["Tables"]["units"]["Row"];
const PAGE_SIZE = 25;

const UNIT_TYPES: Record<string, string> = {
  casa: "Casa",
  lote: "Lote",
  apartamento: "Apartamento",
  comercial: "Comercial",
  outro: "Outro",
};

const UNIT_STATUSES: Record<string, string> = {
  ocupada: "Ocupada",
  vaga: "Vaga",
  manutencao: "Em manutenção",
};

export const Route = createFileRoute("/_authenticated/app/unidades")({
  head: () => ({ meta: [{ title: "Unidades — Morada360" }] }),
  component: UnitsPage,
});

function UnitsPage() {
  const { current } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const manager = isManager(current?.role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const units = useQuery({
    queryKey: ["units", associationId, search, statusFilter, page],
    enabled: Boolean(associationId && manager),
    queryFn: async () => {
      if (!associationId) return { items: [] as UnitRow[], count: 0 };
      let query = supabase
        .from("units")
        .select("id,association_id,identifier,block,street,number,unit_type,status,notes,created_at,updated_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("identifier", { ascending: true });

      if (search.trim()) query = query.ilike("identifier", `%${search.trim()}%`);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as UnitRow[], count: count ?? 0 };
    },
  });

  function startCreate() {
    setEditing(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }

  function startEdit(unit: UnitRow) {
    setEditing(unit);
    setFormOpen(true);
    setDeleteTarget(null);
  }

  async function saveUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId) return;

    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") ?? "").trim();
    if (!identifier || identifier.length > 50) {
      toast.error("Informe um identificador de até 50 caracteres.");
      return;
    }

    const nullable = (key: string) => String(form.get(key) ?? "").trim() || null;
    const unitType = String(form.get("unit_type") ?? "casa");
    const status = String(form.get("status") ?? "ocupada");
    const payload = {
      identifier,
      block: nullable("block"),
      street: nullable("street"),
      number: nullable("number"),
      unit_type: unitType,
      status,
      notes: nullable("notes"),
    };

    setSaving(true);
    try {
      if (editing) {
        const { data, error } = await supabase
          .from("units")
          .update(payload)
          .eq("id", editing.id)
          .eq("association_id", associationId)
          .select("id")
          .maybeSingle();
        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe uma unidade com esse identificador nesta associação.");
            return;
          }
          throw error;
        }
        if (!data) {
          toast.error("Unidade não encontrada ou sem permissão para alterá-la.");
          return;
        }
        toast.success("Unidade atualizada.");
      } else {
        const { error } = await supabase.from("units").insert({ ...payload, association_id: associationId });
        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe uma unidade com esse identificador nesta associação.");
            return;
          }
          throw error;
        }
        toast.success("Unidade cadastrada.");
      }

      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["units", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível salvar a unidade. Verifique os dados e suas permissões.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUnit(unit: UnitRow) {
    if (!associationId) return;
    setDeleting(true);
    try {
      const { count, error: residentsError } = await supabase
        .from("residents")
        .select("id", { count: "exact", head: true })
        .eq("association_id", associationId)
        .eq("unit_id", unit.id);
      if (residentsError) throw residentsError;
      if ((count ?? 0) > 0) {
        toast.error("Esta unidade tem moradores vinculados. Transfira os vínculos antes de excluí-la.");
        setDeleteTarget(null);
        return;
      }

      const { data, error } = await supabase
        .from("units")
        .delete()
        .eq("id", unit.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Unidade não encontrada ou sem permissão para excluí-la.");
        return;
      }

      toast.success("Unidade excluída.");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["units", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível excluir a unidade. Verifique se existem vínculos.");
    } finally {
      setDeleting(false);
    }
  }

  if (!current) return null;
  if (!manager) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">A gestão de unidades está disponível apenas para os responsáveis autorizados da associação.</p>
      </div>
    );
  }

  const total = units.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Unidades"
        description="Cadastre e mantenha as unidades da associação."
        action={<Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Nova unidade</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" aria-label="Buscar unidade" placeholder="Buscar pelo identificador…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        </div>
        <select aria-label="Filtrar por situação" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
          <option value="all">Todas as situações</option>
          {Object.entries(UNIT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {formOpen && (
        <form key={editing?.id ?? "new"} onSubmit={saveUnit} className="mb-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editing ? "Editar unidade" : "Nova unidade"}</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => { setFormOpen(false); setEditing(null); }}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label htmlFor="unit-identifier">Identificador *</Label><Input id="unit-identifier" name="identifier" required maxLength={50} defaultValue={editing?.identifier ?? ""} placeholder="Ex.: QD-01 / CASA-12" /></div>
            <div><Label htmlFor="unit-block">Bloco / quadra</Label><Input id="unit-block" name="block" defaultValue={editing?.block ?? ""} maxLength={80} /></div>
            <div><Label htmlFor="unit-type">Tipo</Label><select id="unit-type" name="unit_type" defaultValue={editing?.unit_type ?? "casa"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.entries(UNIT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><Label htmlFor="unit-street">Rua / logradouro</Label><Input id="unit-street" name="street" defaultValue={editing?.street ?? ""} maxLength={120} /></div>
            <div><Label htmlFor="unit-number">Número</Label><Input id="unit-number" name="number" defaultValue={editing?.number ?? ""} maxLength={20} /></div>
            <div><Label htmlFor="unit-status">Situação</Label><select id="unit-status" name="status" defaultValue={editing?.status ?? "ocupada"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.entries(UNIT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          </div>
          <div><Label htmlFor="unit-notes">Observações</Label><Textarea id="unit-notes" name="notes" defaultValue={editing?.notes ?? ""} maxLength={2000} rows={3} /></div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar unidade"}</Button>
            <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancelar</Button>
          </div>
        </form>
      )}

      {deleteTarget && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Confirma a exclusão da unidade <strong>{deleteTarget.identifier}</strong>? A exclusão não pode ser desfeita.</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={deleting} onClick={() => void deleteUnit(deleteTarget)}>{deleting ? "Excluindo…" : "Confirmar exclusão"}</Button>
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {units.isError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">
          <p>Não foi possível carregar as unidades.</p>
          <Button variant="link" className="px-0" onClick={() => void units.refetch()}>Tentar novamente</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {units.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando unidades…</p>
        ) : units.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr><th className="px-4 py-3 font-medium">Unidade</th><th className="px-4 py-3 font-medium">Endereço</th><th className="px-4 py-3 font-medium">Tipo</th><th className="px-4 py-3 font-medium">Situação</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr>
              </thead>
              <tbody className="divide-y">
                {units.data.items.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{unit.identifier}</td>
                    <td className="px-4 py-3 text-muted-foreground">{[unit.street, unit.number, unit.block].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">{UNIT_TYPES[unit.unit_type] ?? unit.unit_type}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{UNIT_STATUSES[unit.status] ?? unit.status}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Editar unidade ${unit.identifier}`} onClick={() => startEdit(unit)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir unidade ${unit.identifier}`} onClick={() => setDeleteTarget(unit)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            <p>Nenhuma unidade encontrada.</p>
            <Button className="mt-4" onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Cadastrar primeira unidade</Button>
          </EmptyState>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{total} unidade(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || units.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
          <span>Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || units.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>
    </>
  );
}
