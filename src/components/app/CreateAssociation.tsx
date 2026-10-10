import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateAssociation({ onDone }: { onDone?: () => void }) {
  const { refetch, setCurrentId } = useAssoc();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabase.rpc("create_association", {
      _name: String(f.get("name")),
      _cnpj: String(f.get("cnpj") || "") || undefined,
      _city: String(f.get("city") || "") || undefined,
      _state: String(f.get("state") || "") || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Associação criada");
    setCurrentId(data as string);
    refetch();
    onDone?.();
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-soft">
      <div><Label htmlFor="name">Nome da associação</Label><Input id="name" name="name" minLength={3} required /></div>
      <div><Label htmlFor="cnpj">CNPJ (opcional)</Label><Input id="cnpj" name="cnpj" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label htmlFor="city">Cidade</Label><Input id="city" name="city" /></div>
        <div><Label htmlFor="state">UF</Label><Input id="state" name="state" maxLength={2} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>Criar associação</Button>
    </form>
  );
}
