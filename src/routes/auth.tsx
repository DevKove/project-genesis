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

type Search = { redirect?: string | undefined };

function safePath(p?: string) {
  if (!p || !p.startsWith("/") || p.startsWith("//")) return "/app";
  return p;
}

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
  const target = safePath(redirect);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: target });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setLoading(false);
    if (error) toast.error("E-mail ou senha inválidos");
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) { toast.error("A senha precisa ter ao menos 8 caracteres"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password,
      options: { emailRedirectTo: window.location.origin + target, data: { full_name: String(f.get("name")) } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Confirme seu e-mail para entrar.");
  }

  async function google() {
    sessionStorage.setItem("post_auth_redirect", target);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth?redirect=" + encodeURIComponent(target) });
    if (r.error) toast.error("Não foi possível entrar com Google");
  }

  async function forgot() {
    const email = (document.getElementById("li-email") as HTMLInputElement)?.value;
    if (!email) { toast.error("Informe seu e-mail acima"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de redefinição para seu e-mail.");
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
          <Button variant="outline" className="mb-4 w-full" onClick={google}>Continuar com Google</Button>
          <div className="mb-4 text-center text-xs text-muted-foreground">ou</div>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                <div><Label htmlFor="li-email">E-mail</Label><Input id="li-email" name="email" type="email" required /></div>
                <div><Label htmlFor="li-pw">Senha</Label><Input id="li-pw" name="password" type="password" required /></div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
                <button type="button" onClick={forgot} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">Esqueci minha senha</button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <div><Label htmlFor="su-name">Nome completo</Label><Input id="su-name" name="name" required /></div>
                <div><Label htmlFor="su-email">E-mail</Label><Input id="su-email" name="email" type="email" required /></div>
                <div><Label htmlFor="su-pw">Senha</Label><Input id="su-pw" name="password" type="password" minLength={8} required /></div>
                <Button type="submit" className="w-full" disabled={loading}>Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
