import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { safeInternalPath } from "@/lib/safe-redirect";

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
    if (password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: String(f.get("email")).trim(),
        password,
        options: { emailRedirectTo: window.location.origin + target, data: { full_name: String(f.get("name")).trim() } },
      });
      if (error) {
        toast.error("Não foi possível criar a conta. Confira os dados e tente novamente.");
        return;
      }
      toast.success("Conta criada! Confirme seu e-mail para entrar.");
    } catch {
      toast.error("Não foi possível criar a conta agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      sessionStorage.setItem("post_auth_redirect", target);
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth?redirect=" + encodeURIComponent(target),
      });
      if (r.error) toast.error("Não foi possível entrar com Google. Tente novamente.");
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
        redirectTo: window.location.origin + "/reset-password",
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
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-6 w-6" /> Morada360</Link>
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
                <div><Label htmlFor="su-pw">Senha</Label><Input id="su-pw" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde…" : "Criar conta"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
