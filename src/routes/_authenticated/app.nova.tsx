import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateAssociation } from "@/components/app/CreateAssociation";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/app/nova")({ component: Nova });

function Nova() {
  const navigate = useNavigate();
  return (
    <div className="max-w-lg">
      <PageHeader title="Nova associação" description="Você será o administrador." />
      <CreateAssociation onDone={() => navigate({ to: "/app" })} />
    </div>
  );
}
