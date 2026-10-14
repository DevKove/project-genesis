import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarClock, Check, Copy, CreditCard, Crown, LoaderCircle, MailCheck, QrCode, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isValidCPF, maskCPF } from "@/lib/roles";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/assinatura")({
  head: () => ({ meta: [{ title: "Planos e assinatura — Morada360" }] }),
  component: SubscriptionPage,
});

type Plan = {
  code: string;
  name: string;
  tagline: string;
  price_per_member_monthly: number;
  display_order: number;
  features: string[];
  highlighted: boolean;
};

type Subscription = {
  id: string;
  association_id: string;
  plan_code: string;
  responsible_cpf: string;
  billing_email: string;
  status: string;
  trial_started_at: string;
  trial_ends_at: string;
  member_count_at_last_billing: number;
  unit_price_at_last_billing: number;
};

const brl = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });

function SubscriptionPage() {
  const { current, userId, isPlatformAdmin } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id ?? "";
  const canManage = isPlatformAdmin;
  const [selectedPlan, setSelectedPlan] = useState("gestao");
  const [cpf, setCpf] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [pixPayment, setPixPayment] = useState<{ qrCode: string; qrCodeBase64: string; checkoutUrl?: string; amount: number; paymentId: string } | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{ ok: boolean; message: string; account_id?: string; country_id?: string | null; site_id?: string | null; credential_environment?: string } | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);

  const plans = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("subscription_plans")
        .select("code,name,tagline,price_per_member_monthly,display_order,features,highlighted")
        .eq("active", true).order("display_order");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const memberPlan = useQuery({
    queryKey: ["member-association-plan", associationId],
    enabled: Boolean(associationId && !canManage),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_my_association_plan", {
        _association_id: associationId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as { plan_code: string; status: string; trial_ends_at: string | null } | null;
    },
    refetchInterval: 60000,
  });

  const memberBilling = useQuery({
    queryKey: ["member-association-billing", associationId],
    enabled: Boolean(associationId && !canManage),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_my_association_billing_status", {
        _association_id: associationId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as {
        plan_code: string;
        subscription_status: string;
        trial_ends_at: string | null;
        current_period_end: string | null;
        latest_payment_status: string | null;
        latest_payment_url: string | null;
        latest_payment_period: string | null;
        latest_payment_amount: number | null;
        can_pay: boolean;
      } | null;
    },
    refetchInterval: 30000,
  });

  const subscription = useQuery({
    queryKey: ["association-subscription", associationId],
    enabled: Boolean(associationId && canManage),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("association_subscriptions")
        .select("id,association_id,plan_code,responsible_cpf,billing_email,status,trial_started_at,trial_ends_at,member_count_at_last_billing,unit_price_at_last_billing")
        .eq("association_id", associationId).maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
  });

  const residents = useQuery({
    queryKey: ["billable-active-residents", associationId],
    enabled: Boolean(associationId && canManage),
    queryFn: async () => {
      const { count, error } = await supabase.from("residents").select("id", { count: "exact", head: true })
        .eq("association_id", associationId).eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const account = useQuery({
    queryKey: ["billing-verified-account", userId],
    enabled: Boolean(userId && canManage),
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { email: data.user?.email ?? "", emailConfirmed: Boolean(data.user?.email_confirmed_at) };
    },
  });

  const selected = useMemo(() => plans.data?.find((p) => p.code === selectedPlan) ?? plans.data?.[1] ?? plans.data?.[0], [plans.data, selectedPlan]);
  const activeCount = residents.data ?? 0;
  const monthlyEstimate = (selected?.price_per_member_monthly ?? 0) * activeCount;
  const trialExpired = Boolean(subscription.data && new Date(subscription.data.trial_ends_at).getTime() <= Date.now() && subscription.data.status === "trialing");
  const currentPlan = plans.data?.find((p) => p.code === subscription.data?.plan_code);

  useEffect(() => {
    if (subscription.data?.plan_code) setSelectedPlan(subscription.data.plan_code);
  }, [subscription.data?.plan_code]);

  async function changePlan() {
    if (!associationId || !isPlatformAdmin || !selected || !subscription.data || selected.code === subscription.data.plan_code) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_change_association_plan", {
        _association_id: associationId,
        _plan_code: selected.code,
      });
      if (error) throw error;
      toast.success(`Plano da associação alterado para ${selected.name}.`);
      await queryClient.invalidateQueries({ queryKey: ["association-subscription", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["association-feature", associationId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o plano.");
    } finally {
      setSaving(false);
    }
  }

  async function runSandboxCheckout() {
    if (!associationId || sandboxLoading) return;
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: { association_id: associationId, action: "sandbox_checkout" },
      });
      let payload = data as { ok?: boolean; error?: string; message?: string; checkout_url?: string } | null;
      if (error) {
        const ctx = (error as { context?: Response }).context;
        payload = ctx ? await ctx.json().catch(() => null) : null;
        if (!payload) throw error;
      }
      if (!payload?.ok || !payload.checkout_url) {
        setSandboxResult({ ok: false, message: payload?.error || "Não foi possível criar o checkout de teste." });
        return;
      }
      setSandboxResult({ ok: true, message: payload.message || "Checkout de teste criado.", url: payload.checkout_url });
    } catch (e) {
      setSandboxResult({ ok: false, message: e instanceof Error ? e.message : "Falha ao contatar o servidor." });
    } finally {
      setSandboxLoading(false);
    }
  }

  async function runPaymentDiagnostic() {
    if (!associationId || diagnosticLoading) return;
    setDiagnosticLoading(true);
    setDiagnosticResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: { association_id: associationId, action: "diagnostic" },
      });
      if (error) throw error;
      if (!data?.diagnostic) throw new Error(data?.error || "O servidor não retornou um diagnóstico válido.");
      if (!data.ok) {
        setDiagnosticResult({ ok: false, message: data.error || "A validação da integração falhou." });
        return;
      }
      setDiagnosticResult({
        ok: true,
        message: data.message || "Credencial aceita pelo Mercado Pago.",
        account_id: data.account_id,
        country_id: data.country_id,
        site_id: data.site_id,
        credential_environment: data.credential_environment,
      });
    } catch (error) {
      setDiagnosticResult({
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível executar o diagnóstico. Confira a implantação da função.",
      });
    } finally {
      setDiagnosticLoading(false);
    }
  }

  async function startManualPayment(method: "card" | "pix") {
    if (!associationId || paymentLoading) return;
    setPaymentLoading(true);
    if (method !== "pix") setPixPayment(null);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: { association_id: associationId, payment_method: method },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const payload = ctx ? await ctx.json().catch(() => null) : null;
        if (payload?.error) throw new Error(String(payload.error));
        throw error;
      }
      if (!data?.ok) throw new Error(data?.error || "Não foi possível gerar o pagamento.");
      if (method === "pix") {
        if (typeof data.qr_code === "string" && typeof data.qr_code_base64 === "string") {
          setPixPayment({
            qrCode: data.qr_code,
            qrCodeBase64: data.qr_code_base64,
            checkoutUrl: typeof data.checkout_url === "string" ? data.checkout_url : undefined,
            amount: Number(data.amount ?? 0),
            paymentId: String(data.payment_id ?? ""),
          });
          toast.success("Pix gerado. Pague pelo QR Code ou copie o código Pix.");
          return;
        }
        if (typeof data.checkout_url === "string" && data.checkout_url.startsWith("https://")) {
          window.location.assign(data.checkout_url);
          return;
        }
        throw new Error("O Mercado Pago não retornou o QR Code Pix nem as instruções de pagamento.");
      }
      if (typeof data.checkout_url !== "string" || !data.checkout_url.startsWith("https://")) {
        throw new Error("O Mercado Pago não retornou um link de checkout válido.");
      }
      window.location.assign(data.checkout_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function startTrial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !canManage || !selected) return;
    if (!isValidCPF(cpf)) {
      toast.error("Informe um CPF válido do responsável financeiro.");
      return;
    }
    if (!billingEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())) {
      toast.error("Informe um e-mail válido para faturamento da associação.");
      return;
    }
    if (!account.data?.emailConfirmed || !account.data.email) {
      toast.error("Confirme o e-mail da sua conta antes de iniciar o teste gratuito.");
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("start_association_trial", {
        _association_id: associationId,
        _plan_code: selected.code,
        _responsible_cpf: cpf.replace(/\D/g, ""),
        _billing_email: billingEmail.trim().toLowerCase(),
      });
      if (error) {
        const msg = String(error.message ?? "");
        if (msg.includes("já está vinculado") || msg.includes("já possui")) toast.error(msg);
        else if (msg.includes("Confirme o e-mail")) toast.error(msg);
        else if (msg.includes("CPF")) toast.error("O CPF informado é inválido ou já está vinculado a outra assinatura.");
        else toast.error(msg || "Não foi possível iniciar o teste. Confira os dados e as permissões de administrador do sistema.");
        return;
      }
      toast.success("Teste gratuito iniciado! Você tem 10 dias para conhecer o Morada360.");
      setCpf("");
      setBillingEmail("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["association-subscription", associationId] }),
        queryClient.invalidateQueries({ queryKey: ["subscription-plans"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o teste.");
    } finally {
      setSaving(false);
    }
  }

  if (!current) return null;
  if (!canManage) {
    const memberCurrentPlan = plans.data?.find((plan) => plan.code === memberPlan.data?.plan_code);
    const higherPlans = plans.data?.filter((plan) => plan.display_order > (memberCurrentPlan?.display_order ?? 0)) ?? [];
    const upgradeMessage = `Olá! Gostaria de solicitar uma avaliação de upgrade do plano da associação ${current.associations?.name ?? ""}. Nosso plano atual é ${memberCurrentPlan?.name ?? "não identificado"} e temos interesse em conhecer os benefícios dos planos superiores do Morada360.`;
    return (
      <div className="space-y-6">
        <PageHeader title="Meu plano e benefícios" description="Consulte o plano da sua associação, compare os benefícios e veja como solicitar uma melhoria." />
        {memberPlan.isError && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível consultar o plano atual. Tente novamente. <Button variant="link" onClick={() => void memberPlan.refetch()}>Tentar novamente</Button></div>}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Plano contratado pela associação</p>
              <h2 className="mt-1 text-2xl font-bold">{memberPlan.isLoading || plans.isLoading ? "Consultando plano…" : memberCurrentPlan?.name ?? "Nenhum plano identificado"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{memberCurrentPlan ? `${brl(memberCurrentPlan.price_per_member_monthly)} por morador ativo/mês` : "Peça ao administrador do sistema para verificar a assinatura da associação."}</p>
            </div>
            <span className="w-fit rounded-full border bg-background px-3 py-1.5 text-sm font-semibold">
              {memberPlan.data?.status === "active" ? "Assinatura ativa" : memberPlan.data?.status === "trialing" && memberPlan.data.trial_ends_at && new Date(memberPlan.data.trial_ends_at).getTime() > Date.now() ? "Em período de avaliação" : memberPlan.data?.status === "trialing" ? "Avaliação encerrada" : memberPlan.data?.status ?? "Status indisponível"}
            </span>
          </div>
          {memberCurrentPlan && <div className="mt-5"><h3 className="font-semibold">Benefícios incluídos no seu plano</h3><ul className="mt-2 grid gap-2 sm:grid-cols-2">{memberCurrentPlan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul></div>}
          {memberBilling.data && memberBilling.data.can_pay && (() => {
            const now = Date.now();
            const trialExpired = memberBilling.data.subscription_status === "trialing" && Boolean(memberBilling.data.trial_ends_at) && new Date(memberBilling.data.trial_ends_at!).getTime() <= now;
            const periodExpired = memberBilling.data.subscription_status === "active" && Boolean(memberBilling.data.current_period_end) && new Date(memberBilling.data.current_period_end!).getTime() <= now;
            const needsPayment = trialExpired || periodExpired || ["payment_required", "past_due"].includes(memberBilling.data.subscription_status);
            const pendingCheckout = memberBilling.data.latest_payment_status === "PENDING" && Boolean(memberBilling.data.latest_payment_url);
            return (needsPayment || pendingCheckout) ? <div className="mt-5 space-y-4 rounded-xl border border-primary/30 bg-background p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{pendingCheckout ? "Pagamento mensal pendente" : "Renovar plano do Morada360"}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{pendingCheckout ? "Já existe uma cobrança aguardando pagamento. Continue a cobrança atual para evitar pagamentos duplicados; a assinatura só muda após confirmação do servidor." : "Escolha como deseja pagar. O Pix é gerado aqui no Morada360; o cartão abre o checkout seguro do Mercado Pago."}</p>
                  {memberBilling.data.latest_payment_amount != null && pendingCheckout && <p className="mt-1 text-base font-semibold">Valor: {brl(Number(memberBilling.data.latest_payment_amount))}</p>}
                </div>
                {pendingCheckout && <span className="w-fit rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">Aguardando pagamento</span>}
              </div>
              {pendingCheckout ? (
                <Button onClick={() => { const url = memberBilling.data.latest_payment_url; if (url && url.startsWith("https://")) window.location.assign(url); else toast.error("O link da cobrança pendente não está disponível. Atualize a página ou contate o suporte."); }} disabled={paymentLoading} className="w-full sm:w-auto">
                  <CreditCard className="mr-2 h-4 w-4" /> Continuar pagamento pendente
                </Button>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col rounded-xl border-2 border-primary/50 bg-primary/5 p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-primary/10 p-3 text-primary"><QrCode className="h-6 w-6" /></span>
                      <div><h4 className="font-semibold">Pix</h4><p className="text-xs font-medium text-primary">QR Code + Pix Copia e Cola</p></div>
                    </div>
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">Gere o código Pix nesta página e pague pelo aplicativo do seu banco. Confira o recebedor e o valor antes de confirmar.</p>
                    <Button onClick={() => void startManualPayment("pix")} disabled={paymentLoading} className="mt-4 w-full">
                      {paymentLoading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Preparando pagamento…</> : <><QrCode className="mr-2 h-4 w-4" /> Gerar Pix</>}
                    </Button>
                  </div>
                  <div className="flex flex-col rounded-xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-muted p-3"><CreditCard className="h-6 w-6" /></span>
                      <div><h4 className="font-semibold">Cartão</h4><p className="text-xs text-muted-foreground">Crédito ou opções disponíveis no Mercado Pago</p></div>
                    </div>
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">Continue para o checkout seguro do Mercado Pago. Os meios de pagamento disponíveis dependem da conta e da configuração do provedor.</p>
                    <Button variant="outline" onClick={() => void startManualPayment("card")} disabled={paymentLoading} className="mt-4 w-full">
                      {paymentLoading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Preparando pagamento…</> : <><CreditCard className="mr-2 h-4 w-4" /> Pagar com cartão</>}
                    </Button>
                  </div>
                </div>
              )}
            </div> : null;
          })()}
          {pixPayment && <div className="mt-5 rounded-xl border border-primary/30 bg-background p-4 sm:p-5">
            <div className="flex items-start gap-3"><QrCode className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><h3 className="font-semibold">Pague com Pix</h3><p className="mt-1 text-sm text-muted-foreground">Valor: {brl(pixPayment.amount)}. Abra o aplicativo do seu banco e escaneie o QR Code ou use o Pix Copia e Cola. A assinatura só será atualizada após a confirmação do Mercado Pago.</p></div></div>
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img src={`data:image/png;base64,${pixPayment.qrCodeBase64}`} alt="QR Code para pagamento via Pix" className="h-56 w-56 rounded-lg border bg-white p-2 object-contain" />
              <div className="w-full min-w-0 flex-1 space-y-3">
                <Label htmlFor="pix-copy-paste">Pix Copia e Cola</Label>
                <textarea id="pix-copy-paste" readOnly value={pixPayment.qrCode} className="min-h-28 w-full resize-y rounded-md border bg-muted/30 p-3 font-mono text-xs" />
                <Button type="button" onClick={async () => { try { await navigator.clipboard.writeText(pixPayment.qrCode); toast.success("Código Pix copiado."); } catch { toast.error("Não foi possível copiar automaticamente. Selecione e copie o código Pix."); } }} className="w-full sm:w-auto"><Copy className="mr-2 h-4 w-4" /> Copiar código Pix</Button>
                {pixPayment.checkoutUrl && <a href={pixPayment.checkoutUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-primary underline underline-offset-4">Abrir instruções de pagamento</a>}
                <p className="text-xs text-muted-foreground">Referência do pagamento: {pixPayment.paymentId || "processando"}</p>
              </div>
            </div>
          </div>}
        </section>
        <section className="space-y-3">
          <div><h2 className="text-xl font-semibold">Conheça os planos superiores</h2><p className="mt-1 text-sm text-muted-foreground">Veja o que sua associação pode desbloquear com um upgrade. A mudança precisa ser aprovada pelo administrador do sistema.</p></div>
          {plans.isLoading ? <div className="rounded-xl border p-5 text-sm text-muted-foreground">Carregando planos…</div> : higherPlans.length ? <div className="grid gap-4 lg:grid-cols-2">{higherPlans.map((plan) => <article key={plan.code} className={`rounded-2xl border bg-card p-5 ${plan.highlighted ? "border-primary shadow-soft" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p></div>{plan.highlighted && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Recomendado</span>}</div>
            <p className="mt-4 text-2xl font-bold">{brl(plan.price_per_member_monthly)}<span className="text-sm font-normal text-muted-foreground"> / morador ativo/mês</span></p>
            <ul className="mt-4 space-y-2">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul>
            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Valor mensal estimado = preço por morador ativo × quantidade de moradores ativos cadastrados.</p>
          </article>)}</div> : <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Sua associação já está no plano mais completo disponível. Consulte o administrador para conhecer futuras opções.</div>}
        </section>
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" /><div><h2 className="font-semibold">Como solicitar um upgrade</h2><p className="mt-1 text-sm text-muted-foreground">Copie a mensagem abaixo e encaminhe ao administrador do sistema ou ao responsável pela sua associação. Somente o administrador da plataforma pode efetivar a alteração do plano.</p>
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">{upgradeMessage}</div>
          <Button className="mt-3" onClick={async () => { try { await navigator.clipboard.writeText(upgradeMessage); toast.success("Mensagem de solicitação copiada."); } catch { toast.error("Não foi possível copiar automaticamente. Selecione e copie a mensagem acima."); } }}><CreditCard className="mr-2 h-4 w-4" /> Copiar solicitação de upgrade</Button>
          </div></div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Planos e assinatura" description="Painel administrativo global: atribua e acompanhe o plano de cada associação. O valor estimado considera moradores ativos cadastrados." />
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Moradores faturáveis</div>
          <p className="mt-2 text-3xl font-bold tabular-nums">{residents.isLoading ? "…" : residents.isError ? "—" : activeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Somente moradores ativos</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" /> Estimativa mensal</div>
          <p className="mt-2 text-3xl font-bold tabular-nums">{brl(monthlyEstimate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{brl(selected?.price_per_member_monthly ?? 0)} por morador ativo/mês no plano selecionado</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" /> Período de avaliação</div>
          <p className="mt-2 text-3xl font-bold">10 dias</p>
          <p className="mt-1 text-xs text-muted-foreground">Sem cobrança durante o teste gratuito</p>
        </div>
      </section>

      {subscription.isError && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível consultar a assinatura. Verifique as permissões e tente novamente. <Button variant="link" onClick={() => void subscription.refetch()}>Tentar novamente</Button></div>}
      {subscription.data && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Assinatura da associação</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">{currentPlan?.name ?? subscription.data.plan_code} · responsável CPF {maskCPF(subscription.data.responsible_cpf)}</p>
              <p className="mt-1 text-sm text-muted-foreground">E-mail de faturamento: {subscription.data.billing_email}</p>
            </div>
            <span className="w-fit rounded-full border bg-background px-3 py-1 text-xs font-semibold">
              {trialExpired ? "Teste encerrado — pagamento necessário" : subscription.data.status === "trialing" ? "Teste gratuito em andamento" : subscription.data.status === "active" ? "Ativa" : subscription.data.status}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-4"><p className="text-xs text-muted-foreground">Início do teste</p><p className="mt-1 font-semibold">{dateTime(subscription.data.trial_started_at)}</p></div>
            <div className="rounded-lg border bg-background p-4"><p className="text-xs text-muted-foreground">Fim do teste</p><p className="mt-1 font-semibold">{dateTime(subscription.data.trial_ends_at)}</p></div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{trialExpired ? "O período de avaliação terminou. Verifique a integração abaixo antes de liberar o fluxo de pagamento. Nenhuma cobrança é criada por este diagnóstico." : "A avaliação é concedida uma única vez por associação e não pode ser reiniciada."}</p>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">Diagnóstico do Mercado Pago</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Valida a credencial configurada no servidor e consulta os dados básicos da conta. Este teste não cria cobranças, preferências de checkout nem registros financeiros.</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void runPaymentDiagnostic()} disabled={diagnosticLoading || !associationId} className="shrink-0">
            {diagnosticLoading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Verificando…</> : "Verificar integração"}
          </Button>
        </div>
        {diagnosticResult && <div role="status" aria-live="polite" className={`mt-4 rounded-lg border p-4 text-sm ${diagnosticResult.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
          <p className="font-semibold">{diagnosticResult.ok ? "Credencial validada" : "Não foi possível validar a integração"}</p>
          <p className="mt-1">{diagnosticResult.message}</p>
          {diagnosticResult.ok && <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div><dt className="text-muted-foreground">ID da conta</dt><dd className="font-medium">{diagnosticResult.account_id ?? "Não informado"}</dd></div>
            <div><dt className="text-muted-foreground">Ambiente identificado pelo prefixo</dt><dd className="font-medium">{diagnosticResult.credential_environment ?? "Não identificado"}</dd></div>
            <div><dt className="text-muted-foreground">País</dt><dd className="font-medium">{diagnosticResult.country_id ?? "Não informado"}</dd></div>
            <div><dt className="text-muted-foreground">Site do Mercado Pago</dt><dd className="font-medium">{diagnosticResult.site_id ?? "Não informado"}</dd></div>
          </dl>}
        </div>}
        <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Testar checkout (sandbox)</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Cria uma preferência de teste de R$ 1,00 somente com credencial TEST-. Não altera assinaturas, pagamentos nem o status da associação. Nunca usa credencial de produção.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void runSandboxCheckout()} disabled={sandboxLoading || !associationId} className="shrink-0">
            {sandboxLoading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Criando teste…</> : <><CreditCard className="mr-2 h-4 w-4" /> Testar checkout (sandbox)</>}
          </Button>
        </div>
        {sandboxResult && <div role="status" aria-live="polite" className={`mt-4 rounded-lg border p-4 text-sm ${sandboxResult.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
          <p className="font-semibold">{sandboxResult.ok ? "Checkout de teste pronto" : "Checkout de teste não criado"}</p>
          <p className="mt-1">{sandboxResult.message}</p>
          {sandboxResult.url && <Button asChild className="mt-3"><a href={sandboxResult.url} target="_blank" rel="noopener noreferrer">Abrir checkout de teste</a></Button>}
        </div>}
      </section>

      <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Compare os planos</h2><p className="mt-1 text-sm text-muted-foreground">Preços por morador ativo, cobrados mensalmente por associação.</p></div></div>
      {plans.isLoading ? <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando planos…</div> : plans.isError ? <div role="alert" className="rounded-lg border p-4 text-sm">Não foi possível carregar os planos. <Button variant="link" onClick={() => void plans.refetch()}>Tentar novamente</Button></div> : (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.data?.map((plan) => {
            const active = selectedPlan === plan.code;
            return <section key={plan.code} className={`relative flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition-all ${plan.highlighted ? "border-primary ring-1 ring-primary/25" : ""} ${active ? "ring-2 ring-primary" : ""}`}>
              {plan.highlighted && <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Mais escolhido</span>}
              <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold">{plan.name}</h3>{plan.code === "premium" ? <Crown className="h-5 w-5 text-amber-500" /> : <Check className="h-5 w-5 text-primary" />}</div>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-4"><span className="text-3xl font-bold tracking-tight">{brl(plan.price_per_member_monthly)}</span><span className="text-xs text-muted-foreground"> / morador / mês</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Estimativa para {activeCount} morador(es) ativo(s): {brl(plan.price_per_member_monthly * activeCount)}/mês</p>
              <ul className="my-5 flex-1 space-y-2.5">{(Array.isArray(plan.features) ? plan.features : []).map((feature) => <li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul>
              {subscription.data ? <Button variant={subscription.data.plan_code === plan.code ? "default" : active ? "secondary" : "outline"} disabled={subscription.data.plan_code === plan.code} className="w-full" onClick={() => setSelectedPlan(plan.code)}>{subscription.data.plan_code === plan.code ? "Plano atual" : active ? "Selecionado para alteração" : "Selecionar plano"}</Button> : <Button variant={active ? "default" : "outline"} className="w-full" onClick={() => setSelectedPlan(plan.code)}>{active ? "Plano selecionado" : "Escolher plano"}</Button>}
            </section>;
          })}
        </div>
      )}

      {subscription.data && selected && selected.code !== subscription.data.plan_code && (
        <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold">Alterar plano da associação</p><p className="mt-1 text-sm text-muted-foreground">Novo plano: {selected.name} · estimativa {brl(monthlyEstimate)}/mês. A alteração de plano não inicia cobranças automaticamente.</p></div>
          <Button onClick={() => void changePlan()} disabled={saving} className="shrink-0">{saving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : "Confirmar alteração"}</Button>
        </section>
      )}

      {!subscription.data && (
        <section className="rounded-2xl border bg-card p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><MailCheck className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">Inicie os 10 dias de avaliação</h2><p className="mt-1 text-sm text-muted-foreground">A avaliação deve ser iniciada pelo administrador do sistema. Cada associação pode receber somente um período de avaliação.</p></div></div>
          {!account.data?.emailConfirmed && <p role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">Antes de continuar, confirme o e-mail da sua conta. O sistema só aceita um endereço confirmado pelo processo de autenticação.</p>}
          <form onSubmit={startTrial} className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="billing-cpf">CPF do responsável financeiro</Label><Input id="billing-cpf" autoComplete="off" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(event) => setCpf(maskInputCPF(event.target.value))} required maxLength={14} /><p className="mt-1 text-xs text-muted-foreground">Validado pelo sistema antes de registrar o teste.</p></div>
            <div><Label htmlFor="billing-email">E-mail de faturamento da associação</Label><Input id="billing-email" type="email" autoComplete="email" placeholder="financeiro@associacao.org.br" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} required /><p className="mt-1 text-xs text-muted-foreground">Informe o contato financeiro desta associação. O endereço deve ser único entre as assinaturas.</p></div>
            <div className="sm:col-span-2 rounded-lg bg-muted/50 p-4 text-sm"><p className="font-medium">Resumo do plano {selected?.name ?? ""}</p><p className="mt-1 text-muted-foreground">{activeCount} moradores ativos × {brl(selected?.price_per_member_monthly ?? 0)} = <strong className="text-foreground">{brl(monthlyEstimate)}/mês</strong> após o teste. Nenhuma cobrança será iniciada por esta tela.</p></div>
            <Button type="submit" className="sm:col-span-2" disabled={saving || !selected || !account.data?.emailConfirmed || subscription.isLoading || !residents.data && residents.isLoading}>{saving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Ativando teste…</> : "Começar teste gratuito de 10 dias"}</Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">Importante: o teste gratuito não gera cobrança. A verificação de integração está disponível no painel administrativo e não cria pagamentos.</p>
        </section>
      )}
    </div>
  );
}

function maskInputCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.replace(/^(\d{3})(\d+)/, "$1.$2");
  if (d.length <= 9) return d.replace(/^(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, "$1.$2.$3-$4");
}
