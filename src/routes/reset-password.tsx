import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Morada360" },
      { name: "description", content: "Defina uma nova senha para sua conta Morada360." },
      { property: "og:title", content: "Redefinir senha — Morada360" },
      { property: "og:description", content: "Defina uma nova senha para sua conta Morada360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Mínimo de 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error("Não foi possível atualizar a senha. Confirme se o link ainda é válido.");
        return;
      }
      toast.success("Senha atualizada");
      await navigate({ to: "/app" });
    } catch {
      toast.error("Não foi possível atualizar a senha agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-bold">Nova senha</h1>
        <div>
          <Label htmlFor="pw">Senha</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
      </form>
    </div>
  );
}
