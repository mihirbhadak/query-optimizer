"use server";

import { redirect } from "next/navigation";

import { userService, userLogService, UserServiceError } from "@/lib/users";
import { settingsService } from "@/lib/settings";
import { systemLogService } from "@/lib/logs";
import { clientIp } from "@/lib/http";

import { NO_ADMIN_MESSAGE } from "./constants";
import { startSession, endSession, readSession } from "./session";

/** `error` renders a red banner; `notice` renders an info banner. */
export type ActionState = { error?: string; notice?: string } | undefined;

interface SignupData {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
}

function extractSignup(fd: FormData): SignupData {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    username: str("username"),
    email: str("email"),
    firstName: str("first_name") || undefined,
    lastName: str("last_name") || undefined,
    password: String(fd.get("password") ?? ""),
  };
}

/** Returns an error message, or null if valid. */
function validateSignup(d: SignupData): string | null {
  if (!d.username || !d.email || !d.password) return "Username, email and password are required.";
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(d.username)) {
    return "Username must be 3–32 characters (letters, numbers, . _ -).";
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return "Enter a valid email address.";
  if (d.password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

function toErrorState(err: unknown): ActionState {
  if (err instanceof UserServiceError) return { error: err.message };
  return { error: "Something went wrong. Please try again." };
}

// ---- login ----
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = userService.authState();
  if (state === "uninitialized") redirect("/setup");
  if (state === "no-admin") return { error: NO_ADMIN_MESSAGE };

  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "Enter your email/username and password." };

  const result = userService.verifyCredentials(identifier, password);
  if (!result.ok) {
    systemLogService.warn("Failed login attempt", {
      source: "auth",
      metadata: { identifier, reason: result.reason },
    });
    if (result.reason === "pending") return { error: "Your account is pending for admin approval." };
    if (result.reason === "rejected") return { error: "Your signup request was rejected." };
    if (result.reason === "deleted") return { error: "This account has been removed." };
    return { error: "Invalid email/username or password." };
  }

  await startSession(result.user.id);
  userLogService.record("auth.login", { actorId: result.user.id, ip: await clientIp() });
  redirect("/");
}

// ---- signup (regular user) ----
export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = userService.authState();
  if (state === "uninitialized") redirect("/setup");
  if (state === "no-admin") return { error: NO_ADMIN_MESSAGE };

  const data = extractSignup(formData);
  const invalid = validateSignup(data);
  if (invalid) return { error: invalid };

  const requiresApproval = settingsService.signupRequiresApproval();

  let userId: number;
  try {
    userId = userService.create({
      ...data,
      role: "member",
      status: requiresApproval ? "pending" : "active",
    }).id;
  } catch (err) {
    return toErrorState(err);
  }

  // Approval required: leave the user pending and do NOT start a session.
  if (requiresApproval) {
    userLogService.record("auth.signup_pending", { actorId: userId, ip: await clientIp() });
    return { notice: "Your account has been created and is pending admin approval." };
  }

  await startSession(userId);
  userLogService.record("auth.signup", { actorId: userId, ip: await clientIp() });
  redirect("/");
}

// ---- first-run admin setup ----
export async function setupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (userService.authState() !== "uninitialized") {
    return { error: "Setup is already complete. Please sign in." };
  }

  const data = extractSignup(formData);
  const invalid = validateSignup(data);
  if (invalid) return { error: invalid };

  let userId: number;
  try {
    userId = userService.create({ ...data, role: "admin" }).id;
  } catch (err) {
    return toErrorState(err);
  }
  await startSession(userId);
  userLogService.record("auth.setup_admin", { actorId: userId, ip: await clientIp() });
  redirect("/");
}

// ---- logout ----
export async function logoutAction(): Promise<void> {
  const session = await readSession();
  await endSession();
  if (session) userLogService.record("auth.logout", { actorId: session.uid, ip: await clientIp() });
  redirect("/login");
}
