import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { safeInternalPath } from "@/lib/safe-redirect";
import { buildAppUrl } from "@/lib/app-url";

type Search = { redirect?: string | undefined; association_id?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined, association_id: typeof s["association_id"] === "string" ? s["association_id"] : undefined }),
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
  const { redirect, association_id } = Route.useSearch();
  const target = safeInternalPath(redirect);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [associationCode, setAssociationCode] = useState("");
  const [createNewAssociation, setCreateNewAssociation] = useState(false);
  const handledSession = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const finishSignIn = async (user: { id: string; user_metadata?: Record<string, unknown> }) => {
      if (handledSession.current === user.id) return;
      handledSession.current = user.id;
      // Only process an association explicitly selected during the Google signup flow.
      // Existing Google logins must not be forced into a new membership request based on editable metadata.
      const requestedAssociationId = association_id && association_id !== "__new__" ? association_id : "";
      let accountApproved = false;
      try {
        const db = supabase as any;
        const { data: profile, error: profileError } = await db
          .from("profiles")
          .select("account_status")
          .eq("id", user.id)
          .maybeSingle();
        accountApproved = !profileError && profile?.account_status === "approved";

        // Do not create a membership request or trigger any association workflow
        // until the administrator has approved the account itself.
        if (!accountApproved) return;

        if (requestedAssociationId) {
          const { error } = await supabase.rpc("request_association_membership", { _association_id: requestedAssociationId });
          if (error) toast.error("Não foi possível registrar a solicitação de acesso à associação.");
          else {
            const { data: joinRequest, error: lookupError } = await supabase
              .from("association_join_requests")
              .select("id")
              .eq("user_id", user.id)
              .eq("association_id", requestedAssociationId)
              .eq("status", "pendente")
              .maybeSingle();
            if (!lookupError && joinRequest) {
              const { error: emailError } = await supabase.functions.invoke("notify-association-join-request", {
                body: { request_id: joinRequest.id, event: "requested" },
              });
              if (emailError) toast.info("Sua solicitação foi registrada. O aviso por e-mail pode depender da configuração do serviço; você pode acompanhar o status no sistema.");
            }
          }
        }
      } catch {
        toast.error("Não foi possível concluir a verificação do cadastro.");
      } finally {
        if (active) void navigate({ to: accountApproved ? target : "/aguardando-aprovacao" });
      }
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !error && data.session) void finishSignIn(data.session.user);
    }).catch(() => {
      if (active) toast.error("Não foi possível verificar sua sessão. Tente novamente.");
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void finishSignIn(session.user);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [association_id, navigate, target]);

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
    let requestedAssociationId: string | null = null;
    if (!createNewAssociation) {
      const code = associationCode.trim();
      if (!/^\d{6}$/.test(code)) {
        toast.error("Informe o código da associação com exatamente 6 dígitos.");
        return;
      }
      const { data: matches, error: lookupError } = await supabase.rpc("lookup_association_by_code", { _code: code });
      if (lookupError || !matches?.length) {
        toast.error("Código não encontrado. Confira os 6 dígitos com a administração da associação.");
        return;
      }
      requestedAssociationId = matches[0].id;
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
      toast.success(createNewAssociation ? "Conta criada! Confirme seu e-mail e aguarde a aprovação do administrador antes de cadastrar uma associação." : "Conta criada! Confirme seu e-mail e aguarde a aprovação do administrador antes de acessar o sistema.");
    } catch {
      toast.error("Não foi possível criar a conta agora. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    // Existing users sign in without an association code. Codes are required only
    // when the user is creating an account and requesting membership.
    let requestedAssociationId = "";
    if (authTab === "signup") {
      requestedAssociationId = "__new__";
    }
    if (authTab === "signup" && !createNewAssociation) {
      const code = associationCode.trim();
      if (!/^\d{6}$/.test(code)) {
        toast.error("Informe o código da associação com exatamente 6 dígitos.");
        return;
      }
      const { data: matches, error: lookupError } = await supabase.rpc("lookup_association_by_code", { _code: code });
      if (lookupError || !matches?.length) {
        toast.error("Código não encontrado. Confira os 6 dígitos com a administração da associação.");
        return;
      }
      requestedAssociationId = matches[0].id;
    }
    setLoading(true);
    try {
      // BASE_URL is "/" on a root deployment and "/project-genesis/" on GitHub Pages.
      const callback = new URL(buildAppUrl("/auth", window.location.origin, import.meta.env.BASE_URL));
      callback.searchParams.set("redirect", target);
      if (requestedAssociationId) callback.searchParams.set("association_id", requestedAssociationId);

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
          <div className="mb-4 space-y-2"><Label htmlFor="auth-association-code">Código da associação</Label><Input id="auth-association-code" value={associationCode} onChange={(event) => setAssociationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Digite os 6 dígitos" disabled={loading || createNewAssociation} /><p className="text-xs text-muted-foreground">Peça o código de 6 dígitos à administração da associação. O acesso a uma associação existente depende de aprovação administrativa.</p><label className="flex items-start gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={createNewAssociation} onChange={(event) => setCreateNewAssociation(event.target.checked)} disabled={loading} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span>Minha associação ainda não está cadastrada</span></label></div>
          <Button variant="outline" className="mb-4 w-full" onClick={google} disabled={loading}>Continuar com Google</Button>
          <div className="mb-4 text-center text-xs text-muted-foreground">ou</div>
          <Tabs defaultValue="login" onValueChange={(value) => setAuthTab(value as "login" | "signup")}>
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
                <p className="text-xs text-muted-foreground">{createNewAssociation ? "Você poderá cadastrar uma nova associação após confirmar o e-mail." : associationCode.length === 6 ? `Código informado: ${associationCode}` : "Informe o código de 6 dígitos da sua associação acima."}</p>
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
