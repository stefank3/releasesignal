### Prerequisites

Node.js 18+
Release Signal running at http://localhost:3000
Valid test account credentials

This /qa framework is isolated and must not modify Release Signal application source.

### Install

```bash
cd qa
npm install
npx playwright install chromium
```

### Configure

```bash
cp .env.example .env
# Edit .env with your BASE_URL and test credentials
```

### First run — authenticate

The first time any test runs, Playwright logs in through Auth0 and saves the session.
If automated login is blocked, complete login manually in the headed browser.
The session is saved to helpers/auth.json.
Do not commit helpers/auth.json.

Auth0 may require email-first login, a continue step, MFA, bot protection, or cross-origin redirects. The setup handles common email/password flows, then waits for manual completion in the headed browser when automation cannot continue.

### Run smoke suite (fast check, < 3 min)

```bash
npm run smoke
```

### Run full regression suite

```bash
npm run regression
```

### Run everything

```bash
npm run test:all
```

### Watch mode / debug

```bash
npm run test:debug
```

### After a code change — what to run

For UI-only changes: npm run smoke
For any logic change: npm run test:all

### Test results and failure reports

Screenshots, traces, and videos saved to: ./test-results/
Open trace viewer: npx playwright show-trace test-results/<trace-file>

### Adding known session IDs

Edit fixtures/sessions.json with session IDs from your running Release Signal instance.
Tests that require specific artifact states will use these.
Without them, those tests will be skipped with a descriptive message.
