import { createMiddleware } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Learning calls read the school website before they run, then write the
 * level, clock, and seen questions back before the response is returned.
 */
export const schoolMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .client(async ({ next }) => {
    try {
      return await next();
    } catch (err) {
      const { isAccountGoneError, leaveStaleSignIn } = await import("./account-purge");
      if (isAccountGoneError(err)) await leaveStaleSignIn();
      throw err;
    }
  })
  .server(async ({ next, context }) => {
    const { withSchoolAccount } = await import("./school-sync.server");
    return withSchoolAccount(context.userId, () => next());
  });
