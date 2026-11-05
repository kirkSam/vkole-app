VKOLE TEAM MEMO — UPDATE 2: ALL ACCOUNTS ARE EXPERIMENTAL
From Sam, written with Claude — November 4, 2026
For School Site and app Builder. Same text to both.
Save this with the final Nov 4 memo and Update 1.
THE DECISION
There are NO real student or parent accounts in the records, on the app or
the website. Every account is experimental. Any account may be changed,
damaged, cleared, or deleted if it is in the way of the build. You do not
need Sam's permission to clear test accounts, and you do not need to
protect, migrate, or freeze old test data.
THREE GUARDRAILS
1. CLEAR RECORDS, NOT STRUCTURE. Delete rows (accounts, students,
   progress, test sign-ins). Do NOT drop tables, delete migrations, or
   change the database setup to clear data. The structure is what real
   families will use.
2. STRIPE IS SEPARATE. Clearing an account does not cancel anything in
   Stripe. If any test account has an active subscription or saved card in
   Stripe, cancel it in Stripe first, and tell Sam. Never touch Stripe live
   settings, keys, or prices without Sam.
3. WRITE CODE AS IF THE DATA WERE REAL. The data is disposable; the code
   is not. Code you write now will handle real families after release. Keep
   every safety habit: tests, careful database changes, no shortcuts
   because "it's only test data."
WHEN YOU CLEAR
Tell Sam in one line: what was cleared, on which side, and when.
The master account (VKOLE_MASTER_EMAIL) may be cleared like any other; it
can register again. Tell Sam first so he is not locked out mid-session.
BEFORE RELEASE
Clear all test accounts on both sides, as the final memo already says.
