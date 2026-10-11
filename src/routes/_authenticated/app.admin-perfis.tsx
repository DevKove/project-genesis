import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldCheck, UserRound, Save, Users, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/app/admin-perfis")({
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        if (alive) void navigate({ to: "/auth" });
        return;
      }
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "platform_admin").maybeSingle();
      if (alive) setIsAdmin(!error && Boolean(data));
    })();
    return () => { alive = false; };
  }, [navigate]);

  const profiles = useQuery({
    queryKey: ["platform-admin-profiles"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_user_profiles");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        memberships: Array.isArray(p.memberships) ? (p.memberships as unknown as Membership[]) : [],
      }));
    },
  });

  function startEdit(profile: ProfileRow) {
    const firstMembership = profile.memberships[0];
    setEditing(profile);
    setAvatarFile(null);
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
    let uploadedAvatarPath: string | null = null;
    try {
      let avatarUrlToSave = draft.avatar_url.trim() || null;
      if (avatarFile) {
        const allowedTypes: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        };
        const extension = allowedTypes[avatarFile.type];
        if (!extension) throw new Error("Formato inválido. Selecione uma imagem JPG, JPEG, PNG, WEBP ou GIF.");
        if (avatarFile.size > 2 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 2 MB.");
        const objectPath = `${editing.user_id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(objectPath, avatarFile, {
          contentType: avatarFile.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadError) throw new Error(`Não foi possível enviar a foto: ${uploadError.message}`);
        uploadedAvatarPath = objectPath;
        avatarUrlToSave = supabase.storage.from("profile-avatars").getPublicUrl(objectPath).data.publicUrl;
      }

      const { data: updatedProfile, error: profileError } = await supabase.from("profiles").update({
        full_name: draft.full_name.trim() || null,
        phone: draft.phone.trim() || null,
        avatar_url: avatarUrlToSave,
        updated_at: new Date().toISOString(),
      }).eq("id", editing.user_id).select("id").maybeSingle();
      if (profileError) throw profileError;
      if (!updatedProfile) throw new Error("Perfil não encontrado ou sem permissão para editar.");

      const oldAvatarMarker = "/storage/v1/object/public/profile-avatars/";
      const oldAvatarPath = editing.avatar_url?.includes(oldAvatarMarker)
        ? editing.avatar_url.split(oldAvatarMarker)[1]
        : null;
      if (oldAvatarPath && editing.avatar_url !== avatarUrlToSave) {
        const { error: cleanupError } = await supabase.storage.from("profile-avatars").remove([oldAvatarPath]);
        if (cleanupError) console.error("[admin-perfis] Não foi possível remover a foto antiga:", cleanupError);
      }
      // The uploaded object is now referenced by the saved profile and must not
      // be removed if a later role update fails.
      uploadedAvatarPath = null;

      const originalMembership = editing.memberships.find((m) => m.association_id === draft.association_id);
      if (draft.association_id && draft.role && originalMembership?.role !== draft.role) {
        const { error: roleError } = await supabase.rpc("admin_update_association_member_role", {
          _user_id: editing.user_id,
          _association_id: draft.association_id,
          _new_role: draft.role,
        });
        if (roleError) throw roleError;
      }
      toast.success("Perfil atualizado com sucesso.");
      setEditing(null);
      setAvatarFile(null);
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-profiles"] });
    } catch (error) {
      if (uploadedAvatarPath) {
        try {
          const { error: cleanupError } = await supabase.storage.from("profile-avatars").remove([uploadedAvatarPath]);
          if (cleanupError) console.error("[admin-perfis] Não foi possível limpar a foto temporária:", cleanupError);
        } catch (cleanupError) {
          console.error("[admin-perfis] Erro ao limpar a foto temporária:", cleanupError);
        }
      }
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-profiles"] });
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === null) return <div className="p-8 text-sm text-muted-foreground">Verificando permissões administrativas…</div>;
  if (!isAdmin) return <section className="rounded-lg border bg-card p-8"><ShieldCheck className="mb-3 h-8 w-8 text-destructive" /><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador principal pode gerenciar todos os perfis.</p><Button className="mt-5" variant="outline" onClick={() => void navigate({ to: "/app" })}>Voltar ao painel</Button></section>;

  const filtered = (profiles.data ?? []).filter((p) => [p.email, p.full_name ?? "", p.phone ?? "", p.user_id, p.account_status, ...p.memberships.map((m) => m.association_name), ...p.memberships.map((m) => m.role)].some((v) => v.toLowerCase().includes(search.toLowerCase())));

  return <div className="space-y-6">
    <PageHeader title="Gerenciar perfis" description="Edite dados pessoais e o tipo de perfil dos usuários nas associações." />
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-muted-foreground">Somente o administrador principal pode editar esses dados. A função de administrador principal da plataforma é protegida separadamente; os tipos abaixo correspondem aos papéis de cada usuário dentro de uma associação.</p></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar perfis" className="pl-9" placeholder="Buscar por nome, e-mail, associação ou tipo de perfil…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    {profiles.isLoading ? <p className="text-sm text-muted-foreground">Carregando perfis…</p> : null}
    {profiles.isError ? <section className="rounded-lg border p-5"><p className="text-sm text-destructive">Não foi possível carregar os perfis. Verifique as permissões do banco de dados.</p><Button className="mt-3" variant="outline" onClick={() => void profiles.refetch()}>Tentar novamente</Button></section> : null}
    <div className="space-y-3">{filtered.map((p) => <section key={p.user_id} className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-muted p-2">{p.avatar_url ? <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <UserRound className="h-6 w-6" />}</div><div className="min-w-0"><h2 className="truncate font-medium">{p.full_name || "Nome não informado"}</h2><p className="truncate text-sm text-muted-foreground">{p.email}</p><p className="truncate text-xs text-muted-foreground">ID: {p.user_id}</p><p className="mt-1 text-xs text-muted-foreground">Situação: {p.account_status} · {p.memberships.length ? p.memberships.map((m) => `${m.association_name}: ${ASSOCIATION_ROLES.find((r) => r.value === m.role)?.label ?? m.role}`).join(" · ") : "Sem vínculo com associação"}</p></div></div>
      <Button variant="outline" onClick={() => startEdit(p)}>Editar perfil</Button>
    </section>)}</div>
    {!profiles.isLoading && !profiles.isError && filtered.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum perfil encontrado.</div> : null}
    {editing ? <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent><form onSubmit={saveProfile} className="space-y-4"><div className="flex items-center justify-between gap-3"><div><DialogTitle>Editar perfil</DialogTitle><DialogDescription className="break-all">{editing.email} · {editing.user_id}</DialogDescription></div></div>
      <div className="space-y-1"><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" maxLength={160} value={draft.full_name} onChange={(e) => setDraft((v) => ({ ...v, full_name: e.target.value }))} /></div>
      <div className="space-y-1"><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" maxLength={40} value={draft.phone} onChange={(e) => setDraft((v) => ({ ...v, phone: e.target.value }))} /></div>
      <div className="space-y-3">
        <Label htmlFor="profile-avatar-file">Foto de perfil (opcional)</Label>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
            {avatarPreview || draft.avatar_url ? <img src={avatarPreview || draft.avatar_url} alt="Pré-visualização da foto de perfil" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <Input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm" onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (!file) return;
              const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
              if (!allowed.includes(file.type)) {
                toast.error("Formato inválido. Selecione JPG, JPEG, PNG, WEBP ou GIF.");
                e.currentTarget.value = "";
                return;
              }
              if (file.size > 2 * 1024 * 1024) {
                toast.error("A imagem deve ter no máximo 2 MB.");
                e.currentTarget.value = "";
                return;
              }
              setAvatarFile(file);
            }} />
            <p className="text-xs text-muted-foreground">JPG, JPEG, PNG, WEBP ou GIF · máximo de 2 MB.</p>
            {avatarFile ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><ImagePlus className="h-3.5 w-3.5" /><span className="truncate">{avatarFile.name}</span><Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => { setAvatarFile(null); const input = document.getElementById("profile-avatar-file") as HTMLInputElement | null; if (input) input.value = ""; }} aria-label="Remover nova foto selecionada"><X className="h-3.5 w-3.5" /> Remover</Button></div> : null}
          </div>
        </div>
        <div className="space-y-1"><Label htmlFor="profile-avatar">Ou informe uma URL de imagem</Label><Input id="profile-avatar" maxLength={2048} type="url" placeholder="https://…" value={draft.avatar_url} onChange={(e) => { setDraft((v) => ({ ...v, avatar_url: e.target.value })); if (avatarFile) { setAvatarFile(null); const input = document.getElementById("profile-avatar-file") as HTMLInputElement | null; if (input) input.value = ""; } }} /></div>
      </div>
      {editing.memberships.length > 0 ? <div className="space-y-3 rounded-lg border p-4"><div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> Tipo de perfil na associação</div><div className="space-y-1"><Label htmlFor="profile-association">Associação</Label><select id="profile-association" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.association_id} onChange={(e) => { const membership = editing.memberships.find((m) => m.association_id === e.target.value); setDraft((v) => ({ ...v, association_id: e.target.value, role: membership?.role ?? "" })); }}><option value="">Selecione a associação</option>{editing.memberships.map((m) => <option key={m.association_id} value={m.association_id}>{m.association_name}</option>)}</select></div><div className="space-y-1"><Label htmlFor="profile-role">Tipo de perfil</Label><select id="profile-role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.role} onChange={(e) => setDraft((v) => ({ ...v, role: e.target.value }))} disabled={!draft.association_id}><option value="">Selecione o tipo de perfil</option>{ASSOCIATION_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select><p className="text-xs text-muted-foreground">A associação precisa manter um administrador. A promoção para administrador será recusada se já houver outro.</p></div></div> : <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Este usuário ainda não pertence a nenhuma associação. Para definir seu tipo de perfil, primeiro é necessário vinculá-lo a uma associação.</div>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando…" : <><Save className="mr-2 h-4 w-4" /> Salvar alterações</>}</Button></div>
    </form></DialogContent></Dialog> : null}
  </div>;
}
