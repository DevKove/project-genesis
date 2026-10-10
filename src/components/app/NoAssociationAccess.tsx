import { useQuery } from "@tanstack/react-query";
import { Building2, Clock3, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreateAssociation } from "@/components/app/CreateAssociation";
import { Button } from "@/components/ui/button";

type JoinRequestStatus = {
  id: string;
  association_name: string;
  status: string;
  requested_at: string;
  review_note: string | null;
};

export function NoAssociationAccess({ userId }: { userId: string }) {
  const request = useQuery({
    queryKey: ["my-association-join-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("association_join_requests")
        .select("id,association_name,status,requested_at,review_note")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as JoinRequestStatus | null;
    },
  });

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) window.location.assign("/auth");
  }

  if (request.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Verificando o status do seu acesso…</div>;
  }

  if (request.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-soft">
          <ShieldAlert className="mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-xl font-semibold">Não foi possível verificar seu acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Por segurança, não liberamos o cadastro de uma nova associação enquanto o status da sua solicitação não puder ser confirmado.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void request.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button><Button variant="outline" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button></div>
        </section>
      </div>
    );
  }

  const latest = request.data;
  if (latest?.status === "pendente") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="mb-4 inline-flex rounded-full bg-amber-500/10 p-3 text-amber-700"><Clock3 className="h-7 w-7" /></div>
          <h1 className="text-2xl font-bold">Aguardando aprovação</h1>
          <p className="mt-2 text-muted-foreground">Sua solicitação para participar de <strong>{latest.association_name}</strong> foi recebida em {new Date(latest.requested_at).toLocaleDateString("pt-BR")}.</p>
          <p className="mt-3 text-sm text-muted-foreground">Você poderá acessar as áreas da associação depois que o administrador aprovar seu cadastro. Esta tela será atualizada quando você entrar novamente ou recarregar.</p>
          <div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => void request.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar status</Button><Button variant="outline" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button></div>
        </section>
      </div>
    );
  }

  if (latest?.status === "rejeitado") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="mb-4 inline-flex rounded-full bg-destructive/10 p-3 text-destructive"><ShieldAlert className="h-7 w-7" /></div>
          <h1 className="text-2xl font-bold">Solicitação não aprovada</h1>
          <p className="mt-2 text-muted-foreground">O administrador não aprovou sua solicitação para <strong>{latest.association_name}</strong>.</p>
          {latest.review_note && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">Observação: {latest.review_note}</p>}
          <p className="mt-3 text-sm text-muted-foreground">Entre em contato com a administração da associação para esclarecer a decisão.</p>
          <Button className="mt-6" variant="outline" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-center gap-3"><Building2 className="h-8 w-8 text-primary" /><div><h1 className="text-3xl font-bold">Configure sua associação</h1><p className="mt-1 text-sm text-muted-foreground">Sua conta ainda não está vinculada a uma associação.</p></div></div>
        <CreateAssociation />
        <Button className="mt-5" variant="ghost" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
      </div>
    </div>
  );
}
