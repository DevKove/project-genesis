import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Copy, MailPlus, ShieldCheck, UserMinus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { ROLE_LABELS, type AssocRole } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoinRequestsPanel } from "@/components/app/JoinRequestsPanel";
import type { Database } from "@/integrations/supabase/types";

type MemberRow = Database["public"]["Tables"]["association_members"]["Row"];
type MemberDirectoryRow = Pick<Database["public"]["Views"]["association_member_directory"]["Row"], "user_id" | "full_name">;
type MemberWithProfile = MemberRow & { profile: { full_name: string | null } | null };
type InvitationRow = Database["public"]["Tables"]["invitations"]["Row"];
const PAGE_SIZE = 25;

const ALL_ROLES: AssocRole[] = ["admin", "presidente", "secretario", "tesoureiro", "conselheiro", "funcionario", "morador"];
const INVITABLE_NON_ADMIN_ROLES: AssocRole[] = ["morador", "funcionario", "conselheiro"];

export const Route = createFileRoute("/_authenticated/app/membros")({
  head: () => ({ meta: [{ title: "Membros e convites — Morada360" }] }),
  component: MembersPage,
});

function MembersPage() {
  const { current, userId } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const role = current?.role;
  const canInvite = role === "admin" || role === "presidente" || role === "secretario";
  const canManageMembers = role === "admin";
  const allowedInviteRoles = role === "admin" ? ALL_ROLES : INVITABLE_NON_ADMIN_ROLES;
  const [page, setPage] = useState(0);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [cancelingInvite, setCancelingInvite] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AssocRole>>({});
  const [memberToRemove, setMemberToRemove] = useState<MemberWithProfile | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<InvitationRow | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{ email: string; link: string; expiresAt: string } | null>(null);

  const members = useQuery({
    queryKey: ["members", associationId, page],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return { items: [] as MemberWithProfile[], count: 0 };
      const { data, error, count } = await supabase
        .from("association_members")
        .select("id,association_id,user_id,role,created_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("created_at", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;

      const rows = data ?? [];
      const userIds = [...new Set(rows.map((member) => member.user_id))];
      let directory: MemberDirectoryRow[] = [];
      if (userIds.length) {
        const { data: directoryData, error: directoryError } = await supabase
          .from("association_member_directory")
          .select("user_id,full_name")
          .eq("association_id", associationId)
          .in("user_id", userIds);
        if (directoryError) throw directoryError;
        directory = (directoryData ?? []) as MemberDirectoryRow[];
      }

      return {
        items: rows.map((member) => {
          const entry = directory.find((item) => item.user_id === member.user_id);
          return { ...member, profile: entry ? { full_name: entry.full_name } : null };
        }),
        count: count ?? 0,
      };
    },
  });

  const associationCode = useQuery({
    queryKey: ["association-code", associationId],
    enabled: Boolean(associationId && role === "admin"),
    queryFn: async () => {
      if (!associationId) return null;
      const { data, error } = await supabase
        .from("associations")
        .select("association_code")
        .eq("id", associationId)
        .single();
      if (error) throw error;
      return data.association_code;
    },
  });

  const invitations = useQuery({
    queryKey: ["invitations", associationId],
    enabled: Boolean(associationId && canInvite),
    queryFn: async () => {
      if (!associationId) return [] as InvitationRow[];
      const { data, error } = await supabase
        .from("invitations")
        .select("id,association_id,email,role,status,expires_at,created_at,invited_by,token")
        .eq("association_id", associationId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as InvitationRow[];
    },
  });

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !canInvite) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const inviteRole = String(form.get("role") ?? "morador") as AssocRole;
    if (!email || !allowedInviteRoles.includes(inviteRole)) {
      toast.error("Confira o e-mail e o papel selecionado.");
      return;
    }

    setSavingInvite(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from("invitations")
        .select("id")
        .eq("association_id", associationId)
        .eq("status", "pendente")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        toast.error("Já existe um convite pendente para esse e-mail. Cancele-o antes de criar outro.");
        return;
      }

      const { data, error } = await supabase
        .from("invitations")
        .insert({ association_id: associationId, email, role: inviteRole, invited_by: userId })
        .select("id,email,role,token,expires_at")
        .single();
      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um convite pendente para esse e-mail nesta associação.");
          return;
        }
        throw error;
      }

      const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
      const inviteUrl = new URL("convite", appBase);
      inviteUrl.searchParams.set("token", data.token);
      setCreatedInvite({ email: data.email, link: inviteUrl.toString(), expiresAt: data.expires_at });
      setInviteFormOpen(false);
      toast.success("Convite criado. Copie o link para enviá-lo ao destinatário.");
      await queryClient.invalidateQueries({ queryKey: ["invitations", associationId] });
    } catch {
      toast.error("Não foi possível criar o convite. Verifique o papel permitido e suas permissões.");
    } finally {
      setSavingInvite(false);
    }
  }

  async function copyInviteLink() {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(createdInvite.link);
      toast.success("Link do convite copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione e copie o link exibido.");
    }
  }

  async function saveRole(member: MemberWithProfile) {
    if (!associationId || !canManageMembers || member.user_id === userId) return;
    const nextRole = roleDrafts[member.id] ?? member.role;
    if (nextRole === member.role) return;
    setChangingRole(member.id);
    try {
      const { data, error } = await supabase
        .from("association_members")
        .update({ role: nextRole })
        .eq("id", member.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) {
        if (error.code === "42501") {
          toast.error("A associação precisa manter pelo menos um administrador.");
          return;
        }
        throw error;
      }
      if (!data) {
        toast.error("Vínculo não encontrado ou sem permissão para alterá-lo.");
        return;
      }
      setRoleDrafts((drafts) => {
        const next = { ...drafts };
        delete next[member.id];
        return next;
      });
      toast.success("Papel do membro atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["members", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["memberships", userId] });
    } catch {
      toast.error("Não foi possível alterar o papel deste membro.");
    } finally {
      setChangingRole(null);
    }
  }

  async function removeMember(member: MemberWithProfile) {
    if (!associationId || !canManageMembers || member.user_id === userId) return;
    setRemovingMember(member.id);
    try {
      const { data, error } = await supabase
        .from("association_members")
        .delete()
        .eq("id", member.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) {
        if (error.code === "42501") {
          toast.error("Não é possível remover o último administrador da associação.");
          return;
        }
        throw error;
      }
      if (!data) {
        toast.error("Vínculo não encontrado ou sem permissão para removê-lo.");
        return;
      }
      setMemberToRemove(null);
      toast.success("Membro removido da associação.");
      await queryClient.invalidateQueries({ queryKey: ["members", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível remover o membro.");
    } finally {
      setRemovingMember(null);
    }
  }

  async function cancelInvitation(invitation: InvitationRow) {
    if (!associationId || !canInvite) return;
    setCancelingInvite(invitation.id);
    try {
      const { data, error } = await supabase
        .from("invitations")
        .update({ status: "cancelado" })
        .eq("id", invitation.id)
        .eq("association_id", associationId)
        .eq("status", "pendente")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("O convite não está mais pendente ou você não tem permissão para cancelá-lo.");
        return;
      }
      setInviteToCancel(null);
      setCreatedInvite(null);
      toast.success("Convite cancelado.");
      await queryClient.invalidateQueries({ queryKey: ["invitations", associationId] });
    } catch {
      toast.error("Não foi possível cancelar o convite.");
    } finally {
      setCancelingInvite(null);
    }
  }

  if (!current) return null;
  const totalMembers = members.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Membros e convites"
        description="Consulte os membros da associação e gerencie acessos conforme seu papel."
        action={canInvite ? <Button onClick={() => { setInviteFormOpen(true); setCreatedInvite(null); }}><MailPlus className="mr-2 h-4 w-4" /> Convidar membro</Button> : undefined}
      />

      {canManageMembers && associationCode.data && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">Código da associação</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compartilhe este código de 6 dígitos com quem precisa solicitar acesso.</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-[0.25em]">{associationCode.data}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => {
            void navigator.clipboard.writeText(associationCode.data ?? "").then(
              () => toast.success("Código copiado."),
              () => toast.error("Não foi possível copiar automaticamente. Anote o código exibido."),
            );
          }}><Copy className="mr-2 h-4 w-4" /> Copiar código</Button>
        </section>
      )}

      {associationId && <JoinRequestsPanel associationId={associationId} userId={userId} canManage={role === "admin"} />}

      {createdInvite && (
        <section className="mb-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Convite criado para {createdInvite.email}</h2>
              <p className="mt-1 text-sm text-muted-foreground">O sistema ainda não envia e-mails automaticamente. Copie o link e envie ao destinatário por um canal seguro. Validade: {new Date(createdInvite.expiresAt).toLocaleDateString("pt-BR")}.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar link do convite" onClick={() => setCreatedInvite(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Link do convite" readOnly value={createdInvite.link} onFocus={(event) => event.currentTarget.select()} />
            <Button type="button" onClick={() => void copyInviteLink()}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button>
          </div>
        </section>
      )}

      {inviteFormOpen && canInvite && (
        <form onSubmit={createInvitation} className="mb-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Convidar para a associação</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário de convite" onClick={() => setInviteFormOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="invite-email">E-mail do convidado *</Label><Input id="invite-email" name="email" type="email" maxLength={254} required placeholder="pessoa@exemplo.com" /></div>
            <div><Label htmlFor="invite-role">Papel inicial *</Label><select id="invite-role" name="role" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="morador">{allowedInviteRoles.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></div>
          </div>
          <p className="text-xs text-muted-foreground">O convite expira em 14 dias. Presidentes e secretários podem convidar moradores, funcionários e conselheiros; somente administradores podem conceder papéis de liderança.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={savingInvite}>{savingInvite ? "Criando convite…" : "Criar convite"}</Button>
            <Button type="button" variant="outline" onClick={() => setInviteFormOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {memberToRemove && canManageMembers && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Remover <strong>{memberToRemove.profile?.full_name || "este membro"}</strong> da associação? O acesso será revogado, mas os registros de auditoria serão preservados.</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={removingMember === memberToRemove.id} onClick={() => void removeMember(memberToRemove)}>{removingMember === memberToRemove.id ? "Removendo…" : "Confirmar remoção"}</Button>
            <Button variant="outline" size="sm" disabled={Boolean(removingMember)} onClick={() => setMemberToRemove(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {inviteToCancel && canInvite && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Cancelar o convite enviado para <strong>{inviteToCancel.email}</strong>? O link deixará de ser válido.</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={cancelingInvite === inviteToCancel.id} onClick={() => void cancelInvitation(inviteToCancel)}>{cancelingInvite === inviteToCancel.id ? "Cancelando…" : "Cancelar convite"}</Button>
            <Button variant="outline" size="sm" disabled={Boolean(cancelingInvite)} onClick={() => setInviteToCancel(null)}>Voltar</Button>
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Membros</h2>
          <span className="text-sm text-muted-foreground">{totalMembers} membro(s)</span>
        </div>
        {members.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível carregar os membros. <Button variant="link" className="px-0" onClick={() => void members.refetch()}>Tentar novamente</Button></div>}
        <div className="overflow-hidden rounded-xl border bg-card">
          {members.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando membros…</p> : members.data?.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Membro</th><th className="px-4 py-3 font-medium">Papel</th><th className="px-4 py-3 font-medium">Desde</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr></thead>
                <tbody className="divide-y">
                  {members.data.items.map((member) => {
                    const draftRole = roleDrafts[member.id] ?? member.role;
                    const isSelf = member.user_id === userId;
                    return (
                      <tr key={member.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3"><div className="font-medium">{member.profile?.full_name || "Nome não informado"}</div><div className="text-xs text-muted-foreground">{member.profile ? "Perfil cadastrado" : "Perfil não preenchido"}{isSelf ? " · Você" : ""}</div></td>
                        <td className="px-4 py-3">
                          {canManageMembers && !isSelf ? <select aria-label={`Papel de ${member.profile?.full_name || member.user_id}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={draftRole} onChange={(event) => setRoleDrafts((drafts) => ({ ...drafts, [member.id]: event.target.value as AssocRole }))}>{ALL_ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select> : <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{ROLE_LABELS[member.role] ?? member.role}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(member.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3"><div className="flex justify-end gap-1">
                          {canManageMembers && !isSelf && draftRole !== member.role && <Button size="sm" disabled={changingRole === member.id} onClick={() => void saveRole(member)}>{changingRole === member.id ? "Salvando…" : <><Check className="mr-1 h-4 w-4" /> Salvar papel</>}</Button>}
                          {canManageMembers && !isSelf && <Button variant="ghost" size="icon" aria-label={`Remover ${member.profile?.full_name || "membro"}`} onClick={() => setMemberToRemove(member)}><UserMinus className="h-4 w-4 text-destructive" /></Button>}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState><p>Nenhum membro encontrado.</p></EmptyState>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || members.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || members.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </div>
      </section>

      {canInvite && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Convites</h2><span className="text-sm text-muted-foreground">{invitations.data?.length ?? 0} registro(s)</span></div>
          {invitations.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível carregar os convites. <Button variant="link" className="px-0" onClick={() => void invitations.refetch()}>Tentar novamente</Button></div>}
          <div className="overflow-hidden rounded-xl border bg-card">
            {invitations.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando convites…</p> : invitations.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3 font-medium">E-mail</th><th className="px-4 py-3 font-medium">Papel</th><th className="px-4 py-3 font-medium">Situação</th><th className="px-4 py-3 font-medium">Expira em</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr></thead>
                  <tbody className="divide-y">
                    {invitations.data.map((invite) => {
                      const expired = invite.status === "pendente" && new Date(invite.expires_at).getTime() <= Date.now();
                      const statusLabel = expired ? "Expirado" : invite.status === "aceito" ? "Aceito" : invite.status === "cancelado" ? "Cancelado" : "Pendente";
                      const link = new URL("convite", new URL(import.meta.env.BASE_URL, window.location.origin));
                      link.searchParams.set("token", invite.token);
                      return (
                        <tr key={invite.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{invite.email}</td>
                          <td className="px-4 py-3">{ROLE_LABELS[invite.role] ?? invite.role}</td>
                          <td className="px-4 py-3"><span className={expired || invite.status === "cancelado" ? "rounded-full bg-muted px-2.5 py-1 text-xs" : invite.status === "aceito" ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700" : "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs"}>{statusLabel}</span></td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(invite.expires_at).toLocaleDateString("pt-BR")}</td>
                          <td className="px-4 py-3"><div className="flex justify-end gap-1">
                            {invite.status === "pendente" && !expired && <Button variant="ghost" size="icon" aria-label={`Copiar convite para ${invite.email}`} onClick={() => { setCreatedInvite({ email: invite.email, link: link.toString(), expiresAt: invite.expires_at }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Copy className="h-4 w-4" /></Button>}
                            {invite.status === "pendente" && <Button variant="ghost" size="icon" aria-label={`Cancelar convite para ${invite.email}`} onClick={() => setInviteToCancel(invite)}><X className="h-4 w-4 text-destructive" /></Button>}
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState><p>Nenhum convite registrado.</p></EmptyState>}
          </div>
        </section>
      )}
    </>
  );
}
