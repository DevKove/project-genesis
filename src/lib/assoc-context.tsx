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
  refetch: () => Promise<unknown>;
};

const AssocCtx = createContext<Ctx | null>(null);
const KEY = "morada360.assoc";
const EMPTY_MEMBERSHIPS: Membership[] = [];

export function AssocProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const q = useQuery({
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
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [selectionLoaded, setSelectionLoaded] = useState(false);
  useEffect(() => {
    try {
      setCurrentIdState(localStorage.getItem(KEY));
    } catch {
      // The app remains usable if browser storage is disabled.
      setCurrentIdState(null);
    } finally {
      setSelectionLoaded(true);
    }
  }, []);
  const setCurrentId = (id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Keep selection in memory when persistent storage is unavailable.
    }
    setCurrentIdState(id);
  };
  const memberships = q.data ?? EMPTY_MEMBERSHIPS;
  const current = useMemo(() => {
    if (!selectionLoaded) return null;
    // If a code selected an association for which membership is still pending,
    // never silently fall back to another association the user already belongs to.
    if (currentId) return memberships.find((m) => m.association_id === currentId) ?? null;
    return memberships[0] ?? null;
  }, [memberships, currentId, selectionLoaded]);
  return (
    <AssocCtx.Provider value={{
      userId,
      memberships,
      current,
      setCurrentId,
      loading: q.isLoading || !selectionLoaded,
      error: q.isError,
      refetch: () => q.refetch(),
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
