import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium">Coming soon</p>
          <p className="text-sm text-muted-foreground">
            {description ?? `The ${title} section is not built yet.`}
          </p>
        </div>
      </div>
    </div>
  );
}
