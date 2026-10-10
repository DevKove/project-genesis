import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isValidCNPJ } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateAssociation({ onDone }: { onDone?: () => void }) {
  const { refetch, setCurrentId } = useAssoc();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (name.length < 3 || name.length > 120) {
      toast.error("O nome da associação deve ter entre 3 e 120 caracteres.");
      return;
    }
    const cnpj = String(f.get("cnpj") ?? "").trim().toUpperCase();
    if (cnpj && !isValidCNPJ(cnpj)) {
      toast.error("Informe um CNPJ válido, numérico ou alfanumérico.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_association", ({
        _name: name,
        _cnpj: cnpj || undefined,
        _city: String(f.get("city") || "").trim() || undefined,
        _state: String(f.get("state") || "").trim().toUpperCase() || undefined,
      }) as { _name: string });
      if (error) {
        toast.error("Não foi possível criar a associação. Confira os dados e tente novamente.");
        return;
      }
      if (typeof data !== "string" || !data) {
        toast.error("A associação não foi criada corretamente. Tente novamente.");
        return;
      }
      toast.success("Associação criada");
      setCurrentId(data);
      await refetch();
      onDone?.();
    } catch {
      toast.error("Não foi possível criar a associação agora. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-soft">
      <div><Label htmlFor="name">Nome da associação</Label><Input id="name" name="name" minLength={3} required /></div>
      <div><Label htmlFor="cnpj">CNPJ (opcional)</Label><Input id="cnpj" name="cnpj" inputMode="text" autoCapitalize="characters" maxLength={18} placeholder="00.000.000/0001-91 ou 00.000.000/E08G-12" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label htmlFor="city">Cidade</Label><Input id="city" name="city" /></div>
        <div><Label htmlFor="state">UF</Label><Input id="state" name="state" maxLength={2} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando…" : "Criar associação"}</Button>
    </form>
  );
}
