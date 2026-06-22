"use client";

import { useActionState } from "react";

import { signupAction } from "@/lib/auth/actions";
import { ErrorBanner, Field, NoticeBanner, SubmitButton } from "../form-ui";

export default function SignupForm() {
  const [state, action] = useActionState(signupAction, undefined);
  // After a pending signup, show the notice instead of the form.
  if (state?.notice) return <NoticeBanner message={state.notice} />;
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
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
