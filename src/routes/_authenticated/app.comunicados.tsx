import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ChevronLeft, ChevronRight, Megaphone, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAssoc } from "@/lib/assoc-context";
import { canManageAnnouncements } from "@/lib/roles";
import { PageHeader, EmptyState } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/app/comunicados")({
  head: () => ({ meta: [{ title: "Comunicados — Morada360" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { current, userId } = useAssoc();
  const queryClient = useQueryClient();
  const associationId = current?.association_id;
  const manager = canManageAnnouncements(current?.role);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPin, setChangingPin] = useState<string | null>(null);

  const announcements = useQuery({
    queryKey: ["announcements", associationId, search, filter, page],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return { items: [] as AnnouncementRow[], count: 0 };
      let query = supabase
        .from("announcements")
        .select("id,association_id,title,body,pinned,created_by,created_at", { count: "exact" })
        .eq("association_id", associationId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      if (filter === "pinned") query = query.eq("pinned", true);
      if (filter === "regular") query = query.eq("pinned", false);

      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as AnnouncementRow[], count: count ?? 0 };
    },
  });

  function startCreate() {
    setEditing(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }

  function startEdit(item: AnnouncementRow) {
    setEditing(item);
    setFormOpen(true);
    setDeleteTarget(null);
  }

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!associationId || !manager) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    const pinned = form.get("pinned") === "on";

    if (title.length < 1 || title.length > 160) {
      toast.error("O título deve ter entre 1 e 160 caracteres.");
      return;
    }
    if (body.length < 1 || body.length > 10000) {
      toast.error("O texto do comunicado deve ter entre 1 e 10.000 caracteres.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { data, error } = await supabase
          .from("announcements")
          .update({ title, body, pinned })
          .eq("id", editing.id)
          .eq("association_id", associationId)
          .select("id")
          .maybeSingle();
        if (error) {
          if (error.code === "23514") {
            toast.error("O título ou o texto ultrapassa os limites permitidos.");
            return;
          }
          throw error;
        }
        if (!data) {
          toast.error("Comunicado não encontrado ou sem permissão para alterá-lo.");
          return;
        }
        toast.success("Comunicado atualizado.");
      } else {
        const { error } = await supabase.from("announcements").insert({
          association_id: associationId,
          created_by: userId,
          title,
          body,
          pinned,
        });
        if (error) {
          if (error.code === "23514") {
            toast.error("O título ou o texto ultrapassa os limites permitidos.");
            return;
          }
          throw error;
        }
        toast.success("Comunicado publicado.");
      }

      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["announcements", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível salvar o comunicado. Verifique os dados e suas permissões.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePinned(item: AnnouncementRow) {
    if (!associationId || !manager) return;
    setChangingPin(item.id);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .update({ pinned: !item.pinned })
        .eq("id", item.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Comunicado não encontrado ou sem permissão para alterá-lo.");
        return;
      }
      toast.success(item.pinned ? "Comunicado desafixado." : "Comunicado fixado no topo.");
      await queryClient.invalidateQueries({ queryKey: ["announcements", associationId] });
    } catch {
      toast.error("Não foi possível alterar o destaque do comunicado.");
    } finally {
      setChangingPin(null);
    }
  }

  async function deleteAnnouncement(item: AnnouncementRow) {
    if (!associationId || !manager) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", item.id)
        .eq("association_id", associationId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Comunicado não encontrado ou sem permissão para excluí-lo.");
        return;
      }
      toast.success("Comunicado excluído.");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["announcements", associationId] });
      await queryClient.invalidateQueries({ queryKey: ["stats", associationId] });
    } catch {
      toast.error("Não foi possível excluir o comunicado.");
    } finally {
      setDeleting(false);
    }
  }

  if (!current) return null;
  const total = announcements.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Comunicados"
        description="Avisos e informações publicados para os membros da associação."
        action={manager ? <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Novo comunicado</Button> : undefined}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" aria-label="Buscar comunicado" placeholder="Buscar pelo título…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        </div>
        <select aria-label="Filtrar comunicados" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }}>
          <option value="all">Todos os comunicados</option>
          <option value="pinned">Fixados</option>
          <option value="regular">Não fixados</option>
        </select>
      </div>

      {formOpen && manager && (
        <form key={editing?.id ?? "new"} onSubmit={saveAnnouncement} className="mb-6 space-y-4 rounded-lg border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editing ? "Editar comunicado" : "Novo comunicado"}</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => { setFormOpen(false); setEditing(null); }}><X className="h-4 w-4" /></Button>
          </div>
          <div><Label htmlFor="announcement-title">Título *</Label><Input id="announcement-title" name="title" required maxLength={160} defaultValue={editing?.title ?? ""} /></div>
          <div><Label htmlFor="announcement-body">Texto *</Label><Textarea id="announcement-body" name="body" required maxLength={10000} rows={7} defaultValue={editing?.body ?? ""} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" defaultChecked={editing?.pinned ?? false} className="h-4 w-4 rounded border-input" /> Fixar no topo dos comunicados</label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Publicar comunicado"}</Button>
            <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancelar</Button>
          </div>
        </form>
      )}

      {deleteTarget && manager && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Confirma a exclusão do comunicado <strong>{deleteTarget.title}</strong>? A exclusão não pode ser desfeita.</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={deleting} onClick={() => void deleteAnnouncement(deleteTarget)}>{deleting ? "Excluindo…" : "Confirmar exclusão"}</Button>
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {announcements.isError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm">
          <p>Não foi possível carregar os comunicados.</p>
          <Button variant="link" className="px-0" onClick={() => void announcements.refetch()}>Tentar novamente</Button>
        </div>
      )}

      {announcements.isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Carregando comunicados…</div>
      ) : announcements.data?.items.length ? (
        <div className="space-y-3">
          {announcements.data.items.map((item) => (
            <article key={item.id} className="rounded-lg border bg-card p-5 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {item.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><Pin className="h-3 w-3" /> Fixado</span>}
                    <time className="text-xs text-muted-foreground" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("pt-BR")}</time>
                  </div>
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
                {manager && <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={item.pinned ? "Desafixar comunicado" : "Fixar comunicado"} disabled={changingPin === item.id} onClick={() => void togglePinned(item)}><Pin className={item.pinned ? "h-4 w-4 text-primary" : "h-4 w-4"} /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Editar comunicado ${item.title}`} onClick={() => startEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir comunicado ${item.title}`} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Bell className="h-6 w-6" /></div>
          <p>Nenhum comunicado encontrado.</p>
          {manager && <Button className="mt-4" onClick={startCreate}><Megaphone className="mr-2 h-4 w-4" /> Publicar primeiro comunicado</Button>}
        </EmptyState>
      )}

      <div className="page-pagination mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        <span>{total} comunicado(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || announcements.isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
          <span>Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || announcements.isLoading} onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>
    </>
  );
}
