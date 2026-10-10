import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, Search, UserRoundX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager, isValidCPF, maskCPF, RELATION_LABELS, type ResidentRelation } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type ResidentRow = Database["public"]["Tables"]["residents"]["Row"];
type UnitOption = Pick<Database["public"]["Tables"]["units"]["Row"], "id" | "identifier">;
const PAGE_SIZE = 25;

export const Route = createFileRoute("/_authenticated/app/moradores")({
  head: () => ({ meta: [{ title: "Moradores — Morada360" }] }),
  component: ResidentsPage,
});

function ResidentsPage() {
  const { current } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const manager = isManager(current?.role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [unitFilter, setUnitFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResidentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const unitOptions = useQuery({
    queryKey: ["unit-options", associationId],
    enabled: Boolean(associationId && manager),
    queryFn: async () => {
      if (!associationId) return [] as UnitOption[];
      const { data, error } = await supabase
        .from("units")
        .select("id,identifier")
        .eq("association_id", associationId)
        .order("identifier", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as UnitOption[];
    },
  });

  const residents = useQuery({
    queryKey: ["residents", associationId, search, statusFilter, unitFilter, page],
    enabled: Boolean(associationId && manager),
    queryFn: async () => {
      if (!associationId) return { items: [] as ResidentRow[], count: 0 };
      let query = supabase
        .from("residents")
        .select("id,association_id,unit_id,full_name,cpf,email,phone,birth_date,relation,is_active,lgpd_consent,notes,created_at,updated_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("full_name", { ascending: true });

      if (search.trim()) query = query.ilike("full_name", `%${search.trim()}%`);
      if (statusFilter === "active") query = query.eq("is_active", true);
      if (statusFilter === "inactive") query = query.eq("is_active", false);
      if (unitFilter === "none") query = query.is("unit_id", null);
      else if (unitFilter !== "all") query = query.eq("unit_id", unitFilter);

      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as ResidentRow[], count: count ?? 0 };
    },
  });

  function startCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function startEdit(resident: ResidentRow) {
    setEditing(resident);
    setFormOpen(true);
  }

  async function saveResident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId) return;

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const cpfInput = String(form.get("cpf") ?? "").trim();
    const cpfDigits = cpfInput.replace(/\D/g, "");
    if (fullName.length < 2 || fullName.length > 160) {
      toast.error("Informe o nome completo (de 2 a 160 caracteres).");
      return;
    }
    if (cpfInput && !isValidCPF(cpfInput)) {
      toast.error("O CPF informado é inválido. Confira os 11 dígitos.");
      return;
    }

    const nullable = (key: string) => String(form.get(key) ?? "").trim() || null;
    const relation = String(form.get("relation") ?? "proprietario") as ResidentRelation;
    const unitId = String(form.get("unit_id") ?? "") || null;
    const payload = {
      full_name: fullName,
      cpf: cpfDigits || null,
      email: nullable("email"),
      phone: nullable("phone"),
      birth_date: nullable("birth_date"),
      relation,
      unit_id: unitId,
      is_active: form.get("is_active") === "on",
      lgpd_consent: form.get("lgpd_consent") === "on",
      notes: nullable("notes"),
    };

    setSaving(true);
    try {
      if (cpfDigits) {
        let duplicateQuery = supabase
          .from("residents")
          .select("id")
          .eq("association_id", associationId)
          .eq("cpf", cpfDigits);
        if (editing) duplicateQuery = duplicateQuery.neq("id", editing.id);
        const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1).maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) {
          toast.error("Já existe um morador com esse CPF nesta associação.");
          return;
        }
      }

      if (editing) {
        const { data, error } = await supabase
          .from("residents")
          .update(payload)
          .eq("id", editing.id)
          .eq("association_id", associationId)
          .select("id")
          .maybeSingle();
        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe um morador com esse CPF nesta associação.");
            return;
          }
          if (error.code === "23514") {
            toast.error("Os dados do CPF não passaram na validação.");
            return;
          }
          if (error.code === "23503") {
            toast.error("A unidade selecionada não pertence a esta associação.");
            return;
          }
          throw error;
        }
        if (!data) {
          toast.error("Morador não encontrado ou sem permissão para alterá-lo.");
          return;
        }
        toast.success("Cadastro do morador atualizado.");
      } else {
        const { error } = await supabase.from("residents").insert({ ...payload, association_id: associationId });
        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe um morador com esse CPF nesta associação.");
            return;
          }
          if (error.code === "23514") {
            toast.error("Os dados do CPF não passaram na validação.");
            return;
          }
          if (error.code === "23503") {
            toast.error("A unidade selecionada não pertence a esta associação.");
            return;
          }
          throw error;
        }
        toast.success("Morador cadastrado.");
      }

      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["residents", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível salvar o morador. Verifique os dados e suas permissões.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(resident: ResidentRow) {
    if (!associationId) return;
    setChangingStatus(resident.id);
    try {
      const { data, error } = await supabase
        .from("residents")
        .update({ is_active: !resident.is_active })
        .eq("id", resident.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Morador não encontrado ou sem permissão para alterar a situação.");
        return;
      }
      toast.success(resident.is_active ? "Morador desativado. O histórico foi preservado." : "Morador reativado.");
      await queryClient.invalidateQueries({ queryKey: ["residents", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível alterar a situação do morador.");
    } finally {
      setChangingStatus(null);
    }
  }

  if (!current) return null;
  if (!manager) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">A gestão de moradores está disponível apenas para os responsáveis autorizados da associação.</p>
      </div>
    );
  }

  const total = residents.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unitLabel = (unitId: string | null) => unitOptions.data?.find((unit) => unit.id === unitId)?.identifier ?? (unitId ? "Unidade vinculada" : "Sem unidade");

  return (
    <>
      <PageHeader
        title="Moradores"
        description="Gerencie os cadastros e vínculos de moradores desta associação."
        action={<Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Novo morador</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" aria-label="Buscar morador" placeholder="Buscar pelo nome…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        </div>
        <select aria-label="Filtrar por situação" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
          <option value="active">Moradores ativos</option>
          <option value="inactive">Moradores inativos</option>
          <option value="all">Todos os moradores</option>
        </select>
        <select aria-label="Filtrar por unidade" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={unitFilter} onChange={(event) => { setUnitFilter(event.target.value); setPage(0); }}>
          <option value="all">Todas as unidades</option>
          <option value="none">Sem unidade vinculada</option>
          {(unitOptions.data ?? []).map((unit) => <option key={unit.id} value={unit.id}>{unit.identifier}</option>)}
        </select>
      </div>

      {formOpen && (
        <form key={editing?.id ?? "new"} onSubmit={saveResident} className="mb-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editing ? "Editar morador" : "Novo morador"}</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => { setFormOpen(false); setEditing(null); }}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2"><Label htmlFor="resident-name">Nome completo *</Label><Input id="resident-name" name="full_name" required minLength={2} maxLength={160} defaultValue={editing?.full_name ?? ""} /></div>
            <div><Label htmlFor="resident-relation">Vínculo *</Label><select id="resident-relation" name="relation" defaultValue={editing?.relation ?? "proprietario"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.entries(RELATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><Label htmlFor="resident-cpf">CPF (opcional)</Label><Input id="resident-cpf" name="cpf" inputMode="numeric" maxLength={14} defaultValue={editing?.cpf ?? ""} placeholder="000.000.000-00" /></div>
            <div><Label htmlFor="resident-email">E-mail</Label><Input id="resident-email" name="email" type="email" maxLength={254} defaultValue={editing?.email ?? ""} /></div>
            <div><Label htmlFor="resident-phone">Telefone</Label><Input id="resident-phone" name="phone" type="tel" maxLength={30} defaultValue={editing?.phone ?? ""} /></div>
            <div><Label htmlFor="resident-birth-date">Data de nascimento</Label><Input id="resident-birth-date" name="birth_date" type="date" defaultValue={editing?.birth_date ?? ""} /></div>
            <div><Label htmlFor="resident-unit">Unidade</Label><select id="resident-unit" name="unit_id" defaultValue={editing?.unit_id ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem unidade vinculada</option>{(unitOptions.data ?? []).map((unit) => <option key={unit.id} value={unit.id}>{unit.identifier}</option>)}</select></div>
          </div>
          <div><Label htmlFor="resident-notes">Observações internas</Label><Textarea id="resident-notes" name="notes" maxLength={2000} rows={3} defaultValue={editing?.notes ?? ""} /></div>
          <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={editing?.is_active ?? true} className="h-4 w-4 rounded border-input" /> Cadastro ativo</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="lgpd_consent" defaultChecked={editing?.lgpd_consent ?? false} className="h-4 w-4 rounded border-input" /> Consentimento registrado, quando aplicável</label>
          </div>
          <p className="text-xs text-muted-foreground">O campo de consentimento não substitui a definição da base legal aplicável ao tratamento de dados pessoais.</p>
          {unitOptions.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as unidades. Você pode salvar sem vínculo ou tentar novamente.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar morador"}</Button>
            <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancelar</Button>
          </div>
        </form>
      )}

      {residents.isError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">
          <p>Não foi possível carregar os moradores.</p>
          <Button variant="link" className="px-0" onClick={() => void residents.refetch()}>Tentar novamente</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {residents.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando moradores…</p>
        ) : residents.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr><th className="px-4 py-3 font-medium">Morador</th><th className="px-4 py-3 font-medium">CPF</th><th className="px-4 py-3 font-medium">Contato</th><th className="px-4 py-3 font-medium">Unidade</th><th className="px-4 py-3 font-medium">Vínculo</th><th className="px-4 py-3 font-medium">Situação</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr>
              </thead>
              <tbody className="divide-y">
                {residents.data.items.map((resident) => (
                  <tr key={resident.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{resident.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{maskCPF(resident.cpf) || "—"}</td>
                    <td className="px-4 py-3"><div>{resident.email ?? "—"}</div><div className="text-xs text-muted-foreground">{resident.phone ?? ""}</div></td>
                    <td className="px-4 py-3">{unitLabel(resident.unit_id)}</td>
                    <td className="px-4 py-3">{RELATION_LABELS[resident.relation] ?? resident.relation}</td>
                    <td className="px-4 py-3"><span className={resident.is_active ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700" : "rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"}>{resident.is_active ? "Ativo" : "Inativo"}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Editar morador ${resident.full_name}`} onClick={() => startEdit(resident)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={resident.is_active ? "Desativar morador" : "Reativar morador"} disabled={changingStatus === resident.id} onClick={() => void toggleActive(resident)}>{resident.is_active ? <UserRoundX className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            <p>Nenhum morador encontrado para os filtros selecionados.</p>
            <Button className="mt-4" onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Cadastrar primeiro morador</Button>
          </EmptyState>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{total} morador(es)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || residents.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
          <span>Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || residents.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>
    </>
  );
}
