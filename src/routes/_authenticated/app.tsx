import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, ClipboardList, FileText, History, Home, LayoutDashboard, LogOut, Megaphone, Settings, UserCog, Users, ShieldCheck, Menu, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AssocProvider, useAssoc } from "@/lib/assoc-context";
import { ROLE_LABELS, canManageAnnouncements, canManageIncidents, canManageResidents, canManageServiceRequests, canManageUnits, canManageVendors, canSeeAudit, canInvite } from "@/lib/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
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
          <Button className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void refetch()}>Tentar novamente</Button>
          <Button className="ml-3 mt-5 text-sm text-muted-foreground hover:text-foreground" onClick={() => void supabase.auth.signOut()}>Sair</Button>
        </div>
      </div>
    );
  }

  if (!current) {
    if (platformAdmin.data) {
      // The association shell must not swallow nested platform-admin routes.
      // Render the child route directly when the platform administrator has no association.
      if (pathname.includes("/app/admin-aprovacoes") || pathname.includes("/app/admin-perfis") || pathname.includes("/app/nova")) {
        return (
          <div className="min-h-screen bg-background">
            <header className="flex min-h-16 items-center justify-between border-b px-4 sm:px-8">
              <Link to="/app" className="flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5 text-primary" /> Morada360 <span className="text-muted-foreground">/ Administração principal</span></Link>
              <Button variant="outline" onClick={() => void supabase.auth.signOut()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
            </header>
            <main className="mx-auto max-w-[1200px] p-4 sm:p-8"><Outlet /></main>
          </div>
        );
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <section className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-soft">
            <ShieldCheck className="mb-4 h-9 w-9 text-primary" />
            <h1 className="text-2xl font-semibold">Administração principal</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua conta tem permissão de administrador da plataforma, mas ainda não está vinculada a uma associação. Você pode analisar e aprovar novos cadastros por aqui.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link to="/app/admin-aprovacoes" className="flex items-center gap-3 rounded-xl border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-muted/40">
                <span className="rounded-lg bg-primary/10 p-3 text-primary"><ShieldCheck className="h-5 w-5" /></span>
                <span><span className="block font-semibold">Aprovar cadastros</span><span className="mt-1 block text-xs text-muted-foreground">Analisar e liberar novas contas</span></span>
              </Link>
              <Link to="/app/admin-perfis" className="flex items-center gap-3 rounded-xl border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-muted/40">
                <span className="rounded-lg bg-primary/10 p-3 text-primary"><UserCog className="h-5 w-5" /></span>
                <span><span className="block font-semibold">Gerenciar perfis</span><span className="mt-1 block text-xs text-muted-foreground">Consultar e administrar usuários</span></span>
              </Link>
              <Link to="/app/nova" className="flex items-center gap-3 rounded-xl border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-muted/40">
                <span className="rounded-lg bg-primary/10 p-3 text-primary"><Building2 className="h-5 w-5" /></span>
                <span><span className="block font-semibold">Cadastrar associação</span><span className="mt-1 block text-xs text-muted-foreground">Iniciar o cadastro de uma associação</span></span>
              </Link>
            </div>
            <Button onClick={() => void supabase.auth.signOut()} className="mt-5 rounded-lg border px-4 py-2 text-sm">Sair da conta</Button>
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
    ...(platformAdmin.data ? [{ to: "/app/admin-aprovacoes", label: "Aprovar cadastros", icon: ShieldCheck, exact: false }, { to: "/app/admin-perfis", label: "Gerenciar perfis", icon: UserCog, exact: false }] : []),
  ] as const;
  const role = current.role;
  const visibleNav = nav.filter((item) => {
    if (item.to === "/app/admin-aprovacoes" || item.to === "/app/admin-perfis") return Boolean(platformAdmin.data);
    if (item.to === "/app/auditoria") return canSeeAudit(role);
    if (item.to === "/app/configuracoes") return role === "admin" || role === "presidente";
    if (item.to === "/app/unidades") return canManageUnits(role);
    if (item.to === "/app/moradores") return canManageResidents(role);
    if (item.to === "/app/comunicados") return true;
    if (item.to === "/app/documentos") return true;
    if (item.to === "/app/ocorrencias") return true;
    if (item.to === "/app/solicitacoes") return true;
    if (item.to === "/app/membros") return role === "admin" || canInvite(role);
    if (item.to === "/app/prestadores") return canManageVendors(role);
    return true;
  });
  const associationLogo = current.associations?.logo_url;

  const activePage = visibleNav.find((item) => item.exact ? pathname.replace(/\/$/, "") === item.to : pathname.startsWith(item.to))?.label ?? "Associação";
  function navigationContent(mobile = false) {
    return <>
      <Link to="/app" onClick={() => setMobileOpen(false)} className="mb-7 flex items-center gap-3 px-2 text-xl font-bold tracking-tight">
        <span className="app-shell-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-emerald-200"><Building2 className="h-5 w-5" /></span>
        Morada360
      </Link>
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-inner">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          {associationLogo ? <img src={associationLogo} alt="" className="h-8 w-8 shrink-0 rounded-md bg-paper object-contain p-1" /> : <Building2 className="h-5 w-5 shrink-0 text-sidebar-primary" />}
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{current?.associations?.name ?? "Associação"}</p><p className="mt-0.5 text-xs text-sidebar-foreground/80">{platformAdmin.data ? "Administrador da plataforma" : ROLE_LABELS[current?.role ?? "morador"] ?? current?.role}</p></div>
        </div>
        <Select value={current?.association_id} onValueChange={(v) => { setMobileOpen(false); return v === "__new" ? navigate({ to: "/app/nova" }) : setCurrentId(v); }}>
          <SelectTrigger aria-label="Selecionar associação" className="border-white/10 bg-slate-950/50 text-sidebar-foreground focus:ring-emerald-400"><SelectValue /></SelectTrigger>
          <SelectContent>{memberships.map((m) => <SelectItem key={m.association_id} value={m.association_id}>{m.associations?.name ?? "Associação sem nome"}</SelectItem>)}<SelectItem value="__new">+ Nova associação</SelectItem></SelectContent>
        </Select>
      </div>
      <nav aria-label={mobile ? "Navegação móvel" : "Navegação principal"} className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {visibleNav.map((n, index) => <div key={n.to}>
          {(index === 0 || n.to === "/app/membros" || n.to === "/app/admin-aprovacoes") && <p className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase text-sidebar-foreground/75">{index === 0 ? "Associação" : n.to === "/app/membros" ? "Administração" : "Plataforma"}</p>}
          <Link to={n.to} activeOptions={{ exact: n.exact }} onClick={() => setMobileOpen(false)} className="transition-ui flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-sidebar-foreground/80 hover:border-white/10 hover:bg-white/[0.07] hover:text-white" activeProps={{ className: "border-emerald-300 bg-emerald-300/10 text-white font-semibold shadow-sm" }}>
            <n.icon className="h-4 w-4 shrink-0" /><span>{n.label}</span>{n.to === "/app/membros" && current?.role === "admin" && (pendingJoinRequests.data ?? 0) > 0 ? <span className="ml-auto rounded-sm bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">{pendingJoinRequests.data}</span> : null}
          </Link>
        </div>)}
      </nav>
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex min-w-0 items-center gap-3 px-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold">{email.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs">{email}</p><p className="mt-1 text-xs text-sidebar-primary">{platformAdmin.data ? "Administrador da plataforma" : ROLE_LABELS[current?.role ?? "morador"] ?? current?.role}</p></div></div>
        <Button variant="ghost" onClick={() => void supabase.auth.signOut()} className="mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><LogOut /> Sair</Button>
      </div>
    </>;
  }
  return (
    <div className="app-shell flex min-h-screen bg-background">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-card focus:p-3">Ir para o conteúdo</a>
      <aside className="app-shell-sidebar sticky top-0 hidden h-dvh w-[var(--sidebar-width)] shrink-0 flex-col border-r border-white/10 p-4 text-sidebar-foreground md:flex">{navigationContent()}</aside>
      <div className="min-w-0 flex-1">
        <header className="app-shell-header grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/70 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="outline" size="icon" className="shrink-0 md:hidden" aria-label="Abrir navegação"><Menu /></Button></SheetTrigger>
              <SheetContent side="left" className="flex w-[min(20rem,calc(100vw-1rem))] flex-col border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
                <SheetTitle className="sr-only">Menu Morada360</SheetTitle><SheetDescription className="sr-only">Navegação e seleção da associação</SheetDescription>{navigationContent(true)}
              </SheetContent>
            </Sheet>
            <div className="min-w-0"><div className="flex items-center gap-2 text-xs text-muted-foreground">{platformAdmin.data && <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary">Administração global</span>}<span className="hidden sm:inline">Associação</span><ChevronRight className="hidden h-3 w-3 sm:block" /><span className="truncate">{current.associations?.name ?? "Morada360"}</span></div><p className="mt-1 truncate text-sm font-semibold">{activePage}</p></div>
          </div>
          <NotificationCenter userId={userId} />
        </header>
        <main id="app-main" tabIndex={-1} className="app-content mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"><Outlet key={current.association_id} /></main>
      </div>
    </div>
  );
}
