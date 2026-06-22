"use client";

import { useActionState } from "react";

import { loginAction } from "@/lib/auth/actions";
import { ErrorBanner, Field, SubmitButton } from "../form-ui";

export default function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <ErrorBanner message={state?.error} />
      <Field label="Email or username" name="identifier" autoComplete="username" autoFocus />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
