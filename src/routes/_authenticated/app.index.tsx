import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Users, UserCog, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager } from "@/lib/roles";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/app/")({ component: Dashboard });

async function count(table: "units" | "residents" | "association_members" | "announcements", assoc: string, extra?: (q: any) => any) {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("association_id", assoc);
  if (extra) q = extra(q);
  const { count: c } = await q;
  return c ?? 0;
}

function Dashboard() {
  const { current } = useAssoc();
  const assoc = current!.association_id;
  const manager = isManager(current!.role);
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
    queryFn: async () => (await supabase.from("announcements").select("id,title,created_at").eq("association_id", assoc).order("created_at", { ascending: false }).limit(5)).data ?? [],
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
      <PageHeader title={current!.associations?.name ?? ""} description="Visão geral da associação" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.filter((c) => c.show).map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between text-sm text-muted-foreground">{c.label}<c.icon className="h-4 w-4 text-accent" /></div>
            <div className="mt-2 font-display text-4xl font-bold">{c.value ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Últimos comunicados</h2></div>
        {latest.data?.length ? (
          <ul className="divide-y">{latest.data.map((a) => <li key={a.id} className="flex justify-between py-3 text-sm"><span>{a.title}</span><span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span></li>)}</ul>
        ) : <p className="text-sm text-muted-foreground">Nenhum comunicado ainda.</p>}
      </div>
    </>
  );
}
