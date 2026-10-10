import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { safeInternalPath } from "@/lib/safe-redirect";
import { buildAppUrl } from "@/lib/app-url";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined }),
  head: () => ({
    meta: [
      { title: "Entrar — Morada360" },
      { name: "description", content: "Acesse o painel da sua associação de moradores." },
      { property: "og:title", content: "Entrar — Morada360" },
      { property: "og:description", content: "Acesse o painel da sua associação de moradores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const target = safeInternalPath(redirect);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [associations, setAssociations] = useState<Array<{ id: string; name: string; city: string | null; state: string | null }>>([]);
  const [loadingAssociations, setLoadingAssociations] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !error && data.session) void navigate({ to: target });
    }).catch(() => {
      if (active) toast.error("Não foi possível verificar sua sessão. Tente novamente.");
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: target });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate, target]);

  useEffect(() => {
    let active = true;
    supabase.rpc("list_associations_for_signup").then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error("Não foi possível carregar a lista de associações.");
      else setAssociations(data ?? []);
      setLoadingAssociations(false);
    }).catch(() => {
      if (active) {
        setLoadingAssociations(false);
        toast.error("Não foi possível carregar a lista de associações.");
      }
    });
    return () => { active = false; };
  }, []);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
      });
      if (error) toast.error("E-mail ou senha inválidos");
    } catch {
      toast.error("Não foi possível entrar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    const requestedAssociationId = String(f.get("association_id") ?? "");
    if (!requestedAssociationId) {
      toast.error("Selecione sua associação ou indique que deseja cadastrar uma nova.");
      return;
    }
    if (!termsAccepted) {
      toast.error("É necessário aceitar os Termos de Uso e o Aviso de Privacidade para criar a conta.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: String(f.get("email")).trim(),
        password,
        options: {
          emailRedirectTo: buildAppUrl(target, window.location.origin, import.meta.env.BASE_URL),
          data: { full_name: String(f.get("name")).trim(), association_id: requestedAssociationId === "__new__" ? null : requestedAssociationId, accepted_terms_version: "2026-10-10-v1", accepted_terms_at: new Date().toISOString(), privacy_notice_version: "2026-10-10-v1" },
        },
      });
      if (error) {
        toast.error("Não foi possível criar a conta. Confira os dados e tente novamente.");
        return;
      }
      toast.success(requestedAssociationId === "__new__" ? "Conta criada! Confirme seu e-mail para continuar e cadastrar a associação." : "Conta criada! Confirme seu e-mail. Depois, o administrador da associação precisará aprovar seu acesso.");
    } catch {
      toast.error("Não foi possível criar a conta agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      // BASE_URL is "/" on a root deployment and "/project-genesis/" on GitHub Pages.
      const callback = new URL(buildAppUrl("/auth", window.location.origin, import.meta.env.BASE_URL));
      callback.searchParams.set("redirect", target);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast.error("Não foi possível entrar com Google. Verifique se o provedor Google está habilitado no Supabase.");
      }
    } catch {
      toast.error("Não foi possível iniciar o acesso com Google. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function forgot() {
    const email = (document.getElementById("li-email") as HTMLInputElement)?.value.trim();
    if (!email) {
      toast.error("Informe seu e-mail acima");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildAppUrl("/reset-password", window.location.origin, import.meta.env.BASE_URL),
      });
      if (error) toast.error("Não foi possível solicitar a redefinição. Confira o e-mail e tente novamente.");
      else toast.success("Se o e-mail estiver cadastrado, enviaremos um link de redefinição.");
    } catch {
      toast.error("Não foi possível solicitar a redefinição agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-hero p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/auth" className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-6 w-6" /> Morada360</Link>
        <div>
          <h1 className="text-5xl font-bold leading-tight">Sua comunidade,<br />organizada de ponta a ponta.</h1>
          <p className="mt-4 max-w-md opacity-80">Moradores, unidades, comunicados e governança em um só lugar — com segurança e transparência.</p>
        </div>
        <p className="text-sm opacity-60">Dados protegidos conforme a LGPD.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="mb-6 text-3xl font-bold">Bem-vindo</h2>
          <Button variant="outline" className="mb-4 w-full" onClick={google} disabled={loading}>Continuar com Google</Button>
          <div className="mb-4 text-center text-xs text-muted-foreground">ou</div>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                <div><Label htmlFor="li-email">E-mail</Label><Input id="li-email" name="email" type="email" autoComplete="email" required /></div>
                <div><Label htmlFor="li-pw">Senha</Label><Input id="li-pw" name="password" type="password" autoComplete="current-password" required /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde…" : "Entrar"}</Button>
                <button type="button" onClick={forgot} disabled={loading} className="w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Esqueci minha senha</button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <div><Label htmlFor="su-name">Nome completo</Label><Input id="su-name" name="name" autoComplete="name" minLength={2} required /></div>
                <div><Label htmlFor="su-email">E-mail</Label><Input id="su-email" name="email" type="email" autoComplete="email" required /></div>
                <div><Label htmlFor="su-association">Associação</Label><select id="su-association" name="association_id" required defaultValue="" disabled={loading || loadingAssociations} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Selecione sua associação</option>{associations.map((association) => <option key={association.id} value={association.id}>{association.name}{association.city ? ` — ${association.city}` : ""}{association.state ? `/${association.state}` : ""}</option>)}<option value="__new__">Minha associação ainda não está cadastrada</option></select><p className="mt-1 text-xs text-muted-foreground">Se escolher uma associação existente, seu acesso ficará pendente até a aprovação do administrador.</p></div>
                <div><Label htmlFor="su-pw">Senha</Label><Input id="su-pw" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
                <div className="flex items-start gap-2 text-sm leading-5 text-muted-foreground"><input id="su-terms" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-primary" /><div><label htmlFor="su-terms">Li e aceito os Termos de Uso e declaro estar ciente do Aviso de Privacidade.</label><div className="mt-1"><Link to="/termos-de-uso" className="text-foreground underline underline-offset-4">Ler Termos de Uso</Link><span> · </span><Link to="/privacidade" className="text-foreground underline underline-offset-4">Ler Aviso de Privacidade</Link></div></div></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde…" : "Criar conta"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
