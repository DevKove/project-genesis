import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AssocRole } from "./roles";

export type Membership = {
  association_id: string;
  role: AssocRole;
  associations: { id: string; name: string; city: string | null; state: string | null; logo_url: string | null } | null;
};

type Ctx = {
  userId: string;
  memberships: Membership[];
  current: Membership | null;
  setCurrentId: (id: string) => void;
  loading: boolean;
  error: boolean;
  isPlatformAdmin: boolean;
  refetch: () => Promise<unknown>;
};

const AssocCtx = createContext<Ctx | null>(null);
const KEY = "morada360.assoc";
const EMPTY_MEMBERSHIPS: Membership[] = [];

export function AssocProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const platformRole = useQuery({
    queryKey: ["assoc-context-platform-admin", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role")
        .eq("user_id", userId).eq("role", "platform_admin").maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
  const membershipsQuery = useQuery({
    queryKey: ["memberships", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("association_members")
        .select("association_id, role, associations(id, name, city, state, logo_url)")
        .eq("user_id", userId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Membership[];
    },
  });
  const associationsQuery = useQuery({
    queryKey: ["platform-admin-associations", userId],
    enabled: platformRole.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("associations")
        .select("id, name, city, state, logo_url").order("name");
      if (error) throw error;
      return (data ?? []).map((association): Membership => ({
        association_id: association.id,
        role: "admin",
        associations: association,
      }));
    },
  });
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [selectionLoaded, setSelectionLoaded] = useState(false);
  useEffect(() => {
    try {
      setCurrentIdState(localStorage.getItem(KEY));
    } catch {
      setCurrentIdState(null);
    } finally {
      setSelectionLoaded(true);
    }
  }, []);
  const setCurrentId = (id: string) => {
    try { localStorage.setItem(KEY, id); } catch { /* Keep selection in memory. */ }
    setCurrentIdState(id);
  };
  const isPlatformAdmin = platformRole.data === true;
  const memberships = isPlatformAdmin
    ? (associationsQuery.data ?? EMPTY_MEMBERSHIPS)
    : (membershipsQuery.data ?? EMPTY_MEMBERSHIPS);
  const current = useMemo(() => {
    if (!selectionLoaded) return null;
    if (currentId) return memberships.find((m) => m.association_id === currentId) ?? null;
    return memberships[0] ?? null;
  }, [memberships, currentId, selectionLoaded]);
  const loading = platformRole.isLoading || membershipsQuery.isLoading ||
    (isPlatformAdmin && associationsQuery.isLoading) || !selectionLoaded;
  const error = platformRole.isError || membershipsQuery.isError ||
    (isPlatformAdmin && associationsQuery.isError);
  return (
    <AssocCtx.Provider value={{
      userId, memberships, current, setCurrentId, loading, error, isPlatformAdmin,
      refetch: async () => {
        await Promise.all([platformRole.refetch(), membershipsQuery.refetch(), associationsQuery.refetch()]);
      },
    }}>
      {children}
    </AssocCtx.Provider>
  );
}

export function useAssoc() {
  const c = useContext(AssocCtx);
  if (!c) throw new Error("useAssoc fora do provider");
  return c;
}
