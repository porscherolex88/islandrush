import "server-only";
import { headers } from "next/headers";
import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuth } from "./instance";

type AuthError = { message?: string };

function wrap<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: AuthError | null }> {
  return fn()
    .then((data) => ({ data, error: null }))
    .catch((err: unknown) => ({
      data: null,
      error: { message: err instanceof Error ? err.message : "Auth request failed" },
    }));
}

/** Auth API compatible with the previous Neon Auth proxy client. */
export function getAuth() {
  const auth = getBetterAuth();
  const hdrs = () => headers();
  return {
    getSession: () => wrap(async () => auth.api.getSession({ headers: await hdrs() })),
    signIn: {
      email: (body: { email: string; password: string }) =>
        wrap(async () => auth.api.signInEmail({ body, headers: await hdrs() })),
    },
    signUp: {
      email: (body: { email: string; password: string; name: string }) =>
        wrap(async () => auth.api.signUpEmail({ body, headers: await hdrs() })),
    },
    signOut: () => wrap(async () => auth.api.signOut({ headers: await hdrs() })),
    updateUser: (body: { name?: string }) => wrap(async () => auth.api.updateUser({ body, headers: await hdrs() })),
    changePassword: (body: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) =>
      wrap(async () =>
        auth.api.changePassword({
          body: {
            currentPassword: body.currentPassword,
            newPassword: body.newPassword,
            revokeOtherSessions: body.revokeOtherSessions,
          },
          headers: await hdrs(),
        }),
      ),
    listSessions: () => wrap(async () => auth.api.listSessions({ headers: await hdrs() })),
    revokeSession: (body: { token: string }) =>
      wrap(async () => auth.api.revokeSession({ body, headers: await hdrs() })),
    revokeOtherSessions: () => wrap(async () => auth.api.revokeOtherSessions({ headers: await hdrs() })),
    handler: () => toNextJsHandler(auth),
  };
}
