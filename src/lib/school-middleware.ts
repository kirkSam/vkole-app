import { createMiddleware } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Learning calls read the school website before they run, then write the
 * level, clock, and seen questions back before the response is returned.
 */
export const schoolMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .client(async ({ next }) => {
    const { appSessionOnWebsiteUnauthorized, engineSessionActive } = await import("./engine-activity");
    try {
      return await next({ sendContext: { engineActive: engineSessionActive() } });
    } catch (err) {
      const { isAccountGoneError, isSignInAgainError, leaveForSignIn, leaveStaleSignIn } = await import("./account-purge");
      if (isSignInAgainError(err) && appSessionOnWebsiteUnauthorized(engineSessionActive()) === "sign-in") {
        const { shouldStayInApp } = await import("./engine-picker");
        if (!shouldStayInApp(typeof sessionStorage === "undefined" ? null : sessionStorage)) {
          const message = err instanceof Error ? err.message : "";
          await leaveForSignIn(message);
        }
      } else if (isAccountGoneError(err)) {
        await leaveStaleSignIn();
      }
      throw err;
    }
  })
  .server(async ({ next, context }) => {
    let userId = context.userId;
    const { accountIdOf, isSchoolAccountId, studentScopeId } = await import("./school-account");
    const accountId = accountIdOf(userId);
    if (isSchoolAccountId(accountId)) {
      const { getSql } = await import("./db");
      const { readActiveStudentIndex } = await import("./school-mirror.server");
      const index = await readActiveStudentIndex(await getSql(), accountId);
      userId = studentScopeId(accountId, index);
    }
    const { withSchoolAccount } = await import("./school-sync.server");
    const engineActive = (context as { engineActive?: boolean }).engineActive === true;
    return withSchoolAccount(userId, () => next({ context: { userId, accountId } }), { engineActive });
  });
