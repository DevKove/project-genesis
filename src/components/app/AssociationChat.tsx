import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, X, LoaderCircle, Trash2, Users, UserRound, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  id: string;
  association_id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  attachment_path: string | null;
  created_at: string;
};
type ChatProfile = { id: string; full_name: string | null; avatar_url?: string | null };

export function AssociationChat({ associationId, userId, associationName }: {
  associationId: string;
  userId: string;
  associationName: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ChatProfile>>({});
  const [members, setMembers] = useState<ChatProfile[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"general" | "private">("general");
  const [recipientId, setRecipientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mantém o indicador do chat atualizado mesmo quando a janela está fechada.
  useEffect(() => {
    let active = true;
    const chatTypes = ["chat_general", "chat_private"];
    const refreshUnread = async () => {
      const { count, error: countError } = await supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("association_id", associationId)
        .is("read_at", null)
        .in("notification_type", chatTypes);
      if (!countError && active) setUnreadMessages(count ?? 0);
    };
    void refreshUnread();
    const channel = supabase
      .channel(`chat-alerts:${associationId}:${userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "user_notifications",
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const item = payload.new as { association_id?: string | null; notification_type?: string; read_at?: string | null };
        if (item.association_id !== associationId || !chatTypes.includes(item.notification_type ?? "")) return;
        if (open) {
          void supabase.from("user_notifications").update({ read_at: new Date().toISOString() })
            .eq("recipient_id", userId).eq("association_id", associationId)
            .in("notification_type", chatTypes).is("read_at", null);
        } else {
          setUnreadMessages((current) => current + 1);
        }
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [associationId, open, userId]);

  useEffect(() => {
    if (!open) return;
    void supabase.from("user_notifications").update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId).eq("association_id", associationId)
      .in("notification_type", ["chat_general", "chat_private"]).is("read_at", null)
      .then(({ error: markError }) => {
        if (markError) console.debug("Não foi possível atualizar a leitura dos alertas do chat.", markError);
        else setUnreadMessages(0);
      });
  }, [associationId, open, userId]);

  const loadMessages = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      // The generated Supabase schema types are refreshed separately from this migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: queryError } = await (supabase as any).from("association_chat_messages")
        .select("id,association_id,sender_id,recipient_id,body,attachment_path,created_at")
        .eq("association_id", associationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (queryError) throw queryError;
      const rows = (data ?? []) as ChatMessage[];
      setMessages(rows);
      const imageRows = rows.filter((item) => item.attachment_path);
      const signedEntries = await Promise.all(imageRows.map(async (item) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from("chat-images").createSignedUrl(item.attachment_path!, 60 * 60);
        return !signedError && signed?.signedUrl ? [item.id, signed.signedUrl] as const : null;
      }));
      setImageUrls((current) => ({ ...current, ...Object.fromEntries(signedEntries.filter((entry): entry is readonly [string, string] => entry !== null)) }));
      const ids = [...new Set(rows.flatMap((item) => [item.sender_id, ...(item.recipient_id ? [item.recipient_id] : [])]))];
      if (ids.length) {
        const { data: people, error: peopleError } = await supabase
          .from("profiles").select("id,full_name,avatar_url").in("id", ids);
        if (!peopleError) setProfiles((current) => ({
          ...current,
          ...Object.fromEntries(((people ?? []) as ChatProfile[]).map((person) => [person.id, person])),
        }));
      }
    } catch (cause) {
      console.error("Falha ao carregar o chat da associação", cause);
      setError("Não foi possível carregar as mensagens. Verifique sua conexão e suas permissões.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [associationId]);

  const loadMembers = useCallback(async () => {
    try {
      const { data, error: membersError } = await supabase
        .from("association_member_directory")
        .select("user_id,full_name")
        .eq("association_id", associationId)
        .order("full_name", { ascending: true });
      if (membersError) throw membersError;
      const people = (data ?? [])
        .filter((person) => person.user_id !== userId)
        .map((person) => ({ id: person.user_id, full_name: person.full_name, avatar_url: null }));
      setMembers(people);
      setProfiles((current) => ({
        ...current,
        ...Object.fromEntries(people.map((person) => [person.id, person])),
      }));
      setRecipientId((current) => current || people[0]?.id || "");
    } catch (cause) {
      console.error("Falha ao carregar membros para o chat", cause);
      setError("Não foi possível carregar a lista de usuários desta associação.");
    }
  }, [associationId, userId]);

  useEffect(() => {
    if (!open) return;
    void loadMembers();
    void loadMessages(true);
    const channel = supabase
      .channel(`association-chat:${associationId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "association_chat_messages",
        filter: `association_id=eq.${associationId}`,
      }, () => { void loadMessages(); })
      .subscribe();
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      window.clearTimeout(focusTimer);
      void supabase.removeChannel(channel);
    };
  }, [open, associationId, loadMessages, loadMembers]);

  const visibleMessages = useMemo(() => messages.filter((message) => {
    if (mode === "general") return message.recipient_id === null;
    return Boolean(recipientId) && message.recipient_id !== null &&
      ((message.sender_id === userId && message.recipient_id === recipientId) ||
       (message.sender_id === recipientId && message.recipient_id === userId));
  }), [messages, mode, recipientId, userId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleMessages, open]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  function chooseImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setSelectedImage(file);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !selectedImage) || sending) return;
    if (mode === "private" && !recipientId) {
      toast.error("Selecione um usuário para a mensagem privada.");
      return;
    }
    setSending(true);
    let attachmentPath: string | null = null;
    if (selectedImage) {
      const safeName = selectedImage.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "imagem";
      attachmentPath = `${associationId}/${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("chat-images")
        .upload(attachmentPath, selectedImage, { contentType: selectedImage.type, cacheControl: "3600", upsert: false });
      if (uploadError) {
        setSending(false);
        console.error("Falha ao enviar imagem do chat", uploadError);
        toast.error("Não foi possível enviar a imagem. Verifique sua conexão e suas permissões.");
        return;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any).from("association_chat_messages").insert({
      association_id: associationId,
      sender_id: userId,
      recipient_id: mode === "private" ? recipientId : null,
      body: body || (selectedImage ? "Enviou uma imagem" : ""),
      attachment_path: attachmentPath,
    });
    setSending(false);
    if (insertError) {
      if (attachmentPath) await supabase.storage.from("chat-images").remove([attachmentPath]);
      console.error("Falha ao enviar mensagem no chat", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        associationId,
        senderId: userId,
        mode,
      });
      const message = String(insertError.message ?? "").toLowerCase();
      if (insertError.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
        toast.error("O banco recusou o envio por permissão. Confirme se sua conta está aprovada e vinculada a esta associação.");
      } else if (insertError.code === "23503") {
        toast.error("O destinatário ou a associação não está mais cadastrado. Atualize a página e tente novamente.");
      } else {
        toast.error(`Falha ao enviar mensagem: ${insertError.message || "erro inesperado"}`);
      }
      return;
    }
    setDraft("");
    setSelectedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    await loadMessages();
    inputRef.current?.focus();
  }

  async function deleteMessage(message: ChatMessage) {
    if (message.sender_id !== userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any).from("association_chat_messages").delete()
      .eq("id", message.id).eq("association_id", associationId).eq("sender_id", userId);
    if (deleteError) {
      toast.error("Não foi possível excluir a mensagem.");
      return;
    }
    setMessages((current) => current.filter((item) => item.id !== message.id));
  }

  const recipientName = members.find((person) => person.id === recipientId)?.full_name?.trim() || "Usuário";
  const unreadLabel = "Abra o chat interno da associação";

  return (
    <>
      {open && (
        <section aria-label="Chat interno da associação" className="fixed bottom-24 right-4 z-[80] flex h-[min(680px,calc(100dvh-8rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl sm:bottom-24 sm:right-6">
          <header className="flex items-center justify-between gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><MessageCircle className="h-5 w-5" /></span>
              <div className="min-w-0"><h2 className="truncate font-semibold">Chat da associação</h2><p className="truncate text-xs text-primary-foreground/80">{associationName} · mensagens internas</p></div>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar chat" onClick={() => setOpen(false)} className="shrink-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"><X className="h-5 w-5" /></Button>
          </header>
          <div className="border-b bg-card p-3">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de mensagem">
              <Button type="button" size="sm" variant={mode === "general" ? "default" : "outline"} onClick={() => setMode("general")}><Users className="mr-2 h-4 w-4" /> Geral</Button>
              <Button type="button" size="sm" variant={mode === "private" ? "default" : "outline"} onClick={() => setMode("private")}><UserRound className="mr-2 h-4 w-4" /> Privada</Button>
            </div>
            {mode === "private" && (
              <div className="mt-3">
                <label htmlFor="association-chat-recipient" className="mb-1.5 block text-xs font-medium text-muted-foreground">Enviar mensagem privada para</label>
                <select id="association-chat-recipient" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                  {members.length === 0 && <option value="">Nenhum outro usuário cadastrado</option>}
                  {members.map((person) => <option key={person.id} value={person.id}>{person.full_name?.trim() || "Usuário sem nome"}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4" aria-live="polite" aria-relevant="additions text">
            {loading ? <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando mensagens…</div> :
              error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{error}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { void loadMembers(); void loadMessages(true); }}>Tentar novamente</Button></div> :
              visibleMessages.length === 0 ? <div className="flex h-full min-h-40 flex-col items-center justify-center text-center"><span className="mb-3 rounded-2xl bg-primary/10 p-4 text-primary">{mode === "general" ? <Users className="h-7 w-7" /> : <UserRound className="h-7 w-7" />}</span><p className="font-medium">{mode === "general" ? "Conversa geral" : recipientId ? `Conversa com ${recipientName}` : "Selecione um usuário"}</p><p className="mt-1 max-w-60 text-sm text-muted-foreground">{mode === "general" ? "Sua mensagem ficará visível para os membros desta associação." : "As mensagens privadas só ficam visíveis para você e para o destinatário."}</p></div> :
              visibleMessages.map((message) => {
                const mine = message.sender_id === userId;
                const otherId = mine ? message.recipient_id : message.sender_id;
                const name = mine ? "Você" : profiles[message.sender_id]?.full_name?.trim() || "Membro da associação";
                return (
                  <div key={message.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}>
                      <div className="mb-1 flex items-center gap-3"><span className={`text-xs font-semibold ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{name}</span>{mode === "private" && otherId && <span className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{mine ? `para ${profiles[otherId]?.full_name?.trim() || recipientName}` : "privada"}</span>}{mine && <button type="button" onClick={() => void deleteMessage(message)} aria-label="Excluir sua mensagem" title="Excluir mensagem" className="opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>}</div>
                      {message.body && message.body !== "Enviou uma imagem" && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>}
                      {message.attachment_path && imageUrls[message.id] && (
                        <a href={imageUrls[message.id]} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg">
                          <img src={imageUrls[message.id]} alt={`Imagem enviada por ${name}`} loading="lazy" className="max-h-64 max-w-full rounded-lg object-contain" />
                        </a>
                      )}
                      {message.attachment_path && !imageUrls[message.id] && <p className="mt-1 text-xs opacity-80">Imagem anexada</p>}
                      <time className={`mt-1.5 block text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`} dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                  </div>
                );
              })}
            <div ref={endRef} />
          </div>
          <form onSubmit={(event) => void sendMessage(event)} className="border-t bg-card p-3">
            <label htmlFor="association-chat-message" className="sr-only">Escreva uma mensagem</label>
            <div className="flex items-end gap-2">
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Selecionar imagem para enviar" onChange={(event) => chooseImage(event.target.files?.[0])} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {imagePreview && (
                  <div className="relative w-fit max-w-full rounded-lg border bg-muted p-1.5">
                    <img src={imagePreview} alt="Pré-visualização da imagem a enviar" className="max-h-28 max-w-48 rounded-md object-contain" />
                    <button type="button" onClick={() => { setSelectedImage(null); if (imageInputRef.current) imageInputRef.current.value = ""; }} aria-label="Remover imagem selecionada" className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                  </div>
                )}
                <Textarea id="association-chat-message" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 4000))} placeholder={mode === "general" ? "Mensagem para todos…" : `Mensagem privada para ${recipientName}…`} rows={2} className="max-h-28 min-h-11 resize-none" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              </div>
              <Button type="button" variant="outline" size="icon" aria-label="Anexar imagem" title="Anexar imagem (máx. 5 MB)" disabled={sending} onClick={() => imageInputRef.current?.click()} className="h-11 w-11 shrink-0 rounded-xl"><ImagePlus className="h-4 w-4" /></Button>
              <Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={(!draft.trim() && !selectedImage) || sending || (mode === "private" && (!recipientId || members.length === 0))} className="h-11 w-11 shrink-0 rounded-xl"><Send className="h-4 w-4" /></Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{mode === "general" ? "Visível para todos os membros da associação" : "Visível apenas para você e o destinatário"} · JPG, PNG, WEBP ou GIF até 5 MB · Enter envia · Shift+Enter quebra a linha</p>
          </form>
        </section>
      )}
      <Button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar chat interno" : unreadMessages ? `Chat interno, ${unreadMessages} mensagens não lidas` : unreadLabel} title={unreadMessages ? `${unreadMessages} mensagens não lidas` : unreadLabel} className="fixed bottom-5 right-5 z-[81] h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105 sm:bottom-6 sm:right-6">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unreadMessages > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
        <span className="sr-only">{open ? "Fechar chat" : "Chat interno"}</span>
      </Button>
    </>
  );
}
