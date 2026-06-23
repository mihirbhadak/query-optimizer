import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "404 · Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="flex max-w-md flex-col items-center text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          The page you’re looking for doesn’t exist or may have been moved.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
