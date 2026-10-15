import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Building2, ShieldCheck, Sparkles, Users, CircleHelp, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { safeInternalPath } from "@/lib/safe-redirect";
import { buildAppUrl } from "@/lib/app-url";

type Search = { redirect?: string | undefined; association_id?: string | undefined; association_code?: string | undefined; association_required?: string | undefined };

async function lookupAssociationByCode(code: string) {
  return supabase.functions.invoke("lookup-association-by-code", { body: { code } });
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined, association_id: typeof s["association_id"] === "string" ? s["association_id"] : undefined, association_code: typeof s["association_code"] === "string" ? s["association_code"] : undefined, association_required: typeof s["association_required"] === "string" ? s["association_required"] : undefined }),
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
  const { redirect, association_code } = Route.useSearch();
  const target = safeInternalPath(redirect);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [associationCode, setAssociationCode] = useState("");
  const associationCodeInput = useRef<HTMLInputElement>(null);
  const [createNewAssociation, setCreateNewAssociation] = useState(false);
  const [adminAccess, setAdminAccess] = useState(false);
  const pendingAssociationId = useRef<string>("");
  const adminAccessRef = useRef(false);
  const handledSession = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const finishSignIn = async (user: { id: string; user_metadata?: Record<string, unknown> }) => {
      if (handledSession.current === user.id) return;
      handledSession.current = user.id;
      // Only process an association explicitly selected during the Google signup flow.
      // Existing Google logins must not be forced into a new membership request based on editable metadata.
      let callbackAssociationId = "";
      let pendingAssociationCode = association_code || "";
      // Read the raw callback URL too: router search state may not yet reflect OAuth callback parameters.
      try {
        const callbackUrl = new URL(window.location.href);
        pendingAssociationCode = pendingAssociationCode || callbackUrl.searchParams.get("association_code") || "";
      } catch { /* Continue with router state and stored values. */ }
      try {
        pendingAssociationCode = pendingAssociationCode
          || sessionStorage.getItem("morada360.pendingAssociationCode")
          || localStorage.getItem("morada360.pendingAssociationCode")
          || "";
      } catch { /* Storage may be unavailable; continue with the callback URL. */ }
      if (pendingAssociationCode && /^\d{6}$/.test(pendingAssociationCode)) {
        const { data: codeMatches, error: codeError } = await lookupAssociationByCode(pendingAssociationCode);
        if (codeError || !codeMatches?.length) {
          toast.error("O código da associação não pôde ser validado. Entre novamente e informe o código correto.");
          handledSession.current = null;
          await supabase.auth.signOut();
          if (active) void navigate({ to: "/auth", search: { redirect: target } });
          return;
        }
        callbackAssociationId = codeMatches[0].id;
      }
      let storedAssociationId = "";
      try {
        storedAssociationId = sessionStorage.getItem("morada360.pendingAssociationId")
          || localStorage.getItem("morada360.pendingAssociationId")
          || "";
      } catch {
        try { storedAssociationId = localStorage.getItem("morada360.pendingAssociationId") || ""; } catch { /* Storage can be disabled by the browser. */ }
      }
      let requestedAssociationId = callbackAssociationId || pendingAssociationId.current || storedAssociationId;
      if (!requestedAssociationId && pendingAssociationCode && /^\d{6}$/.test(pendingAssociationCode)) {
        const { data: recoveredMatches, error: recoveredLookupError } = await lookupAssociationByCode(pendingAssociationCode);
        if (!recoveredLookupError && recoveredMatches?.length) requestedAssociationId = recoveredMatches[0].id;
      }
      try { sessionStorage.removeItem("morada360.pendingAssociationId"); } catch { /* Ignore unavailable session storage. */ }
      try { localStorage.removeItem("morada360.pendingAssociationId"); } catch { /* Ignore unavailable local storage. */ }
      try { sessionStorage.removeItem("morada360.pendingAssociationCode"); } catch { /* Ignore unavailable session storage. */ }
      try { localStorage.removeItem("morada360.pendingAssociationCode"); } catch { /* Ignore unavailable local storage. */ }
      let accountApproved = false;
      let isPlatformAdmin = false;
      try {
        const { data: role, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "platform_admin").maybeSingle();
        if (roleError) throw roleError;
        isPlatformAdmin = Boolean(role);
      } catch {
        toast.error("Não foi possível verificar as permissões administrativas.");
        handledSession.current = null;
        return;
      }
      if (!isPlatformAdmin && !requestedAssociationId) {
        toast.error("Informe o código de 6 dígitos fornecido pela administração da sua associação.");
        handledSession.current = null;
        await supabase.auth.signOut();
        if (active) void navigate({ to: "/auth", search: { redirect: target, association_required: "1" } });
        return;
      }
      if (adminAccessRef.current && !isPlatformAdmin) {
        toast.error("Este acesso é exclusivo do administrador principal. Informe o código da sua associação.");
        handledSession.current = null;
        await supabase.auth.signOut();
        if (active) void navigate({ to: "/auth", search: { redirect: target, association_required: "1" } });
        return;
      }
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("account_status")
          .eq("id", user.id)
          .maybeSingle();
        accountApproved = !profileError && profile?.account_status === "approved";

        // Do not create a membership request or trigger any association workflow
        // until the administrator has approved the account itself.
        if (!accountApproved) {
          if (active) void navigate({ to: "/aguardando-aprovacao" });
          return;
        }

        if (requestedAssociationId && !isPlatformAdmin) {
          try { localStorage.setItem("morada360.assoc", requestedAssociationId); } catch { /* Selection remains session-local if storage is unavailable. */ }
          const { data: existingMembership, error: membershipError } = await supabase.from("association_members").select("association_id").eq("user_id", user.id).eq("association_id", requestedAssociationId).maybeSingle();
          if (membershipError) throw membershipError;
          if (!existingMembership) {
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
  }, [association_code, navigate, target]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!adminAccess) {
      const code = (associationCodeInput.current?.value ?? associationCode).replace(/\D/g, "").slice(0, 6);
      if (!/^\d{6}$/.test(code)) { toast.error("Informe o código de 6 dígitos da sua associação."); return; }
      const { data: matches, error: lookupError } = await lookupAssociationByCode(code);
      if (lookupError || !matches?.length) { toast.error("Código não encontrado. Confira os 6 dígitos com a administração."); return; }
      pendingAssociationId.current = matches[0].id;
      try { sessionStorage.setItem("morada360.pendingAssociationId", matches[0].id); } catch { /* Keep the in-memory value when storage is unavailable. */ }
    } else {
      pendingAssociationId.current = "";
      try { sessionStorage.removeItem("morada360.pendingAssociationId"); } catch { /* Ignore unavailable session storage. */ }
      adminAccessRef.current = true;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
      });
      if (error) {
        try { sessionStorage.removeItem("morada360.pendingAssociationId"); } catch { /* Ignore unavailable session storage. */ }
        pendingAssociationId.current = "";
        toast.error("E-mail ou senha inválidos");
      }
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
      const code = (associationCodeInput.current?.value ?? associationCode).replace(/\D/g, "").slice(0, 6);
      if (!/^\d{6}$/.test(code)) {
        toast.error("Informe o código da associação com exatamente 6 dígitos.");
        return;
      }
      const { data: matches, error: lookupError } = await lookupAssociationByCode(code);
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
    let requestedAssociationCode = "";
    if (adminAccess) {
      adminAccessRef.current = true;
    }
    if (!adminAccess && (authTab === "login" || (authTab === "signup" && !createNewAssociation))) {
      const code = (associationCodeInput.current?.value ?? associationCode).replace(/\D/g, "").slice(0, 6);
      if (!/^\d{6}$/.test(code)) {
        toast.error("Informe o código da associação com exatamente 6 dígitos.");
        return;
      }
      const { data: matches, error: lookupError } = await lookupAssociationByCode(code);
      if (lookupError || !matches?.length) {
        toast.error("Código não encontrado. Confira os 6 dígitos com a administração da associação.");
        return;
      }
      requestedAssociationCode = code;
      // Persist both the code and its resolved association ID before leaving for Google's domain.
      // The ID is the most reliable fallback if the OAuth callback loses its query string.
      const associationId = matches[0].id as string;
      pendingAssociationId.current = associationId;
      try { sessionStorage.setItem("morada360.pendingAssociationId", associationId); } catch { /* Fall back to local storage. */ }
      try {
        localStorage.setItem("morada360.pendingAssociationId", associationId);
        localStorage.setItem("morada360.pendingAssociationCode", code);
      } catch { /* The callback URL and session storage remain available where supported. */ }
      try { sessionStorage.setItem("morada360.pendingAssociationCode", code); } catch { /* The callback URL carries the code too. */ }
    }
    setLoading(true);
    try {
      // BASE_URL is "/" on a root deployment and "/project-genesis/" on GitHub Pages.
      const callback = new URL(buildAppUrl("/auth", window.location.origin, import.meta.env.BASE_URL));
      callback.searchParams.set("redirect", target);
      if (requestedAssociationCode) callback.searchParams.set("association_code", requestedAssociationCode);

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
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[34rem] w-[34rem] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#64748b 0.7px, transparent 0.7px)", backgroundSize: "22px 22px" }} />
      </div>
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[1fr_0.92fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex xl:px-16 xl:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_15%,rgba(16,185,129,0.25),transparent_42%),radial-gradient(ellipse_at_85%_85%,rgba(59,130,246,0.24),transparent_40%)]" />
          <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -right-20 top-[29%] h-72 w-72 rounded-full border border-white/10" />
          <Link to="/auth" className="relative z-10 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-300"><Building2 className="h-6 w-6" /></span>
            <span><span className="block text-xl font-bold tracking-tight">Morada<span className="text-emerald-300">360</span></span><span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Gestão de comunidades</span></span>
          </Link>
          <div className="relative z-10 max-w-xl py-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-2 text-xs font-semibold text-emerald-200"><Sparkles className="h-4 w-4" /> Uma nova forma de cuidar da sua comunidade</div>
            <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">Sua comunidade,<span className="mt-2 block bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">em harmonia.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 xl:text-lg">Tudo o que sua associação precisa para organizar moradores, unidades, comunicados e solicitações — em uma experiência simples e conectada.</p>
            <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-200"><Users className="h-5 w-5" /></span><p className="text-sm font-semibold">Gestão integrada</p><p className="mt-1 text-xs leading-5 text-slate-400">Pessoas e informações em um só lugar.</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-300/15 text-sky-200"><ShieldCheck className="h-5 w-5" /></span><p className="text-sm font-semibold">Acesso protegido</p><p className="mt-1 text-xs leading-5 text-slate-400">Privacidade e controle de acesso.</p></div>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-slate-400"><span>© {new Date().getFullYear()} Morada360</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Ambiente de acesso seguro</span></div>
        </section>
        <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-[460px]">
            <Link to="/auth" className="mb-7 flex items-center justify-center gap-3 lg:hidden"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-emerald-300"><Building2 className="h-5 w-5" /></span><span className="text-xl font-bold tracking-tight">Morada<span className="text-emerald-600">360</span></span></Link>
            <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="border-b border-slate-100 px-6 pb-5 pt-7 sm:px-9 sm:pt-9">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Portal da associação</div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Que bom ter você aqui.</h2><p className="mt-2 text-sm leading-6 text-slate-500">Entre na sua conta ou crie seu acesso para continuar.</p>
              </div>
              <div className="px-6 py-6 sm:px-9 sm:py-8">
                <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Building2 className="h-4 w-4 text-emerald-600" /> Vincule sua associação</div><Dialog><DialogTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-emerald-700"><CircleHelp className="h-4 w-4" /> Ajuda</Button></DialogTrigger><DialogContent className="max-w-lg rounded-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-emerald-600" /> Como acessar o Morada360</DialogTitle><DialogDescription>O código direciona sua conta para o grupo correto e mantém os dados de cada associação separados.</DialogDescription></DialogHeader><div className="space-y-4 text-sm leading-6 text-slate-600"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700">1</span><p><strong className="text-slate-900">Peça o código.</strong> Solicite ao administrador da sua associação o código exclusivo de 6 dígitos.</p></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700">2</span><p><strong className="text-slate-900">Informe o código antes de entrar.</strong> Ele vale para login com Google e para e-mail e senha.</p></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700">3</span><p><strong className="text-slate-900">Aguarde a aprovação.</strong> Se ainda não for membro, sua solicitação será enviada à administração da associação.</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900"><strong>Acesso administrativo:</strong> somente o administrador principal da plataforma pode entrar sem código. Essa permissão é verificada após a autenticação.</div></div></DialogContent></Dialog></div>
                  <Label htmlFor="auth-association-code" className="text-xs font-medium text-slate-600">Código da associação</Label>
                  <Input id="auth-association-code" ref={associationCodeInput} value={associationCode} onChange={(event) => setAssociationCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Ex.: 123456" disabled={loading || createNewAssociation || adminAccess} className="mt-1.5 h-11 rounded-xl border-slate-200 bg-white tracking-[0.18em] focus-visible:ring-emerald-500" />
                  <p className="mt-2 text-xs leading-5 text-slate-500">Obrigatório para entrar ou criar conta em uma associação existente. O acesso depende de aprovação.</p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-slate-600"><input type="checkbox" checked={adminAccess} onChange={(event) => { setAdminAccess(event.target.checked); adminAccessRef.current = event.target.checked; if (event.target.checked) setCreateNewAssociation(false); }} disabled={loading} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" /><span className="flex items-start gap-1.5"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> Acesso do administrador principal (sem código)</span></label>
                </div>
                <Button variant="outline" className="mb-4 h-11 w-full rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50" onClick={google} disabled={loading}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.75 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.15A11 11 0 0 0 1 12c0 1.78.43 3.46 1.15 4.95l3.69-2.84Z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.4 14.97 0 12 0A11 11 0 0 0 2.15 7.05l3.69 2.84C6.71 7.29 9.14 5.36 12 5.36Z"/></svg>
                  Continuar com Google
                </Button>
                <div className="mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400"><span className="h-px flex-1 bg-slate-200" /> ou use seu e-mail <span className="h-px flex-1 bg-slate-200" /></div>
                <Tabs defaultValue="login" onValueChange={(value) => setAuthTab(value as "login" | "signup")}>
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-slate-100 p-1"><TabsTrigger value="login" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Entrar</TabsTrigger><TabsTrigger value="signup" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Criar conta</TabsTrigger></TabsList>
                  <TabsContent value="login">
                    <form onSubmit={signIn} className="mt-5 space-y-4">
                      <div className="space-y-1.5"><Label htmlFor="li-email" className="text-sm font-semibold text-slate-700">E-mail</Label><Input id="li-email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required className="h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500" /></div>
                      <div className="space-y-1.5"><Label htmlFor="li-pw" className="text-sm font-semibold text-slate-700">Senha</Label><Input id="li-pw" name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required className="h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500" /></div>
                      <Button type="submit" className="h-11 w-full rounded-xl bg-slate-900 font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800" disabled={loading}>{loading ? "Aguarde…" : <>Entrar na plataforma <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
                      <Button variant="ghost" type="button" onClick={forgot} disabled={loading} className="w-full text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50">Esqueci minha senha</Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="signup">
                    <form onSubmit={signUp} className="mt-5 space-y-4">
                      <div className="space-y-1.5"><Label htmlFor="su-name" className="text-sm font-semibold text-slate-700">Nome completo</Label><Input id="su-name" name="name" autoComplete="name" minLength={2} required placeholder="Como podemos chamar você?" className="h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500" /></div>
                      <div className="space-y-1.5"><Label htmlFor="su-email" className="text-sm font-semibold text-slate-700">E-mail</Label><Input id="su-email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" className="h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500" /></div>
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">{createNewAssociation ? "Você poderá cadastrar uma nova associação após confirmar o e-mail." : associationCode.length === 6 ? `Código informado: ${associationCode}` : "Informe o código de 6 dígitos da sua associação acima."}</p>
                      <div className="space-y-1.5"><Label htmlFor="su-pw" className="text-sm font-semibold text-slate-700">Senha (mínimo 8 caracteres)</Label><Input id="su-pw" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Crie uma senha segura" className="h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500" /></div>
                      <div className="flex items-start gap-2.5 text-sm leading-5 text-slate-500"><input id="su-terms" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" /><div><label htmlFor="su-terms">Li e aceito os Termos de Uso e declaro estar ciente do Aviso de Privacidade.</label><div className="mt-1.5"><Link to="/termos-de-uso" className="font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800">Ler Termos de Uso</Link><span className="px-1.5">·</span><Link to="/privacidade" className="font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800">Ler Aviso de Privacidade</Link></div></div></div>
                      <Button type="submit" className="h-11 w-full rounded-xl bg-slate-900 font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800" disabled={loading}>{loading ? "Aguarde…" : <>Criar minha conta <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 px-3 text-center text-xs leading-5 text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Seus dados são tratados com cuidado e protegidos conforme a LGPD.</p>
            <div className="mt-3 flex justify-center gap-4 text-xs text-slate-400"><Link to="/termos-de-uso" className="hover:text-slate-600">Termos de Uso</Link><span>•</span><Link to="/privacidade" className="hover:text-slate-600">Privacidade</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}
