import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "morada360-cookie-consent-v1";

type Consent = {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (parsed.version !== 1 || typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    return { version: 1, necessary: true, analytics: parsed.analytics, marketing: parsed.marketing, decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : "" };
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = readConsent();
    setConsent(saved);
    setAnalytics(saved?.analytics ?? false);
    setMarketing(saved?.marketing ?? false);
    setReady(true);
  }, []);

  function save(nextAnalytics: boolean, nextMarketing: boolean) {
    const next: Consent = { version: 1, necessary: true, analytics: nextAnalytics, marketing: nextMarketing, decidedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // If browser storage is disabled, keep the choice in memory for this page view.
    }
    setConsent(next);
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      {(!consent || open) ? (
        <section role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" className="fixed bottom-2 left-1/2 z-[100] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 overflow-y-auto rounded-xl border bg-background p-4 text-foreground shadow-2xl sm:bottom-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <Cookie className="mt-1 hidden h-6 w-6 shrink-0 text-primary sm:block" />
            <div className="min-w-0 flex-1">
              <h2 id="cookie-consent-title" className="pr-7 text-lg font-semibold">Sua privacidade importa</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Usamos armazenamento essencial para manter recursos solicitados e lembrar sua escolha. Categorias analíticas e de marketing ficam desativadas por padrão e não devem ser ativadas sem sua escolha. Consulte os <Link to="/termos-de-uso" className="underline underline-offset-4">Termos de Uso</Link>, o <Link to="/privacidade" className="underline underline-offset-4">Aviso de Privacidade</Link> e a <Link to="/cookies" className="underline underline-offset-4">Política de Cookies</Link>.</p>
              {open && (
                <div className="mt-4 space-y-3 rounded-lg border p-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div><p className="font-medium">Necessários</p><p className="text-muted-foreground">Essenciais para sessão, segurança e preferências.</p></div><span className="font-medium text-primary">Sempre ativos</span></div>
                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md py-2"><span className="min-w-0"><span className="block font-medium">Analíticos</span><span className="text-muted-foreground">Medição de uso e desempenho, se implementada.</span></span><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary" /></label>
                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md py-2"><span className="min-w-0"><span className="block font-medium">Marketing</span><span className="text-muted-foreground">Medição de campanhas ou publicidade, se implementada.</span></span><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary" /></label>
                </div>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!open ? (
                  <>
                    <Button className="w-full sm:w-auto" onClick={() => save(false, false)} variant="outline">Rejeitar opcionais</Button>
                    <Button className="w-full sm:w-auto" onClick={() => { setOpen(true); setAnalytics(consent?.analytics ?? false); setMarketing(consent?.marketing ?? false); }} variant="outline"><Settings2 className="h-4 w-4" /> Personalizar</Button>
                    <Button className="w-full sm:w-auto" onClick={() => save(true, true)}>Aceitar todos</Button>
                  </>
                ) : (
                  <>
                    <Button className="w-full sm:w-auto" onClick={() => save(false, false)} variant="outline">Rejeitar opcionais</Button>
                    <Button className="w-full sm:w-auto" onClick={() => save(analytics, marketing)}>Salvar preferências</Button>
                    <Button className="w-full sm:w-auto" onClick={() => setOpen(false)} variant="ghost">Voltar</Button>
                  </>
                )}
              </div>
            </div>
            {open && <button type="button" aria-label="Fechar preferências" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
          </div>
        </section>
      ) : (
        <div className="fixed bottom-2 left-1/2 z-[90] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 p-1.5 shadow-lg sm:bottom-3 sm:gap-2 sm:p-2">
          <Button size="sm" variant="ghost" className="max-w-full text-xs sm:text-sm" onClick={() => setOpen(true)}><Settings2 className="h-4 w-4 shrink-0" /> Preferências de cookies</Button>
          <span className="hidden pr-2 text-xs text-muted-foreground sm:inline"><Link to="/termos-de-uso" className="underline">Termos</Link> · <Link to="/privacidade" className="underline">Privacidade</Link></span>
        </div>
      )}
    </>
  );
}
