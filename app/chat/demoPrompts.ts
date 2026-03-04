// app/chat/demoPrompts.ts
// M7: keep demo prompts out of page.tsx so page stays UI-only.

export const DEMO_COACH_LOGIN = `Feature: Login with Auth0, optional MFA

Context:
- Username/password login via Auth0 Universal Login
- MFA optional based on user policy
- Web app + API backend
- Lockout policy: 5 failed attempts -> 15 min lock

Ask:
Help me design a risk-based test strategy and a small set of high-signal tests.`;

export const DEMO_REVIEW_LOGIN = `Feature: Login with Auth0, optional MFA

TC1: Valid login (no MFA) should succeed
Steps: open login page, enter valid creds, submit
Expected: redirected to dashboard

TC2: Invalid password shows error
Steps: enter valid username + wrong password
Expected: error message, no redirect

TC3: MFA required for some users
Steps: login as user with MFA enabled
Expected: MFA challenge shown, on success redirect

TC4: MFA failure
Steps: enter wrong OTP
Expected: error, allow retry, no login`;

export const DEMO_REVIEW_EXPORT = `Feature: Export search results (CSV)

TC1: Export CSV for filtered results
Steps:
1. Apply filters (Market=Austria, Status=Active)
2. Click Export -> CSV
3. Wait for completion
Expected:
- File downloads
- Filename includes timestamp
- Contains headers + correct number of rows

TC2: Export limit is enforced
Steps: Filter to >100k rows, export CSV
Expected: user sees clear error, export not started

TC3: Cancel export
Steps: Start export, click Cancel
Expected: export stops, no file downloaded, status resets`;

export const DEMO_CASES_LOGIN = `Generate test cases for this feature:

Feature: Login with Auth0, optional MFA

Context:
- Username/password login via Auth0 Universal Login
- MFA optional based on user policy
- Lockout policy: 5 failed attempts -> 15 minutes
- Sessions stored in HttpOnly cookies

Acceptance criteria:
- Valid credentials redirect to dashboard
- Invalid credentials show error and do not redirect
- If MFA required, user must complete challenge to login
- After 5 failed attempts, account is locked for 15 minutes`;