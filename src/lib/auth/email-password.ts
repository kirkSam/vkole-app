/**
 * Local email/password sign-in is OFF.
 *
 * CLAUDE: flipped back at Sam's explicit direction, reversing the brief
 * local-account experiment -- the app and the school website now share one
 * parent account book (the website's), so a parent can create an account or
 * sign in from either place. See school-auth.ts: schoolSignUp/schoolSignIn
 * always call the website now. Only the parent's login is shared; student
 * levels/progress are never pulled or pushed between the two systems (see
 * school-sync.server.ts's withSchoolAccount).
 * Student clock passwords use `better-auth/crypto` directly and do not need this flag.
 */
export const emailAndPasswordEnabled = false;
