import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { isManager } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
const BUCKET = "association-documents";
const PAGE_SIZE = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  atas: "Atas",
  financeiro: "Financeiro",
  contratos: "Contratos",
  regulamentos: "Regulamentos",
  manutencao: "Manutenção",
  outros: "Outros",
};

export const Route = createFileRoute("/_authenticated/app/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Morada360" }] }),
  component: DocumentsPage,
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFileName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  return !safe || safe === "." || safe === ".." ? "document" : safe;
}

function DocumentsPage() {
  const { current, userId } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const manager = isManager(current?.role);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const documents = useQuery({
    queryKey: ["documents", associationId, search, categoryFilter, visibilityFilter, page],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return { items: [] as DocumentRow[], count: 0 };
      let query = supabase
        .from("documents")
        .select("id,association_id,uploaded_by,title,description,category,visibility,file_path,mime_type,size_bytes,created_at,updated_at,deleted_at", { count: "exact" })
        .eq("association_id", associationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (manager && visibilityFilter !== "all") query = query.eq("visibility", visibilityFilter);

      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as DocumentRow[], count: count ?? 0 };
    },
  });

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !manager) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "geral");
    const visibility = String(form.get("visibility") ?? "associacao");
    const fileValue = form.get("file");

    if (title.length < 1 || title.length > 160) {
      toast.error("O título deve ter entre 1 e 160 caracteres.");
      return;
    }
    if (description.length > 2000) {
      toast.error("A descrição deve ter no máximo 2.000 caracteres.");
      return;
    }
    if (!(fileValue instanceof File) || fileValue.size < 1) {
      toast.error("Selecione um arquivo válido.");
      return;
    }
    if (fileValue.size > MAX_FILE_SIZE) {
      toast.error("O arquivo excede o limite de 20 MB.");
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      toast.error("Formato não permitido. Use PDF, imagens, texto, CSV, Word ou Excel.");
      return;
    }
    if (!(category in CATEGORY_LABELS) || !["associacao", "gestores"].includes(visibility)) {
      toast.error("Categoria ou visibilidade inválida.");
      return;
    }

    setUploading(true);
    let metadataId: string | null = null;
    try {
      const documentId = crypto.randomUUID();
      const filePath = `${associationId}/${documentId}/${safeFileName(fileValue.name)}`;
      const { error: metadataError } = await supabase.from("documents").insert({
        id: documentId,
        association_id: associationId,
        uploaded_by: userId,
        title,
        description: description || null,
        category,
        visibility,
        file_path: filePath,
        mime_type: fileValue.type,
        size_bytes: fileValue.size,
      });
      if (metadataError) throw metadataError;
      metadataId = documentId;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, fileValue, {
        cacheControl: "3600",
        contentType: fileValue.type,
        upsert: false,
      });
      if (uploadError) {
        await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId).eq("association_id", associationId);
        metadataId = null;
        throw uploadError;
      }

      toast.success("Documento enviado com segurança.");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["documents", associationId] });
    } catch {
      if (metadataId) {
        await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", metadataId).eq("association_id", associationId);
      }
      toast.error("Não foi possível enviar o documento. Verifique o formato, o tamanho e suas permissões.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadDocument(item: DocumentRow) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.file_path, 60, { download: true });
      if (error || !data?.signedUrl) {
        toast.error("Não foi possível gerar um link temporário para este documento.");
        return;
      }
      window.location.assign(data.signedUrl);
    } catch {
      toast.error("Não foi possível baixar o documento.");
    }
  }

  async function deleteDocument(item: DocumentRow) {
    if (!associationId || !manager) return;
    setDeleting(true);
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.file_path]);
      if (storageError) {
        toast.error("Não foi possível remover o arquivo. O registro foi mantido.");
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("association_id", associationId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("O arquivo foi removido, mas o registro não foi arquivado. Tente novamente.");
        return;
      }

      setDeleteTarget(null);
      toast.success("Documento removido.");
      await queryClient.invalidateQueries({ queryKey: ["documents", associationId] });
    } catch {
      toast.error("Não foi possível remover o documento. Verifique suas permissões.");
    } finally {
      setDeleting(false);
    }
  }

  if (!current) return null;
  const total = documents.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Arquivos privados da associação, com acesso controlado por papel e vínculo."
        action={manager ? <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Enviar documento</Button> : undefined}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" aria-label="Buscar documento" placeholder="Buscar pelo título…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        </div>
        <select aria-label="Filtrar por categoria" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(0); }}>
          <option value="all">Todas as categorias</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {manager && <select aria-label="Filtrar por visibilidade" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={visibilityFilter} onChange={(event) => { setVisibilityFilter(event.target.value); setPage(0); }}>
          <option value="all">Todas as visibilidades</option>
          <option value="associacao">Todos os membros</option>
          <option value="gestores">Somente gestores</option>
        </select>}
      </div>

      {formOpen && manager && (
        <form onSubmit={uploadDocument} className="mb-6 space-y-4 rounded-xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Enviar documento</h2><Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => setFormOpen(false)}><X className="h-4 w-4" /></Button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="document-title">Título *</Label><Input id="document-title" name="title" required maxLength={160} /></div>
            <div><Label htmlFor="document-category">Categoria *</Label><select id="document-category" name="category" defaultValue="geral" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><Label htmlFor="document-visibility">Visibilidade *</Label><select id="document-visibility" name="visibility" defaultValue="associacao" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="associacao">Todos os membros</option><option value="gestores">Somente gestores</option></select></div>
            <div><Label htmlFor="document-file">Arquivo (máximo 20 MB) *</Label><Input id="document-file" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
          </div>
          <div><Label htmlFor="document-description">Descrição</Label><Textarea id="document-description" name="description" maxLength={2000} rows={3} /></div>
          <p className="text-xs text-muted-foreground">Os arquivos ficam em um bucket privado. O acesso é validado pelo servidor; links de download expiram em 60 segundos.</p>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={uploading}>{uploading ? <><Upload className="mr-2 h-4 w-4 animate-pulse" /> Enviando…</> : <><Upload className="mr-2 h-4 w-4" /> Enviar documento</>}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button></div>
        </form>
      )}

      {deleteTarget && manager && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Remover <strong>{deleteTarget.title}</strong>? O arquivo será excluído e o registro ficará arquivado para auditoria.</p>
          <div className="flex gap-2"><Button variant="destructive" size="sm" disabled={deleting} onClick={() => void deleteDocument(deleteTarget)}>{deleting ? "Removendo…" : "Confirmar remoção"}</Button><Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button></div>
        </div>
      )}

      {documents.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">Não foi possível carregar os documentos. <Button variant="link" className="px-0" onClick={() => void documents.refetch()}>Tentar novamente</Button></div>}

      <div className="overflow-hidden rounded-xl border bg-card">
        {documents.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando documentos…</p> : documents.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Documento</th><th className="px-4 py-3 font-medium">Categoria</th><th className="px-4 py-3 font-medium">Visibilidade</th><th className="px-4 py-3 font-medium">Tamanho</th><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr></thead>
              <tbody className="divide-y">
                {documents.data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><div className="font-medium">{item.title}</div>{item.description && <div className="max-w-sm truncate text-xs text-muted-foreground">{item.description}</div>}<div className="text-xs text-muted-foreground">{item.mime_type}</div></div></div></td>
                    <td className="px-4 py-3">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.visibility === "gestores" ? "Gestores" : "Todos os membros"}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatBytes(item.size_bytes)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Baixar ${item.title}`} onClick={() => void downloadDocument(item)}><Download className="h-4 w-4" /></Button>{manager && <Button variant="ghost" size="icon" aria-label={`Remover ${item.title}`} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><FileText className="h-6 w-6" /></div><p>Nenhum documento disponível.</p>{manager && <Button className="mt-4" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Enviar primeiro documento</Button>}</EmptyState>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{total} documento(s)</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0 || documents.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Anterior</Button><span>Página {page + 1} de {totalPages}</span><Button variant="outline" size="sm" disabled={page + 1 >= totalPages || documents.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></div>
    </>
  );
}
