import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Copy, ImagePlus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isValidCNPJ } from "@/lib/roles";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";

type AssociationSettings = Pick<
  Database["public"]["Tables"]["associations"]["Row"],
  "id" | "name" | "association_code" | "trade_name" | "cnpj" | "email" | "phone" | "address" | "zip_code" | "city" | "state" | "logo_url" | "status"
>;

const LOGO_BUCKET = "association-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações da associação — Morada360" }] }),
  component: AssociationSettingsPage,
});

function AssociationSettingsPage() {
  const { current, userId } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const canEdit = current?.role === "admin" || current?.role === "presidente";
  const [saving, setSaving] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLogo) {
      setLogoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedLogo);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedLogo]);

  const settings = useQuery({
    queryKey: ["association-settings", associationId],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return null;
      const { data, error } = await supabase
        .from("associations")
        .select("id,name,association_code,trade_name,cnpj,email,phone,address,zip_code,city,state,logo_url,status")
        .eq("id", associationId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AssociationSettings | null;
    },
  });

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !canEdit || !settings.data) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const tradeName = String(form.get("trade_name") ?? "").trim();
    const cnpj = String(form.get("cnpj") ?? "").trim().toUpperCase();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    const zipCode = String(form.get("zip_code") ?? "").replace(/\D/g, "").slice(0, 8);
    const city = String(form.get("city") ?? "").trim();
    const state = String(form.get("state") ?? "").trim().toUpperCase();

    if (name.length < 3 || name.length > 120) {
      toast.error("O nome oficial deve ter entre 3 e 120 caracteres.");
      return;
    }
    if (tradeName.length > 120 || email.length > 254 || phone.length > 30 || address.length > 200 || city.length > 120) {
      toast.error("Revise os campos: um ou mais valores ultrapassam o limite permitido.");
      return;
    }
    if (cnpj && !isValidCNPJ(cnpj)) {
      toast.error("Informe um CNPJ válido, numérico ou alfanumérico.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um endereço de e-mail válido.");
      return;
    }
    if (state && !/^[A-Z]{2}$/.test(state)) {
      toast.error("Informe uma UF válida com duas letras.");
      return;
    }
    if (selectedLogo && !LOGO_TYPES.includes(selectedLogo.type)) {
      toast.error("A logo deve estar em PNG, JPG ou WEBP.");
      return;
    }
    if (selectedLogo && selectedLogo.size > MAX_LOGO_BYTES) {
      toast.error("A logo deve ter no máximo 2 MB.");
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let logoUrl = removeLogo ? null : settings.data.logo_url;
      if (selectedLogo) {
        const extension = selectedLogo.type === "image/jpeg" ? "jpg" : selectedLogo.type === "image/webp" ? "webp" : "png";
        uploadedPath = `${associationId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(uploadedPath, selectedLogo, {
          cacheControl: "3600",
          contentType: selectedLogo.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("associations")
        .update({
          name,
          trade_name: tradeName || null,
          cnpj: cnpj || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          zip_code: zipCode || null,
          city: city || null,
          state: state || null,
          logo_url: logoUrl,
        })
        .eq("id", associationId)
        .select("id")
        .maybeSingle();

      if (error) {
        if (uploadedPath) await supabase.storage.from(LOGO_BUCKET).remove([uploadedPath]);
        if (error.code === "23505") {
          toast.error("Este CNPJ já está cadastrado em outra associação.");
          return;
        }
        if (error.code === "23514") {
          toast.error("Algum campo não passou na validação do banco.");
          return;
        }
        throw error;
      }
      if (!data) {
        if (uploadedPath) await supabase.storage.from(LOGO_BUCKET).remove([uploadedPath]);
        toast.error("Associação não encontrada ou sem permissão para editar.");
        return;
      }

      const previousLogo = settings.data.logo_url;
      if ((selectedLogo || removeLogo) && previousLogo) {
        const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
        const oldPath = previousLogo.includes(marker) ? previousLogo.split(marker)[1] : null;
        if (oldPath) await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);
      }

      toast.success("Configurações da associação salvas.");
      setSelectedLogo(null);
      setRemoveLogo(false);
      await queryClient.invalidateQueries({ queryKey: ["association-settings", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["memberships", userId] });
    } catch {
      if (uploadedPath) await supabase.storage.from(LOGO_BUCKET).remove([uploadedPath]);
      toast.error("Não foi possível salvar as configurações. Confira a conexão, o armazenamento e suas permissões.");
    } finally {
      setSaving(false);
    }
  }

  if (!current) return null;
  if (!canEdit) {
    return (
      <div className="rounded-xl border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Somente administradores e presidentes podem alterar os dados institucionais da associação.</p>
      </div>
    );
  }

  const currentLogo = removeLogo ? null : logoPreview ?? settings.data?.logo_url ?? null;

  return (
    <>
      <PageHeader title="Configurações" description="Gerencie a identidade visual, os dados cadastrais e as informações de contato da associação." />
      {settings.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível carregar as configurações. <Button variant="link" className="px-0" onClick={() => void settings.refetch()}>Tentar novamente</Button></div>}
      {settings.isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando dados da associação…</div>
      ) : settings.data ? (
        <form key={settings.data.id} onSubmit={saveSettings} className="w-full max-w-4xl space-y-5 sm:space-y-6">
          <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                {currentLogo ? <img src={currentLogo} alt="Logo da associação" className="h-full w-full object-contain" /> : <Building2 className="h-5 w-5" />}
              </div>
              <div className="min-w-0"><h2 className="font-semibold">Identidade visual</h2><p className="text-sm text-muted-foreground">Personalize a marca exibida no ambiente da associação.</p></div>
            </div>
            <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
              <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed bg-muted/30 p-4">
                {currentLogo ? <img src={currentLogo} alt="Pré-visualização da logo" className="max-h-32 max-w-full object-contain" /> : <div className="text-center text-muted-foreground"><ImagePlus className="mx-auto mb-2 h-8 w-8" /><span className="text-sm">Nenhuma logo enviada</span></div>}
              </div>
              <div className="space-y-3">
                <Label htmlFor="association-logo">Logo da associação</Label>
                <Input id="association-logo" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto min-h-11 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground" onChange={(event) => { const file = event.target.files?.[0] ?? null; setSelectedLogo(file); if (file) setRemoveLogo(false); }} />
                <p className="text-xs leading-5 text-muted-foreground">Formatos aceitos: PNG, JPG ou WEBP. Tamanho máximo: 2 MB. Uma imagem quadrada ou com fundo transparente costuma funcionar melhor.</p>
                {settings.data.logo_url && !removeLogo && <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedLogo(null); setRemoveLogo(true); }}><Trash2 className="mr-2 h-4 w-4" /> Remover logo atual</Button>}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-6">
            <div className="border-b pb-4">
              <h2 className="font-semibold">Código da associação</h2>
              <p className="mt-1 text-sm text-muted-foreground">Compartilhe este código de 6 dígitos com quem solicitar acesso à AMBRAS. A entrada continua sujeita à aprovação administrativa.</p>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div aria-label={`Código da associação: ${settings.data.association_code}`} className="inline-flex min-h-14 items-center rounded-lg bg-muted px-4 font-mono text-2xl font-bold tracking-[0.25em]">
                {settings.data.association_code}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(settings.data!.association_code);
                    toast.success("Código copiado.");
                  } catch {
                    toast.error("Não foi possível copiar automaticamente. Selecione e copie o código.");
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar código
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-5 border-b pb-4"><h2 className="font-semibold">Dados da associação</h2><p className="mt-1 text-sm text-muted-foreground">Informações oficiais e nome de exibição.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="association-name">Nome oficial *</Label><Input id="association-name" name="name" required minLength={3} maxLength={120} defaultValue={settings.data.name} /></div>
              <div><Label htmlFor="association-trade-name">Nome fantasia</Label><Input id="association-trade-name" name="trade_name" maxLength={120} defaultValue={settings.data.trade_name ?? ""} placeholder="Nome usado no dia a dia" /></div>
              <div><Label htmlFor="association-cnpj">CNPJ</Label><Input id="association-cnpj" name="cnpj" inputMode="text" autoCapitalize="characters" maxLength={18} defaultValue={settings.data.cnpj ?? ""} placeholder="CNPJ da associação" /><p className="mt-1 text-xs text-muted-foreground">Aceita o formato numérico tradicional e o alfanumérico.</p></div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-5 border-b pb-4"><h2 className="font-semibold">Contato</h2><p className="mt-1 text-sm text-muted-foreground">Canais para comunicação com moradores, prestadores e fornecedores.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="association-email">E-mail institucional</Label><Input id="association-email" name="email" type="email" autoComplete="email" maxLength={254} defaultValue={settings.data.email ?? ""} placeholder="contato@associacao.com.br" /></div>
              <div><Label htmlFor="association-phone">Telefone</Label><Input id="association-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={settings.data.phone ?? ""} placeholder="(00) 00000-0000" /></div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-5 border-b pb-4"><h2 className="font-semibold">Endereço</h2><p className="mt-1 text-sm text-muted-foreground">Endereço administrativo ou correspondência oficial.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="association-address">Logradouro, número e complemento</Label><Input id="association-address" name="address" maxLength={200} autoComplete="street-address" defaultValue={settings.data.address ?? ""} placeholder="Rua, número, sala ou complemento" /></div>
              <div><Label htmlFor="association-zip">CEP</Label><Input id="association-zip" name="zip_code" inputMode="numeric" autoComplete="postal-code" maxLength={9} defaultValue={settings.data.zip_code ?? ""} placeholder="00000-000" /></div>
              <div><Label htmlFor="association-city">Cidade</Label><Input id="association-city" name="city" maxLength={120} autoComplete="address-level2" defaultValue={settings.data.city ?? ""} /></div>
              <div><Label htmlFor="association-state">Estado (UF)</Label><Input id="association-state" name="state" maxLength={2} autoCapitalize="characters" autoComplete="address-level1" defaultValue={settings.data.state ?? ""} placeholder="SP" /></div>
              <div><Label>Status cadastral</Label><div className="flex min-h-10 items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span>{settings.data.status || "Não informado"}</span><span className="text-muted-foreground">(gerenciado pelo sistema)</span></div></div>
            </div>
          </section>

          <div className="sticky bottom-2 z-10 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={() => { setSelectedLogo(null); setRemoveLogo(false); void settings.refetch(); }}>Descartar alterações</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving || settings.isLoading}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar configurações"}</Button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Os dados desta associação não estão disponíveis.</div>
      )}
    </>
  );
}
