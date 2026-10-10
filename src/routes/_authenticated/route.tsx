import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Fail closed: protected routes are never rendered unless Supabase confirms
    // the current user. Treat both returned errors and thrown network failures
    // as an unauthenticated session without exposing backend details in the URL.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch {
      // Network/client failures are handled like an invalid session here.
    }

    throw redirect({
      to: "/auth",
      search: { redirect: location.href },
    });
  },
  component: () => <Outlet />,
});
