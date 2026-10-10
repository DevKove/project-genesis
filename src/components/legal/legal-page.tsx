import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ArrowLeft } from "lucide-react";

export function LegalPage({ title, updatedAt = "10 de outubro de 2026", children }: { title: string; updatedAt?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl min-w-0">
        <Link to="/auth" className="mb-6 inline-flex min-h-10 items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground sm:mb-8">
          <ArrowLeft className="h-4 w-4 shrink-0" /> Voltar ao Morada360
        </Link>
        <header className="mb-6 border-b pb-5 sm:mb-8 sm:pb-6">
          <div className="mb-4 flex items-center gap-2 text-primary"><Building2 className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" /><span className="text-lg font-semibold">Morada360</span></div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-5 text-muted-foreground">Última atualização: {updatedAt}</p>
          <nav aria-label="Documentos legais" className="mt-5 flex flex-wrap gap-2 sm:gap-x-5 sm:gap-y-2">
            <Link to="/termos-de-uso" className="inline-flex min-h-10 items-center rounded-md px-2 text-sm underline underline-offset-4 hover:bg-muted">Termos de Uso</Link>
            <Link to="/privacidade" className="inline-flex min-h-10 items-center rounded-md px-2 text-sm underline underline-offset-4 hover:bg-muted">Privacidade</Link>
            <Link to="/cookies" className="inline-flex min-h-10 items-center rounded-md px-2 text-sm underline underline-offset-4 hover:bg-muted">Cookies</Link>
          </nav>
        </header>
        <article className="legal-document min-w-0 space-y-5 text-[0.9375rem] leading-7 sm:space-y-6 sm:text-base">{children}</article>
        <footer className="mt-8 border-t pt-5 text-sm leading-6 text-muted-foreground sm:mt-12 sm:pt-6">
          <p>Morada360 — documentação legal. Antes da publicação definitiva, preencha os dados do operador e valide os documentos com assessoria jurídica.</p>
        </footer>
      </div>
    </main>
  );
}
