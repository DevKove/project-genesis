import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldCheck, UserRound, Save, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/admin-perfis")({
  head: () => ({ meta: [{ title: "Gerenciar perfis — Morada360" }] }),
  component: AdminProfilesPage,
});

type Membership = {
  association_id: string;
  association_name: string;
  role: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  account_status: string;
  platform_role: string;
  created_at: string;
  memberships: Membership[];
};

const ASSOCIATION_ROLES = [
  { value: "admin", label: "Administrador da associação" },
  { value: "presidente", label: "Presidente" },
  { value: "tesoureiro", label: "Tesoureiro" },
  { value: "secretario", label: "Secretário" },
  { value: "conselheiro", label: "Conselheiro" },
  { value: "funcionario", label: "Funcionário" },
  { value: "morador", label: "Morador" },
];

function AdminProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [draft, setDraft] = useState({ full_name: "", phone: "", avatar_url: "", association_id: "", role: "" });
  const [saving, setSaving] = useState(false);
  const db = supabase as any;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        if (alive) void navigate({ to: "/auth" });
        return;
      }
      const { data, error } = await db.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "platform_admin").maybeSingle();
      if (alive) setIsAdmin(!error && Boolean(data));
    })();
    return () => { alive = false; };
  }, [navigate]);

  const profiles = useQuery({
    queryKey: ["platform-admin-profiles"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_list_user_profiles");
      if (error) throw error;
      return ((data ?? []) as ProfileRow[]).map((p) => ({
        ...p,
        memberships: Array.isArray(p.memberships) ? p.memberships : [],
      }));
    },
  });

  function startEdit(profile: ProfileRow) {
    const firstMembership = profile.memberships[0];
    setEditing(profile);
    setDraft({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? "",
      association_id: firstMembership?.association_id ?? "",
      role: firstMembership?.role ?? "",
    });
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !isAdmin) return;
    setSaving(true);
    try {
      const { error: profileError } = await db.from("profiles").update({
        full_name: draft.full_name.trim() || null,
        phone: draft.phone.trim() || null,
        avatar_url: draft.avatar_url.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", editing.user_id);
      if (profileError) throw profileError;

      const originalMembership = editing.memberships.find((m) => m.association_id === draft.association_id);
      if (draft.association_id && draft.role && originalMembership?.role !== draft.role) {
        const { error: roleError } = await db.rpc("admin_update_association_member_role", {
          _user_id: editing.user_id,
          _association_id: draft.association_id,
          _new_role: draft.role,
        });
        if (roleError) throw roleError;
      }
      toast.success("Perfil atualizado com sucesso.");
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-profiles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-profiles"] });
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === null) return <div className="p-8 text-sm text-muted-foreground">Verificando permissões administrativas…</div>;
  if (!isAdmin) return <section className="rounded-xl border bg-card p-8"><ShieldCheck className="mb-3 h-8 w-8 text-destructive" /><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador principal pode gerenciar todos os perfis.</p><Button className="mt-5" variant="outline" onClick={() => void navigate({ to: "/app" })}>Voltar ao painel</Button></section>;

  const filtered = (profiles.data ?? []).filter((p) => [p.email, p.full_name ?? "", p.phone ?? "", p.user_id, p.account_status, ...p.memberships.map((m) => m.association_name), ...p.memberships.map((m) => m.role)].some((v) => v.toLowerCase().includes(search.toLowerCase())));

  return <div className="space-y-6">
    <PageHeader title="Gerenciar perfis" description="Edite dados pessoais e o tipo de perfil dos usuários nas associações." />
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-muted-foreground">Somente o administrador principal pode editar esses dados. A função de administrador principal da plataforma é protegida separadamente; os tipos abaixo correspondem aos papéis de cada usuário dentro de uma associação.</p></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, e-mail, associação ou tipo de perfil…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    {profiles.isLoading ? <p className="text-sm text-muted-foreground">Carregando perfis…</p> : null}
    {profiles.isError ? <section className="rounded-xl border p-5"><p className="text-sm text-destructive">Não foi possível carregar os perfis. Verifique as permissões do banco de dados.</p><Button className="mt-3" variant="outline" onClick={() => void profiles.refetch()}>Tentar novamente</Button></section> : null}
    <div className="space-y-3">{filtered.map((p) => <section key={p.user_id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-muted p-2">{p.avatar_url ? <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <UserRound className="h-6 w-6" />}</div><div className="min-w-0"><h2 className="truncate font-medium">{p.full_name || "Nome não informado"}</h2><p className="truncate text-sm text-muted-foreground">{p.email}</p><p className="truncate text-xs text-muted-foreground">ID: {p.user_id}</p><p className="mt-1 text-xs text-muted-foreground">Situação: {p.account_status} · {p.memberships.length ? p.memberships.map((m) => `${m.association_name}: ${ASSOCIATION_ROLES.find((r) => r.value === m.role)?.label ?? m.role}`).join(" · ") : "Sem vínculo com associação"}</p></div></div>
      <Button variant="outline" onClick={() => startEdit(p)}>Editar perfil</Button>
    </section>)}</div>
    {!profiles.isLoading && !profiles.isError && filtered.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum perfil encontrado.</div> : null}
    {editing ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"><form onSubmit={saveProfile} className="w-full max-w-lg space-y-4 rounded-2xl border bg-card p-6 shadow-xl"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Editar perfil</h2><p className="text-xs text-muted-foreground">{editing.email} · {editing.user_id}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Fechar"><X className="h-4 w-4" /></Button></div>
      <div className="space-y-1"><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" maxLength={160} value={draft.full_name} onChange={(e) => setDraft((v) => ({ ...v, full_name: e.target.value }))} /></div>
      <div className="space-y-1"><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" maxLength={40} value={draft.phone} onChange={(e) => setDraft((v) => ({ ...v, phone: e.target.value }))} /></div>
      <div className="space-y-1"><Label htmlFor="profile-avatar">URL da foto de perfil (opcional)</Label><Input id="profile-avatar" maxLength={2048} type="url" placeholder="https://…" value={draft.avatar_url} onChange={(e) => setDraft((v) => ({ ...v, avatar_url: e.target.value }))} /></div>
      {editing.memberships.length > 0 ? <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> Tipo de perfil na associação</div><div className="space-y-1"><Label htmlFor="profile-association">Associação</Label><select id="profile-association" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.association_id} onChange={(e) => { const membership = editing.memberships.find((m) => m.association_id === e.target.value); setDraft((v) => ({ ...v, association_id: e.target.value, role: membership?.role ?? "" })); }}><option value="">Selecione a associação</option>{editing.memberships.map((m) => <option key={m.association_id} value={m.association_id}>{m.association_name}</option>)}</select></div><div className="space-y-1"><Label htmlFor="profile-role">Tipo de perfil</Label><select id="profile-role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.role} onChange={(e) => setDraft((v) => ({ ...v, role: e.target.value }))} disabled={!draft.association_id}><option value="">Selecione o tipo de perfil</option>{ASSOCIATION_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select><p className="text-xs text-muted-foreground">A associação precisa manter um administrador. A promoção para administrador será recusada se já houver outro.</p></div></div> : <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Este usuário ainda não pertence a nenhuma associação. Para definir seu tipo de perfil, primeiro é necessário vinculá-lo a uma associação.</div>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando…" : <><Save className="mr-2 h-4 w-4" /> Salvar alterações</>}</Button></div>
    </form></div> : null}
  </div>;
}
