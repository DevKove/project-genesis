import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ArrowLeft } from "lucide-react";

export function LegalPage({ title, updatedAt = "10 de outubro de 2026", children }: { title: string; updatedAt?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/auth" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Morada360
        </Link>
        <header className="mb-8 border-b pb-6">
          <div className="mb-4 flex items-center gap-2 text-primary"><Building2 className="h-7 w-7" /><span className="text-lg font-semibold">Morada360</span></div>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
          <nav aria-label="Documentos legais" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link to="/termos-de-uso" className="underline underline-offset-4">Termos de Uso</Link>
            <Link to="/privacidade" className="underline underline-offset-4">Privacidade</Link>
            <Link to="/cookies" className="underline underline-offset-4">Cookies</Link>
          </nav>
        </header>
        <article className="legal-document space-y-6 leading-7">{children}</article>
        <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          <p>Morada360 — documentação legal. Antes da publicação definitiva, preencha os dados do operador e valide os documentos com assessoria jurídica.</p>
        </footer>
      </div>
    </main>
  );
}
