import { createFileRoute } from "@tanstack/react-router";

/**
 * Matching cleanup for the school website's teacher-only "delete all accounts".
 * POST with the shared secret, or a signed-in admin email, and the confirm phrase.
 * Deletes account and student rows only. Does not run unless that request arrives.
 *
 * VKOLE_SHARED_SECRET is still required here (or VKOLE_ADMIN_EMAILS for a
 * signed-in admin). It is not used for /api/account/* and is not sent by the browser.
 */
export const Route = createFileRoute("/api/vkole/purge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { adminEmailList, handleAccountPurge } = await import("@/lib/account-purge.server");
        return handleAccountPurge(request, {
          expectedSecret: process.env.VKOLE_SHARED_SECRET,
          adminEmails: adminEmailList(process.env.VKOLE_ADMIN_EMAILS),
          lookupSession: async () => {
            const { getSessionUser } = await import("@/lib/auth/verify.server");
            const user = await getSessionUser();
            return user?.email ?? null;
          },
          loadSql: async () => {
            const { getSql } = await import("@/lib/db");
            return getSql();
          },
        });
      },
      GET: () => new Response(null, { status: 405, headers: { allow: "POST" } }),
      PUT: () => new Response(null, { status: 405, headers: { allow: "POST" } }),
      DELETE: () => new Response(null, { status: 405, headers: { allow: "POST" } }),
    },
  },
});
