import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarClock, Check, CreditCard, Crown, LoaderCircle, MailCheck, ShieldCheck, Users } from "lucide-react";
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

  async function startManualPayment() {
    if (!associationId || paymentLoading) return;
    setPaymentLoading(true);
    try {
      if (memberBilling.data?.latest_payment_status === "PENDING" && memberBilling.data.latest_payment_url) {
        window.location.assign(memberBilling.data.latest_payment_url);
        return;
      }
      const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: { association_id: associationId },
      });
      if (error) throw error;
      if (!data?.ok || typeof data.checkout_url !== "string") {
        throw new Error(data?.error || "Não foi possível gerar o link de pagamento.");
      }
      window.location.assign(data.checkout_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.");
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
            return (needsPayment || pendingCheckout) ? <div className="mt-5 rounded-xl border border-primary/30 bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold">{pendingCheckout ? "Pagamento mensal pendente" : "Renovar plano do Morada360"}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{pendingCheckout ? "Continue para o Mercado Pago e conclua o pagamento. O plano será atualizado após confirmação segura." : "Seu teste ou período pago terminou. Gere uma cobrança mensal manual pelo Mercado Pago."}</p>
                  {memberBilling.data.latest_payment_amount != null && pendingCheckout && <p className="mt-1 text-sm font-medium">Valor: {brl(Number(memberBilling.data.latest_payment_amount))}</p>}
                </div>
                <Button onClick={() => void startManualPayment()} disabled={paymentLoading} className="shrink-0">
                  {paymentLoading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Preparando…</> : <><CreditCard className="mr-2 h-4 w-4" /> {pendingCheckout ? "Continuar pagamento" : "Pagar mensalidade"}</>}
                </Button>
              </div>
            </div> : null;
          })()}
        </section>
        {memberBilling.isError && <div role="status" className="rounded-lg border p-3 text-xs text-muted-foreground">O status detalhado da cobrança não está disponível no momento.</div>}
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
          <p className="mt-4 text-sm text-muted-foreground">{trialExpired ? "O período de teste terminou. A integração de pagamentos será configurada em uma etapa separada." : "A avaliação é concedida uma única vez por associação e não pode ser reiniciada."}</p>
        </section>
      )}

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
          <p className="mt-4 text-xs text-muted-foreground">Importante: o teste gratuito não gera cobrança. A integração com o novo provedor de pagamentos será configurada separadamente.</p>
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
