import { Construction, type LucideIcon } from "lucide-react";

import { EmptyState } from "./empty-state";

/** Page-level placeholder: a heading plus an Empty state with an optional CTA. */
export function ComingSoon({
  title,
  description,
  icon = Construction,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <EmptyState
        icon={icon}
        title="Nothing here yet"
        description={description ?? `The ${title} section isn’t built yet.`}
        action={action}
      />
    </div>
  );
}
