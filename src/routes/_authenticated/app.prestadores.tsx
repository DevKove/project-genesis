import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Pencil, Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
const PAGE_SIZE = 25;
const CATEGORIES = {
  manutencao: "Manutenção",
  limpeza: "Limpeza",
  seguranca: "Segurança",
  jardinagem: "Jardinagem",
  eletrica: "Elétrica",
  hidraulica: "Hidráulica",
  tecnologia: "Tecnologia",
  outros: "Outros",
} as const;

export const Route = createFileRoute("/_authenticated/app/prestadores")({
  head: () => ({ meta: [{ title: "Prestadores — Morada360" }] }),
  component: VendorsPage,
});

function VendorsPage() {
  const { current, userId } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const manager = isManager(current?.role);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("active");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  const vendors = useQuery({
    queryKey: ["vendors", associationId, search, activeFilter, page],
    enabled: Boolean(associationId && manager),
    queryFn: async () => {
      if (!associationId) return { items: [] as VendorRow[], count: 0 };
      let query = supabase.from("vendors")
        .select("id,association_id,name,service_category,contact_name,phone,email,notes,is_active,created_by,created_at,updated_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("name", { ascending: true });
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      if (activeFilter !== "all") query = query.eq("is_active", activeFilter === "active");
      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as VendorRow[], count: count ?? 0 };
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(vendor: VendorRow) {
    setEditing(vendor);
    setFormOpen(true);
  }

  async function saveVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !manager) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const service_category = String(form.get("service_category") ?? "outros");
    const optional = (key: string) => String(form.get(key) ?? "").trim() || null;
    const payload = {
      name,
      service_category,
      contact_name: optional("contact_name"),
      phone: optional("phone"),
      email: optional("email"),
      notes: optional("notes"),
    };
    if (name.length < 2 || name.length > 160) {
      toast.error("O nome deve ter entre 2 e 160 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { data, error } = await supabase.from("vendors").update(payload)
          .eq("id", editing.id).eq("association_id", associationId).select("id").maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error("Prestador não encontrado ou sem permissão para alterá-lo.");
          return;
        }
        toast.success("Prestador atualizado.");
      } else {
        const { error } = await supabase.from("vendors").insert({ ...payload, association_id: associationId, created_by: userId });
        if (error) throw error;
        toast.success("Prestador cadastrado.");
      }
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["vendors", associationId] });
    } catch {
      toast.error("Não foi possível salvar o prestador. Verifique os dados e suas permissões.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(vendor: VendorRow) {
    if (!associationId || !manager) return;
    setChangingId(vendor.id);
    try {
      const { data, error } = await supabase.from("vendors").update({ is_active: !vendor.is_active })
        .eq("id", vendor.id).eq("association_id", associationId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Prestador não encontrado ou sem permissão para alterá-lo.");
        return;
      }
      toast.success(vendor.is_active ? "Prestador desativado." : "Prestador reativado.");
      await queryClient.invalidateQueries({ queryKey: ["vendors", associationId] });
    } catch {
      toast.error("Não foi possível alterar a situação do prestador.");
    } finally {
      setChangingId(null);
    }
  }

  if (!current) return null;
  if (!manager) {
    return <div className="rounded-xl border bg-card p-8"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">O cadastro de prestadores está disponível apenas para gestores autorizados da associação.</p></div>;
  }
  const total = vendors.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Prestadores" description="Mantenha os contatos e serviços contratados pela associação." action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo prestador</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar prestador" placeholder="Buscar pelo nome…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
        <select aria-label="Filtrar prestadores" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(0); }}>
          <option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos</option>
        </select>
      </div>

      {formOpen && <form key={editing?.id ?? "new"} onSubmit={saveVendor} className="mb-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? "Editar prestador" : "Novo prestador"}</h2><Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => { setFormOpen(false); setEditing(null); }}><X className="h-4 w-4" /></Button></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label htmlFor="vendor-name">Nome / empresa *</Label><Input id="vendor-name" name="name" required maxLength={160} defaultValue={editing?.name ?? ""} /></div>
          <div><Label htmlFor="vendor-category">Categoria</Label><select id="vendor-category" name="service_category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue={editing?.service_category ?? "outros"}>{Object.entries(CATEGORIES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><Label htmlFor="vendor-contact">Contato</Label><Input id="vendor-contact" name="contact_name" maxLength={160} defaultValue={editing?.contact_name ?? ""} /></div>
          <div><Label htmlFor="vendor-phone">Telefone</Label><Input id="vendor-phone" name="phone" type="tel" maxLength={40} defaultValue={editing?.phone ?? ""} /></div>
          <div><Label htmlFor="vendor-email">E-mail</Label><Input id="vendor-email" name="email" type="email" maxLength={254} defaultValue={editing?.email ?? ""} /></div>
        </div>
        <div><Label htmlFor="vendor-notes">Observações</Label><Textarea id="vendor-notes" name="notes" maxLength={3000} rows={3} defaultValue={editing?.notes ?? ""} /></div>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar prestador"}</Button><Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancelar</Button></div>
      </form>}

      {vendors.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm"><p>Não foi possível carregar os prestadores. Verifique sua conexão e permissões.</p><Button variant="link" className="px-0" onClick={() => void vendors.refetch()}>Tentar novamente</Button></div>}
      <div className="overflow-hidden rounded-xl border bg-card">
        {vendors.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando prestadores…</p> :
          vendors.data?.items.length ? <div className="divide-y">{vendors.data.items.map((vendor) => <article key={vendor.id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{vendor.name}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{CATEGORIES[vendor.service_category as keyof typeof CATEGORIES] ?? vendor.service_category}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{vendor.is_active ? "Ativo" : "Inativo"}</span></div>
                {vendor.contact_name && <p className="mt-2 text-sm">Contato: {vendor.contact_name}</p>}{vendor.phone && <p className="mt-1 text-sm text-muted-foreground">Telefone: {vendor.phone}</p>}{vendor.email && <p className="mt-1 text-sm text-muted-foreground">E-mail: {vendor.email}</p>}{vendor.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{vendor.notes}</p>}
              </div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openEdit(vendor)}><Pencil className="mr-1 h-4 w-4" /> Editar</Button><Button variant="outline" size="sm" disabled={changingId === vendor.id} onClick={() => void toggleActive(vendor)}>{vendor.is_active ? "Desativar" : "Reativar"}</Button></div>
            </div>
          </article>)}</div> : <EmptyState><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Building2 className="h-6 w-6" /></div><p>Nenhum prestador encontrado para os filtros selecionados.</p></EmptyState>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{total} prestador(es)</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0 || vendors.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button><span>Página {page + 1} de {totalPages}</span><Button variant="outline" size="sm" disabled={page + 1 >= totalPages || vendors.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
    </>
  );
}
