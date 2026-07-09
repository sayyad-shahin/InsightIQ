import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} actions={<Badge variant="warning">In progress</Badge>} />
      <div className="card-surface">
        <EmptyState
          icon={Hammer}
          title="This screen is being crafted"
          description="The design system, routing, and API are wired up. This page will be filled in next."
        />
      </div>
    </div>
  );
}
