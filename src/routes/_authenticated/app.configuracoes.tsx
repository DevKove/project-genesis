import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isValidCNPJ } from "@/lib/roles";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";

type AssociationSettings = Pick<Database["public"]["Tables"]["associations"]["Row"], "id" | "name" | "cnpj" | "city" | "state">;

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

  const settings = useQuery({
    queryKey: ["association-settings", associationId],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return null;
      const { data, error } = await supabase
        .from("associations")
        .select("id,name,cnpj,city,state")
        .eq("id", associationId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AssociationSettings | null;
    },
  });

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !canEdit) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const cnpj = String(form.get("cnpj") ?? "").trim().toUpperCase();
    const city = String(form.get("city") ?? "").trim();
    const state = String(form.get("state") ?? "").trim().toUpperCase();

    if (name.length < 3 || name.length > 120) {
      toast.error("O nome deve ter entre 3 e 120 caracteres.");
      return;
    }
    if (cnpj && !isValidCNPJ(cnpj)) {
      toast.error("Informe um CNPJ válido, numérico ou alfanumérico.");
      return;
    }
    if (city.length > 120) {
      toast.error("A cidade deve ter no máximo 120 caracteres.");
      return;
    }
    if (state && !/^[A-Z]{2}$/.test(state)) {
      toast.error("Informe uma UF válida com duas letras.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("associations")
        .update({
          name,
          cnpj: cnpj || null,
          city: city || null,
          state: state || null,
        })
        .eq("id", associationId)
        .select("id")
        .maybeSingle();

      if (error) {
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
        toast.error("Associação não encontrada ou sem permissão para editar.");
        return;
      }

      toast.success("Configurações da associação salvas.");
      await queryClient.invalidateQueries({ queryKey: ["association-settings", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["memberships", userId] });
    } catch {
      toast.error("Não foi possível salvar as configurações. Verifique os dados e suas permissões.");
    } finally {
      setSaving(false);
    }
  }

  if (!current) return null;
  if (!canEdit) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Somente administradores e presidentes podem alterar os dados institucionais da associação.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Configurações da associação" description="Mantenha os dados institucionais atualizados." />
      {settings.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível carregar as configurações. <Button variant="link" className="px-0" onClick={() => void settings.refetch()}>Tentar novamente</Button></div>}
      {settings.isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando dados da associação…</div>
      ) : settings.data ? (
        <form key={settings.data.id} onSubmit={saveSettings} className="max-w-3xl space-y-5 rounded-xl border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex items-center gap-3 border-b pb-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><div><h2 className="font-semibold">{settings.data.name}</h2><p className="text-xs text-muted-foreground">Identificador: {settings.data.id}</p></div></div>
          <div><Label htmlFor="association-name">Nome da associação *</Label><Input id="association-name" name="name" required minLength={3} maxLength={120} defaultValue={settings.data.name} /></div>
          <div><Label htmlFor="association-cnpj">CNPJ</Label><Input id="association-cnpj" name="cnpj" inputMode="text" autoCapitalize="characters" maxLength={18} defaultValue={settings.data.cnpj ?? ""} placeholder="00.000.000/0001-91 ou 00.000.000/E08G-12" /><p className="mt-1 text-xs text-muted-foreground">Aceita o formato numérico tradicional e o novo formato alfanumérico.</p></div>
          <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
            <div><Label htmlFor="association-city">Cidade</Label><Input id="association-city" name="city" maxLength={120} defaultValue={settings.data.city ?? ""} /></div>
            <div><Label htmlFor="association-state">UF</Label><Input id="association-state" name="state" maxLength={2} defaultValue={settings.data.state ?? ""} /></div>
          </div>
          <Button type="submit" disabled={saving || settings.isLoading}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar configurações"}</Button>
        </form>
      ) : (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Os dados desta associação não estão disponíveis.</div>
      )}
    </>
  );
}
