import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, X, LoaderCircle, Trash2, Users, UserRound } from "lucide-react";
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
  const [mode, setMode] = useState<"general" | "private">("general");
  const [recipientId, setRecipientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      // The generated Supabase schema types are refreshed separately from this migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: queryError } = await (supabase as any).from("association_chat_messages")
        .select("id,association_id,sender_id,recipient_id,body,created_at")
        .eq("association_id", associationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (queryError) throw queryError;
      const rows = (data ?? []) as ChatMessage[];
      setMessages(rows);
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (mode === "private" && !recipientId) {
      toast.error("Selecione um usuário para a mensagem privada.");
      return;
    }
    setSending(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any).from("association_chat_messages").insert({
      association_id: associationId,
      sender_id: userId,
      recipient_id: mode === "private" ? recipientId : null,
      body,
    });
    setSending(false);
    if (insertError) {
      console.error("Falha ao enviar mensagem no chat", insertError);
      toast.error("Não foi possível enviar. Confira se você ainda pertence a esta associação.");
      return;
    }
    setDraft("");
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
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
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
              <Textarea id="association-chat-message" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 4000))} placeholder={mode === "general" ? "Mensagem para todos…" : `Mensagem privada para ${recipientName}…`} rows={2} className="max-h-28 min-h-11 resize-none" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              <Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={!draft.trim() || sending || (mode === "private" && (!recipientId || members.length === 0))} className="h-11 w-11 shrink-0 rounded-xl"><Send className="h-4 w-4" /></Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{mode === "general" ? "Visível para todos os membros da associação" : "Visível apenas para você e o destinatário"} · Enter envia · Shift+Enter quebra a linha</p>
          </form>
        </section>
      )}
      <Button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar chat interno" : unreadLabel} title={unreadLabel} className="fixed bottom-5 right-5 z-[81] h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105 sm:bottom-6 sm:right-6">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        <span className="sr-only">{open ? "Fechar chat" : "Chat interno"}</span>
      </Button>
    </>
  );
}
