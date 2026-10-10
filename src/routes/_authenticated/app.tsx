import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutDashboard, Home, Users, UserCog, Megaphone, ScrollText, Settings, LogOut, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AssocProvider, useAssoc } from "@/lib/assoc-context";
import { ROLE_LABELS, isManager, canSeeAudit, canInvite } from "@/lib/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateAssociation } from "@/components/app/CreateAssociation";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Painel — Morada360" }, { name: "description", content: "Painel de gestão da associação." }] }),
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AssocProvider userId={user.id}>
      <Shell email={user.email ?? ""} />
    </AssocProvider>
  );
}

function Shell({ email }: { email: string }) {
  const { memberships, current, setCurrentId, loading } = useAssoc();
  const navigate = useNavigate();
  const role = current?.role;

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!current)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-bold">Crie sua associação</h1>
          <p className="mb-6 mt-2 text-muted-foreground">Você ainda não participa de nenhuma associação. Crie uma agora ou peça um convite ao administrador.</p>
          <CreateAssociation />
          <button className="mt-6 text-sm text-muted-foreground hover:text-foreground" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>
    );

  const nav = [
    { to: "/app", label: "Painel", icon: LayoutDashboard, show: true, exact: true },
  ] as const;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold"><Building2 className="h-5 w-5 text-sidebar-primary" /> Morada360</div>
        <Select value={current.association_id} onValueChange={(v) => (v === "__new" ? navigate({ to: "/app/nova" }) : setCurrentId(v))}>
          <SelectTrigger className="mb-6 border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            {memberships.map((m) => <SelectItem key={m.association_id} value={m.association_id}>{m.associations?.name}</SelectItem>)}
            <SelectItem value="__new">+ Nova associação</SelectItem>
          </SelectContent>
        </Select>
        <nav className="flex-1 space-y-1">
          {nav.filter((n) => n.show).map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4 text-xs">
          <div className="truncate px-2">{email}</div>
          <div className="px-2 text-sidebar-primary">{ROLE_LABELS[current.role]}</div>
          <button onClick={() => supabase.auth.signOut()} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" /> Sair</button>
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <span className="font-semibold">{current.associations?.name}</span>
          <select className="rounded border bg-background px-2 py-1 text-sm" value="" onChange={(e) => e.target.value && navigate({ to: e.target.value })}>
            <option value="">Menu</option>
            {nav.filter((n) => n.show).map((n) => <option key={n.to} value={n.to}>{n.label}</option>)}
          </select>
        </div>
        <main className="mx-auto max-w-6xl p-6 md:p-10"><Outlet key={current.association_id} /></main>
      </div>
    </div>
  );
}
