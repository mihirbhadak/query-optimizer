"use client";

import { useActionState } from "react";

import { setupAction } from "@/lib/auth/actions";
import { ErrorBanner, Field, SubmitButton } from "../form-ui";

export default function SetupForm() {
  const [state, action] = useActionState(setupAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <ErrorBanner message={state?.error} />
      <Field label="Username" name="username" autoComplete="username" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="first_name" autoComplete="given-name" required={false} />
        <Field label="Last name" name="last_name" autoComplete="family-name" required={false} />
      </div>
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" />
      <SubmitButton>Create admin & continue</SubmitButton>
    </form>
  );
}
