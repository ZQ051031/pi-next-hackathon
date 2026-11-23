# Pi Tasks

**Small tasks. Real impact.** Pi Tasks is an English-language micro-task board for Pioneers who want to get small jobs done or put their skills to work. Post a bounty, search by keyword or filter by category and status, claim an open task, submit work, and release a Pi-denominated reward. Profiles show posted tasks, claimed tasks, and completed work, with one reputation point per completed task with a recorded demo payout.

Pi Tasks is an independent [Pi Next Hackathon](https://minepi.com/pi-next/) prototype targeting Judges’ Pick. It uses React, Vite, TypeScript, and an optional dependency-free Node HTTP server. No paid API, payment method, or Pi account is needed to try the demo.

## Run locally

Requires Node.js 22.12+ on the Node 22 LTS line (or Node 24 LTS) and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Use **Sign in** to switch between the two demo accounts. For a walkthrough: post a task as **@maya.design**, switch to **@jordan.codes** to claim it and submit a completion note, then switch back to Maya to release the demo reward. Return to Jordan’s **My profile** to see the completed work and reputation point. The claim deadline is inclusive through the end of the selected UTC day; it does not prevent an already-claimed task from being submitted later.

Each mode has a separate board in browser local storage. Accounts share that board **only on the same browser and origin**. This is not a live, cross-device marketplace. Clear site storage to reset the demo board. Nothing is escrowed when a task is posted.

## Test and build

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The suite covers validation, search and sorting, transition permissions, reward states and reputation; a React smoke test renders the demo board and a second test exercises the complete workflow and persistence. Pi SDK callbacks and the server’s upstream responses are tested with fixtures and do not call Pi. Vite builds to `dist/`; the preview command serves that build for local checks.

## Pi integration: what is real and what is simulated

| Feature | Demo mode (default) | Pi Sandbox mode |
| --- | --- | --- |
| Sign-in | Two local demo identities | Official Pi JS SDK, with `username` and `payments` scopes |
| Posting and claiming | Local browser board | Separate local browser board, using Pi-provided user identities |
| Release | Simulated payment to the claimer; no wallet prompt | Optional user-to-app **Testnet** funding through the Pi SDK and payment server |
| Claimer payout | Simulated | Simulated separately after verified Testnet funding; no Pi is sent to the claimer |

- **Sign-in:** The app loads `https://sdk.minepi.com/pi-sdk.js` when Pi sign-in is requested and initializes with `Pi.init({ version: '2.0', sandbox: true })`. The option is shown in supported Pi contexts or when explicitly enabled. If the SDK or authentication fails, the user can select a demo account instead. The access token is kept in memory only; the server verifies it via Pi’s `/v2/me` before acting on a payment.
- **Funding:** Once the claimer submits work, the poster can fund the reward with `Pi.createPayment`, using the reward amount and `{ taskId }` metadata. The payment is **to the app**, not to the claimer. The SDK’s approval and completion callbacks call the server endpoints below. A task becomes **Testnet funded** only after the server verifies completion. If Pi reports a previously submitted incomplete payment through `onIncompletePaymentFound`, use **Recover payment** after sign-in to complete that transaction without charging again. Recovery needs the task stored in the current browser.
- **Payout:** **Simulate claimer payout** records a demo payout only. A real payout would require separate [app-to-user (A2U) integration](https://github.com/pi-apps/pi-platform-docs/blob/master/platform_API.md#payments) and a secured app wallet. No A2U transfer is currently attempted. Cancelled or unverified payments are not recorded as funded.

### Optional local Testnet payment server

1. Copy `.env.example` to `.env`. To show the Pi sign-in option at your registered sandbox development URL, set `VITE_PI_SHOW_SANDBOX=true` and restart Vite (rebuild for a static host).
2. Only after registering a **Testnet** app, set its Server API key in the server environment as `PI_API_KEY`. Do not prefix it with `VITE_`, place it in a frontend host, or commit it. Do not add a payment method.
3. In one terminal run `npm run server`; in another use `npm run dev`. Vite proxies same-origin `/api/pi/*` requests to the Node server at `127.0.0.1:8787`. For hosted Sandbox testing, serve `dist/` over HTTPS and route the same paths to the Node process via your hosting setup. Open the development URL through the Dev Portal’s Sandbox flow.

`GET /api/pi/status` reports whether Testnet is configured. The browser sends a Pi access token and `{ id, taskId, amount }` to `POST /api/pi/approve` or `{ id, taskId, amount, txid }` to `POST /api/pi/complete`. The server verifies the user and retrieves the Pi payment before calling `https://api.minepi.com/v2/payments/{id}/approve` or `/complete`. It checks owner, network, direction, amount and task metadata; completion additionally checks the transaction and verification flags. Without a key, the server returns responses labeled `mock`, which the browser never accepts as a Testnet receipt. Demo mode does not need this server at all.

**Do not deploy this as a Mainnet payment service.** The server checks Pi's payment against the browser's intent, but browser storage is not an authoritative shared task or ledger store. A public marketplace needs server-owned tasks and permissions, payment-intent and receipt storage, idempotent reconciliation, payout controls and a separately reviewed wallet integration. No live Pi sign-in, domain validation, or Testnet transaction can be validated without the owner’s registered app and account.

References: [Pi JS SDK](https://github.com/pi-apps/pi-platform-docs/blob/master/SDK_reference.md), [Pi payments lifecycle](https://github.com/pi-apps/pi-platform-docs/blob/master/payments.md), [Pi Platform API](https://github.com/pi-apps/pi-platform-docs/blob/master/platform_API.md).

## Owner checklist: register and submit

1. **Create a Pi account in the Pi Browser app.** Install Pi Browser and follow its official sign-in/onboarding prompts. If directed to the Pi Network app to create the account, complete that step and return to Pi Browser. Do not share wallet passphrases or API keys.
2. **Register for Pi Next.** Log into the [Developer Web Console](https://developers.minepi.com/hackathon/register), open the **Hackathon** tab, and complete registration. The [official hackathon page](https://minepi.com/pi-next/) says each team member must register, and only one team member should submit the team’s app.
3. **Connect/register Pi Tasks.** Create or connect the app in the Console / [Pi Developer Portal](https://github.com/pi-apps/pi-platform-docs/blob/master/developer_portal.md) (`pi://develop.pi` in Pi Browser). Use **Testnet** for the sandbox project; an app’s selected network cannot be changed later. Follow the portal’s app checklist to configure hosting, the development URL, and any required wallet setup. Use an HTTPS origin whose domain does not start with “pi.” If the Console generates a validation key, put that exact file in `public/validation-key.txt`, rebuild, and verify that the host serves it at `/validation-key.txt`. The repo intentionally has no fake key. Enable [PiNet](https://github.com/pi-apps/pi-platform-docs/blob/master/pinet.md) in the Portal with frontend metadata, then verify the PiNet URL on a regular browser. Add the English name, accurate description, [original SVG logo](public/logo.svg), [preview images](assets/previews/README.md), and privacy policy. Verify the hosted app in Pi Browser before submitting; do not imply the simulated payout is real.
4. **Submit in the Hackathon tab** by **Tuesday, January 5, 2027, 11:59 PM PST** (**Wednesday, January 6, 2027, 07:59 UTC / 15:59 China Standard Time**). Include the app URL, team information and public link to the demo video (no longer than three minutes); use the [demo script](DEMO_SCRIPT.md). Review any new fields or restrictions in the Console before submitting.

The [Mainnet Listing Requirements](https://developers.minepi.com/docs/build-first-app/MainnetListing) call for a functional professional UI, developer KYC, distinct branding and a domain not starting with “pi,” Pi-only login and transactions, minimal data collection, and avoiding unnecessary redirects. Demo accounts are for evaluation only and are not a replacement for Pi auth in a public Mainnet release. Registration, deployment, Mainnet listing and submission have not been performed.

[Privacy policy](PRIVACY_POLICY.md) · [Terms of use](TERMS_OF_SERVICE.md)
