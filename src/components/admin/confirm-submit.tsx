"use client";

import { Button } from "@/components/ui/button";

/**
 * A form submit button that asks for confirmation before submitting its form.
 * Place inside a `<form action={serverAction}>`; cancels the submit if declined.
 */
export function ConfirmSubmit({
  confirm,
  children,
  variant = "outline",
  size = "sm",
}: {
  confirm: string;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
