/**
 * Local email/password sign-in is off.
 *
 * The school website is the only password check. This app still sets its own
 * session cookie after the website accepts the email and password.
 * Student clock passwords use `better-auth/crypto` directly and do not need this flag.
 */
export const emailAndPasswordEnabled = false;
