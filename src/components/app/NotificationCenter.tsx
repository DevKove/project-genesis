import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Clock3, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NotificationRow = {
  id: string;
  association_id: string | null;
  request_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

const SOUND_KEY = "morada360-alert-sound";

export function NotificationCenter({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const notifications = useQuery({
    queryKey: ["user-notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("id,association_id,request_id,notification_type,title,message,created_at,read_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    refetchInterval: 60000,
  });
  const unreadCount = notifications.data?.filter((item) => !item.read_at).length ?? 0;

  useEffect(() => {
    try {
      setSoundEnabled(window.localStorage.getItem(SOUND_KEY) === "true");
    } catch {
      setSoundEnabled(false);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "user_notifications",
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const item = payload.new as NotificationRow;
        if (!item?.id) return;
        void queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
        if (knownIds.current.has(item.id)) return;
        knownIds.current.add(item.id);
        toast(item.title || "Nova notificação", {
          description: item.message,
          duration: 6500,
        });
        if (soundEnabled) {
          try {
            const AudioContextClass = window.AudioContext;
            if (AudioContextClass) {
              const context = new AudioContextClass();
              const oscillator = context.createOscillator();
              const gain = context.createGain();
              oscillator.type = "sine";
              oscillator.frequency.value = 880;
              gain.gain.setValueAtTime(0.0001, context.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
              oscillator.connect(gain);
              gain.connect(context.destination);
              oscillator.start();
              oscillator.stop(context.currentTime + 0.24);
              oscillator.onended = () => { void context.close(); };
            }
          } catch (error) {
            console.debug("O alerta sonoro não pôde ser reproduzido.", error);
          }
        }
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          try {
            new Notification(item.title || "Morada360", { body: item.message, tag: item.id });
          } catch (error) {
            console.debug("A notificação do navegador não pôde ser exibida.", error);
          }
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, soundEnabled, userId]);

  useEffect(() => {
    if (!notifications.data) return;
    for (const item of notifications.data) knownIds.current.add(item.id);
    initialized.current = true;
  }, [notifications.data]);

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") {
      toast.error("Este navegador não oferece notificações do sistema.");
      return;
    }
    if (Notification.permission === "granted") {
      toast.success("Notificações do navegador já estão habilitadas.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") toast.success("Alertas do navegador ativados.");
    else toast.info("Permissão não concedida. Os alertas continuarão no Morada360.");
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      window.localStorage.setItem(SOUND_KEY, String(next));
    } catch {
      toast.error("Não foi possível salvar a preferência de som neste navegador.");
    }
    toast.success(next ? "Alertas sonoros ativados." : "Alertas sonoros desativados.");
  }

  async function markRead(item: NotificationRow) {
    if (item.read_at) return;
    const { error } = await supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id).eq("recipient_id", userId);
    if (error) {
      toast.error("Não foi possível marcar a notificação como lida.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
  }

  async function markAllRead() {
    const { error } = await supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", userId).is("read_at", null);
    if (error) {
      toast.error("Não foi possível marcar as notificações como lidas.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
    toast.success("Notificações marcadas como lidas.");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={`Notificações${unreadCount ? `: ${unreadCount} não lidas` : ""}`} className="relative shrink-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div><h2 className="font-semibold">Central de alertas</h2><p className="text-xs text-muted-foreground">{unreadCount} não lida(s)</p></div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" title={soundEnabled ? "Desativar som" : "Ativar som"} aria-label={soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"} onClick={toggleSound}><span className="relative">{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</span></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void enableBrowserNotifications()}>Ativar no navegador</Button>
            {unreadCount > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => void markAllRead()}><CheckCheck className="mr-1.5 h-4 w-4" /> Ler todas</Button>}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.isLoading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> :
            notifications.isError ? <div className="p-4"><p className="text-sm text-muted-foreground">Não foi possível carregar os alertas.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => void notifications.refetch()}>Tentar novamente</Button></div> :
            notifications.data?.length ? notifications.data.map((item) => (
              <button type="button" key={item.id} onClick={() => void markRead(item)} className={`block w-full border-b p-4 text-left transition-colors hover:bg-muted/60 ${item.read_at ? "opacity-70" : "bg-primary/[0.04]"}`}>
                <span className="flex items-start gap-2"><span className="mt-0.5 rounded-full bg-muted p-1.5"><Clock3 className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{item.title}</span>{!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}</span><span className="mt-1 block text-sm text-muted-foreground">{item.message}</span><span className="mt-2 block text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span></span></span>
              </button>
            )) : <p className="p-5 text-center text-sm text-muted-foreground">Você ainda não tem alertas.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
