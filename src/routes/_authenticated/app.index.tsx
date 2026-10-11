import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Users, UserCog, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/app/")({ component: Dashboard });

async function count(table: "units" | "residents" | "association_members" | "announcements", assoc: string, extra?: (q: any) => any) {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("association_id", assoc);
  if (extra) q = extra(q);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

function Dashboard() {
  const { current } = useAssoc();
  if (!current) return null;
  const assoc = current.association_id;
  const manager = isManager(current.role);
  const stats = useQuery({
    queryKey: ["stats", assoc],
    queryFn: async () => ({
      units: await count("units", assoc),
      occupied: await count("units", assoc, (q) => q.eq("status", "ocupada")),
      residents: manager ? await count("residents", assoc, (q) => q.eq("is_active", true)) : 0,
      members: await count("association_members", assoc),
      announcements: await count("announcements", assoc),
    }),
  });
  const latest = useQuery({
    queryKey: ["announcements", assoc, "latest"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("id,title,created_at")
        .eq("association_id", assoc).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
  const s = stats.data;
  const cards = [
    { label: "Unidades", value: s?.units, sub: s ? `${s.occupied} ocupadas` : "", icon: Home, show: true },
    { label: "Moradores ativos", value: s?.residents, sub: "cadastrados", icon: Users, show: manager },
    { label: "Usuários com acesso", value: s?.members, sub: "membros", icon: UserCog, show: true },
    { label: "Comunicados", value: s?.announcements, sub: "publicados", icon: Megaphone, show: true },
  ];
  return (
    <>
      <PageHeader title={current.associations?.name ?? ""} description="Visão geral da associação" />
      {stats.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><p>Não foi possível carregar os indicadores. Verifique as permissões de acesso e sua conexão.</p><Button variant="link" className="mt-2 font-medium underline" onClick={() => void stats.refetch()}>Tentar novamente</Button></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.filter((c) => c.show).map((c) => (
          <div key={c.label} className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between text-sm text-muted-foreground">{c.label}<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><c.icon className="h-4 w-4" /></span></div>
            <div className="mt-2 text-4xl font-bold tabular-nums">{stats.isLoading ? <Skeleton className="h-10 w-16" /> : stats.isError ? "—" : (c.value ?? "—")}</div>
            <div className="text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-9 border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Últimos comunicados</h2>{latest.isError && <Button variant="link" className="text-sm font-medium underline" onClick={() => void latest.refetch()}>Tentar novamente</Button>}</div>
        {latest.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os comunicados.</p> : latest.data?.length ? (
          <ul className="divide-y">{latest.data.map((a) => <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-border py-4 text-sm"><span>{a.title}</span><span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span></li>)}</ul>
        ) : <p className="text-sm text-muted-foreground">{latest.isLoading ? "Carregando comunicados…" : "Nenhum comunicado ainda."}</p>}
      </div>
    </>
  );
}
