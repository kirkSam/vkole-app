/**
 * Local email/password sign-in is ON.
 *
 * CLAUDE: flipped at Sam's explicit direction (with the App Builder's
 * agreement) as step one of making this app keep its own parent accounts,
 * instead of the school website being the only password check. New parents
 * register locally from now on (see school-auth.ts); an email that already
 * has a LOCAL account signs in locally too. An email with no local account
 * still signs in through the website exactly as before -- existing parents
 * are unaffected until there's a deliberate migration later.
 * Student clock passwords use `better-auth/crypto` directly and do not need this flag.
 */
export const emailAndPasswordEnabled = true;
