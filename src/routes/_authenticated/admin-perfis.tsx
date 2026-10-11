import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldCheck, UserRound, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/admin-perfis")({
  head: () => ({ meta: [{ title: "Gerenciar perfis — Morada360" }] }),
  component: AdminProfilesPage,
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  account_status: string;
  created_at: string;
};

function AdminProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [draft, setDraft] = useState({ full_name: "", phone: "", avatar_url: "" });
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
      const { data, error } = await db.from("profiles").select("id,full_name,phone,avatar_url,account_status,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  function startEdit(profile: ProfileRow) {
    setEditing(profile);
    setDraft({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !isAdmin) return;
    setSaving(true);
    try {
      const { error } = await db.from("profiles").update({
        full_name: draft.full_name.trim() || null,
        phone: draft.phone.trim() || null,
        avatar_url: draft.avatar_url.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
      if (error) throw error;
      toast.success("Perfil atualizado com sucesso.");
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-profiles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === null) return <div className="p-8 text-sm text-muted-foreground">Verificando permissões administrativas…</div>;
  if (!isAdmin) return <section className="rounded-xl border bg-card p-8"><ShieldCheck className="mb-3 h-8 w-8 text-destructive" /><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador principal pode gerenciar todos os perfis.</p><Button className="mt-5" variant="outline" onClick={() => void navigate({ to: "/app" })}>Voltar ao painel</Button></section>;

  const filtered = (profiles.data ?? []).filter((p) => [p.full_name ?? "", p.phone ?? "", p.id, p.account_status].some((v) => v.toLowerCase().includes(search.toLowerCase())));

  return <div className="space-y-6">
    <PageHeader title="Gerenciar perfis" description="O administrador principal pode editar os dados de perfil de qualquer usuário, a qualquer momento." />
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-muted-foreground">É possível editar nome, telefone e URL da foto. O estado de aprovação e as permissões de acesso são protegidos separadamente para evitar alterações acidentais.</p></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, telefone, ID ou situação…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    {profiles.isLoading ? <p className="text-sm text-muted-foreground">Carregando perfis…</p> : null}
    {profiles.isError ? <section className="rounded-xl border p-5"><p className="text-sm text-destructive">Não foi possível carregar os perfis. Verifique as permissões do banco de dados.</p><Button className="mt-3" variant="outline" onClick={() => void profiles.refetch()}>Tentar novamente</Button></section> : null}
    <div className="space-y-3">{filtered.map((p) => <section key={p.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-muted p-2">{p.avatar_url ? <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <UserRound className="h-6 w-6" />}</div><div className="min-w-0"><h2 className="truncate font-medium">{p.full_name || "Nome não informado"}</h2><p className="truncate text-xs text-muted-foreground">ID: {p.id}</p><p className="mt-1 text-xs text-muted-foreground">Situação: {p.account_status} · Cadastro: {new Date(p.created_at).toLocaleDateString("pt-BR")}</p></div></div>
      <Button variant="outline" onClick={() => startEdit(p)}>Editar perfil</Button>
    </section>)}</div>
    {!profiles.isLoading && !profiles.isError && filtered.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum perfil encontrado.</div> : null}
    {editing ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"><form onSubmit={saveProfile} className="w-full max-w-lg space-y-4 rounded-2xl border bg-card p-6 shadow-xl"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Editar perfil</h2><p className="text-xs text-muted-foreground">{editing.id}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Fechar"><X className="h-4 w-4" /></Button></div>
      <div className="space-y-1"><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" maxLength={160} value={draft.full_name} onChange={(e) => setDraft((v) => ({ ...v, full_name: e.target.value }))} /></div>
      <div className="space-y-1"><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" maxLength={40} value={draft.phone} onChange={(e) => setDraft((v) => ({ ...v, phone: e.target.value }))} /></div>
      <div className="space-y-1"><Label htmlFor="profile-avatar">URL da foto de perfil (opcional)</Label><Input id="profile-avatar" maxLength={2048} type="url" placeholder="https://…" value={draft.avatar_url} onChange={(e) => setDraft((v) => ({ ...v, avatar_url: e.target.value }))} /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando…" : <><Save className="mr-2 h-4 w-4" /> Salvar alterações</>}</Button></div>
    </form></div> : null}
  </div>;
}
