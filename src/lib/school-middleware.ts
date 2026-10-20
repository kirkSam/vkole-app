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
        const message = err instanceof Error ? err.message : "";
        await leaveForSignIn(message);
      } else if (isAccountGoneError(err)) {
        await leaveStaleSignIn();
      }
      throw err;
    }
  })
  .server(async ({ next, context }) => {
    const { withSchoolAccount } = await import("./school-sync.server");
    const engineActive = (context as { engineActive?: boolean }).engineActive === true;
    return withSchoolAccount(context.userId, () => next(), { engineActive });
  });
