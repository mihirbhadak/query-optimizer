/**
 * Auth + UserService smoke test: `npm run test:auth`.
 *
 * Verifies the business rules — authState transitions, the "must keep one admin"
 * invariant, credential checks, session tokens, and audit logging. Uses a temp
 * DB so it never touches `.data/app.db`.
 */

import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const TMP = resolve(`.data/auth-test-${Date.now()}.db`);
process.env.DATABASE_PATH = TMP;
process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");

const threw = (fn: () => unknown): boolean => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

async function main() {
  const { userService, userLogService } = await import("../users");
  const { settingsService } = await import("../settings");
  const { signSession, verifySessionToken } = await import("./token");
  const { closeDb } = await import("../db");

  const c: Record<string, boolean> = {};

  // Fresh: no users.
  c.uninitialized = userService.authState() === "uninitialized";

  // A user but no admin -> broken "no-admin" state.
  const bob = userService.create({
    username: "bob",
    email: "bob@example.com",
    password: "password123",
    role: "member",
  });
  c.noAdminState = userService.authState() === "no-admin";

  // Create the admin -> ready.
  const alice = userService.create({
    username: "alice",
    email: "alice@example.com",
    password: "password123",
    role: "admin",
  });
  c.readyState = userService.authState() === "ready";
  c.oneAdmin = userService.countAdmins() === 1;

  // Login checks (username + email, right/wrong password).
  const byU = userService.verifyCredentials("alice", "password123");
  const byE = userService.verifyCredentials("bob@example.com", "password123");
  c.loginByUsername = byU.ok && byU.user.id === alice.id;
  c.loginByEmail = byE.ok && byE.user.id === bob.id;
  c.wrongPasswordRejected = userService.verifyCredentials("alice", "nope").ok === false;

  // Last-admin guard: can't delete or demote the only admin.
  c.deleteLastAdminBlocked = threw(() => userService.delete(alice.id));
  c.demoteLastAdminBlocked = threw(() => userService.demoteFromAdmin(alice.id));

  // Promote bob -> now two admins -> deleting alice is allowed.
  userService.promoteToAdmin(bob.id);
  c.twoAdmins = userService.countAdmins() === 2;
  c.deleteAdminAllowed = !threw(() => userService.delete(alice.id));
  c.backToOneAdmin = userService.countAdmins() === 1;
  c.demoteNewLastAdminBlocked = threw(() => userService.demoteFromAdmin(bob.id));

  // Soft delete -> status "deleted", login blocked.
  const deletedLogin = userService.verifyCredentials("alice", "password123");
  c.softDeleted = userService.get(alice.id)?.status === "deleted";
  c.deletedLoginBlocked = !deletedLogin.ok && deletedLogin.reason === "deleted";

  // Update + uniqueness.
  userService.update(bob.id, { firstName: "Bob", lastName: "Builder" });
  c.updated = userService.get(bob.id)?.first_name === "Bob";
  c.duplicateUsernameBlocked = threw(() =>
    userService.create({ username: "bob", email: "x@y.com", password: "password123" }),
  );

  // ---- signup-approval flow ----
  settingsService.setSignupRequiresApproval(true);
  c.approvalSettingPersists = settingsService.signupRequiresApproval() === true;

  const carol = userService.create({
    username: "carol",
    email: "carol@example.com",
    password: "password123",
    role: "member",
    status: "pending",
  });
  const pendingLogin = userService.verifyCredentials("carol", "password123");
  c.pendingLoginBlocked = !pendingLogin.ok && pendingLogin.reason === "pending";

  userService.approve(carol.id);
  c.approvedCanLogin = userService.verifyCredentials("carol", "password123").ok === true;

  const dave = userService.create({
    username: "dave",
    email: "dave@example.com",
    password: "password123",
    role: "member",
    status: "pending",
  });
  userService.reject(dave.id);
  const daveLogin = userService.verifyCredentials("dave", "password123");
  c.rejectedStatus = userService.get(dave.id)?.status === "rejected";
  c.rejectedLoginBlocked = !daveLogin.ok && daveLogin.reason === "rejected";
  c.pendingListEmptyAfter = userService.listPending().length === 0;

  // Session tokens.
  const token = signSession({ uid: bob.id, exp: Date.now() + 60_000 });
  c.tokenOk = verifySessionToken(token)?.uid === bob.id;
  c.tamperedRejected = verifySessionToken(`${token.slice(0, -2)}xy`) === null;
  c.expiredRejected = verifySessionToken(signSession({ uid: bob.id, exp: Date.now() - 1 })) === null;

  // Audit log captured the mutations.
  c.auditLogged = userLogService.recent().length >= 4;

  console.log(c);
  const pass = Object.values(c).every(Boolean);
  console.log(`\n${pass ? "✔ PASS" : "✗ FAIL"} — auth + user service`);

  closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${TMP}${s}`, { force: true });
  if (!pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error("\n✗ Test failed:", err);
  process.exitCode = 1;
});
