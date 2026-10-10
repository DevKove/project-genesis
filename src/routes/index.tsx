import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, Megaphone, ShieldCheck, Home, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Morada360 — Gestão de associações de moradores" },
      { name: "description", content: "Plataforma completa para associações de moradores: unidades, moradores, comunicados, governança e auditoria." },
      { property: "og:title", content: "Morada360 — Gestão de associações de moradores" },
      { property: "og:description", content: "Unidades, moradores, comunicados, governança e auditoria em uma só plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Home, t: "Unidades e território", d: "Quadras, ruas, lotes e casas organizados." },
  { icon: Users, t: "Moradores", d: "Proprietários, inquilinos e dependentes com consentimento LGPD." },
  { icon: Megaphone, t: "Comunicados", d: "Avisos fixados direto no portal de cada morador." },
  { icon: ShieldCheck, t: "Perfis e permissões", d: "Presidente, tesoureiro, secretário e mais — controle real." },
  { icon: ScrollText, t: "Auditoria completa", d: "Toda alteração registrada, com antes e depois." },
  { icon: Building2, t: "Multi-associação", d: "Cada associação com seu ambiente isolado." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="bg-hero text-primary-foreground">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-6 w-6" /> Morada360</span>
          <Button asChild variant="secondary" size="sm"><Link to="/app">Acessar painel</Link></Button>
        </nav>
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16">
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">A associação do seu bairro, sem papelada.</h1>
          <p className="mt-6 max-w-xl text-lg opacity-85">Cadastre moradores, organize unidades, publique comunicados e mantenha tudo auditado — com dados separados e seguros para cada associação.</p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/auth">Começar agora</Link></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-xl border bg-card p-6 shadow-soft">
            <f.icon className="h-6 w-6 text-accent" />
            <h3 className="mt-4 text-xl font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© 2026 Morada360</footer>
    </div>
  );
}
