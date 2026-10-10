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
  useEffect(() => {
    try {
      setCurrentIdState(localStorage.getItem(KEY));
    } catch {
      // The app remains usable if browser storage is disabled.
      setCurrentIdState(null);
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
  const memberships = q.data ?? [];
  const current = useMemo(
    () => memberships.find((m) => m.association_id === currentId) ?? memberships[0] ?? null,
    [memberships, currentId],
  );
  return (
    <AssocCtx.Provider value={{
      userId,
      memberships,
      current,
      setCurrentId,
      loading: q.isLoading,
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
