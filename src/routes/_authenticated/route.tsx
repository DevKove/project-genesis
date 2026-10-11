import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        // Authentication alone is not sufficient: new accounts remain blocked
        // until an administrator changes their server-controlled approval state.
        const db = supabase as any;
        const { data: profile, error: profileError } = await db
          .from("profiles")
          .select("account_status")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profileError || !profile) {
          throw redirect({ to: "/aguardando-aprovacao" });
        }
        if (profile.account_status === "pending") {
          throw redirect({ to: "/aguardando-aprovacao" });
        }
        if (profile.account_status !== "approved") {
          throw redirect({ to: "/auth" });
        }
        return { user: data.user };
      }
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      // Fail closed on network or profile lookup failures.
      throw redirect({ to: "/aguardando-aprovacao" });
    }

    throw redirect({
      to: "/auth",
      search: { redirect: location.href },
    });
  },
  component: () => <Outlet />,
});
