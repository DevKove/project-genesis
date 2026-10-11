import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, ClipboardList, FileText, History, Home, LayoutDashboard, LogOut, Megaphone, Settings, UserCog, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AssocProvider, useAssoc } from "@/lib/assoc-context";
import { isManager, ROLE_LABELS } from "@/lib/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoAssociationAccess } from "@/components/app/NoAssociationAccess";
import { NotificationCenter } from "@/components/app/NotificationCenter";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Painel — Morada360" }, { name: "description", content: "Painel de gestão da associação." }] }),
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AssocProvider userId={user.id}>
      <Shell email={user.email ?? ""} userId={user.id} />
    </AssocProvider>
  );
}

function Shell({ email, userId }: { email: string; userId: string }) {
  const { memberships, current, setCurrentId, loading, error, refetch } = useAssoc();
  const navigate = useNavigate();
  const platformAdmin = useQuery({
    queryKey: ["platform-admin-role", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "platform_admin").maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    refetchInterval: 60000,
  });
  const pendingJoinRequests = useQuery({
    queryKey: ["association-join-requests-count", current?.association_id],
    enabled: Boolean(current?.association_id && current.role === "admin"),
    queryFn: async () => {
      if (!current) return 0;
      const { count, error } = await supabase
        .from("association_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("association_id", current.association_id)
        .eq("status", "pendente");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando associações…</div>;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-soft">
          <h1 className="text-xl font-semibold">Não foi possível carregar suas associações</h1>
          <p className="mt-2 text-sm text-muted-foreground">Verifique sua conexão e as permissões da conta. Nenhum cadastro será iniciado enquanto esses dados não forem carregados.</p>
          <button className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void refetch()}>Tentar novamente</button>
          <button className="ml-3 mt-5 text-sm text-muted-foreground hover:text-foreground" onClick={() => void supabase.auth.signOut()}>Sair</button>
        </div>
      </div>
    );
  }

  if (!current) {
    if (platformAdmin.data) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <section className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-soft">
            <ShieldCheck className="mb-4 h-9 w-9 text-primary" />
            <h1 className="text-2xl font-semibold">Administração principal</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua conta tem permissão de administrador da plataforma, mas ainda não está vinculada a uma associação. Você pode analisar e aprovar novos cadastros por aqui.</p>
            <Link to="/admin-aprovacoes" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><ShieldCheck className="h-4 w-4" /> Aprovar cadastros</Link>
            <button onClick={() => void supabase.auth.signOut()} className="ml-3 rounded-lg border px-4 py-2 text-sm">Sair</button>
          </section>
        </div>
      );
    }
    return <NoAssociationAccess userId={userId} />;
  }

  const nav = [
    { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
    { to: "/app/unidades", label: "Unidades", icon: Home, exact: false },
    { to: "/app/moradores", label: "Moradores", icon: Users, exact: false },
    { to: "/app/comunicados", label: "Comunicados", icon: Megaphone, exact: false },
    { to: "/app/documentos", label: "Documentos", icon: FileText, exact: false },
    { to: "/app/ocorrencias", label: "Ocorrências", icon: AlertTriangle, exact: false },
    { to: "/app/solicitacoes", label: "Solicitações", icon: ClipboardList, exact: false },
    { to: "/app/membros", label: "Membros", icon: UserCog, exact: false },
    { to: "/app/auditoria", label: "Auditoria", icon: History, exact: false },
    { to: "/app/prestadores", label: "Prestadores", icon: Building2, exact: false },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings, exact: false },
    ...(platformAdmin.data ? [{ to: "/admin-aprovacoes", label: "Aprovar cadastros", icon: ShieldCheck, exact: false }, { to: "/admin-perfis", label: "Gerenciar perfis", icon: UserCog, exact: false }] : []),
  ] as const;
  const visibleNav = nav.filter((item) => (item.to !== "/app/auditoria" && item.to !== "/app/configuracoes") || current.role === "admin" || current.role === "presidente");
  const associationLogo = current.associations?.logo_url;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="mb-6 flex min-w-0 items-center gap-2 px-2 text-lg font-semibold">
          {associationLogo ? <img src={associationLogo} alt="" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5" /> : <Building2 className="h-5 w-5 shrink-0 text-sidebar-primary" />}
          <span className="truncate">{current.associations?.name ?? "Morada360"}</span>
        </div>
        <Select value={current.association_id} onValueChange={(v) => (v === "__new" ? navigate({ to: "/app/nova" }) : setCurrentId(v))}>
          <SelectTrigger className="mb-6 border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            {memberships.map((m) => <SelectItem key={m.association_id} value={m.association_id}>{m.associations?.name ?? "Associação sem nome"}</SelectItem>)}
            <SelectItem value="__new">+ Nova associação</SelectItem>
          </SelectContent>
        </Select>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {visibleNav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.exact }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" }}>
              <n.icon className="h-4 w-4 shrink-0" /> {n.label}{n.to === "/app/membros" && current.role === "admin" && (pendingJoinRequests.data ?? 0) > 0 ? <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{pendingJoinRequests.data}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4 text-xs">
          <div className="truncate px-2">{email}</div>
          <div className="px-2 text-sidebar-primary">{ROLE_LABELS[current.role] ?? current.role}</div>
          <button onClick={() => void supabase.auth.signOut()} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" /> Sair</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {associationLogo ? <img src={associationLogo} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" /> : null}
            <span className="truncate font-semibold">{current.associations?.name ?? "Morada360"}</span>
          </div>
          <select aria-label="Navegação" className="max-w-[45%] rounded border bg-background px-2 py-2 text-sm" value="" onChange={(e) => e.target.value && navigate({ to: e.target.value as any })}>
            <option value="">Menu</option>
            {visibleNav.map((n) => <option key={n.to} value={n.to}>{n.label}{n.to === "/app/membros" && current.role === "admin" && (pendingJoinRequests.data ?? 0) > 0 ? ` (${pendingJoinRequests.data})` : ""}</option>)}
          </select>
        </div>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10"><div className="mb-4 flex justify-end"><NotificationCenter userId={userId} /></div><Outlet key={current.association_id} /></main>
      </div>
    </div>
  );
}
