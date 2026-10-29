# Server-only environment variable leaked to the browser via Client Component prerendering

Minimal reproduction of a server-only environment variable (one **not** prefixed
with `NEXT_PUBLIC_`) being sent to the browser, contrary to the documented
security model.

- **Next.js:** 16.4.3
- **React / React-DOM:** 19.3.1
- **Node:** 24.x
- **Package manager:** pnpm (npm/yarn work too)

## TL;DR

A Client Component that reads a server-only env var (`process.env.INTERNAL_CONFIG`)
is **prerendered on the server** to produce the initial HTML. During that server
pass, `process.env.INTERNAL_CONFIG` resolves to the **real secret value**, which is
baked into the HTML and sent to the browser. The value is visible in
**View Source** and the **Network tab**, even though the component renders
`undefined` after hydration in the browser.

## Reproduction

```bash
pnpm install
pnpm build
pnpm start
# open http://localhost:3000
```

Then either:

- **View Source** on `http://localhost:3000`, or
- `curl -s http://localhost:3000/ | grep FAKE-SECRET`

**Observed:** the HTML contains

```html
<p>Server-only env var value: <!-- -->FAKE-SECRET-DO-NOT-LEAK-1234567890</p>
```

The secret `FAKE-SECRET-DO-NOT-LEAK-1234567890` (defined in `.env.local`, **not**
prefixed with `NEXT_PUBLIC_`) is delivered to the browser.

You can also confirm it in the build output without starting a server:

```bash
grep -o "FAKE-SECRET-DO-NOT-LEAK-1234567890" .next/server/app/index.html
```

## Expected behavior

Per the documentation, a non-`NEXT_PUBLIC_` env var must never reach the browser.

From [Environment Variables](https://nextjs.org/docs/app/guides/environment-variables):

> "Non-`NEXT_PUBLIC_` environment variables are only available in the Node.js
> environment, meaning they aren't accessible to the browser."

From [Data Security](https://nextjs.org/docs/app/guides/data-security):

> "On the initial load, both Server and Client Components run on the server to
> generate HTML. However, they execute in isolated module systems."
>
> "**Client Components:** Run on the server during prerendering, but **must follow
> the same security assumptions as code running in the browser. Must not access
> privileged data or server-only modules.**"
>
> "This ensures the app is secure by default..."

So the expected HTML is:

```html
<p>Server-only env var value: <!-- -->undefined</p>
```

i.e. during the server prerender of a **Client** Component, `process.env.INTERNAL_CONFIG`
should be `undefined` (exactly as it is in the browser), because a Client Component
"must follow the same security assumptions as code running in the browser."

## Actual behavior

The server prerender of the Client Component runs in the full Node.js environment
with access to the entire `process.env`. The secret is read and inlined into the
prerendered HTML, which is shipped to the browser.

Evidence gathered from this repro:

| Channel | Secret present? |
| --- | --- |
| Document HTML (`GET /`, View Source) | **Yes** |
| Browser JS bundle (`.next/static/**`) | No (bundle is clean) |
| Rendered DOM after hydration | `undefined` |

Notes:

- The browser JS bundle is **clean** — the documented "no `NEXT_PUBLIC_` inlining
  into the bundle" guarantee holds. The leak is through **rendered HTML**, not the
  JavaScript bundle.
- After hydration, the browser re-render evaluates `process.env.INTERNAL_CONFIG` to
  `undefined`, producing a React hydration-mismatch error (React error `#418`),
  because the server HTML contained the secret but the client render produced
  `undefined`. The secret has already been delivered by that point.

## Why this matters

The Data Security guide states that Client Components "must follow the same
security assumptions as code running in the browser" and that the architecture
"ensures the app is secure by default." A developer following that mental model
would reasonably expect a server-only env var read inside a Client Component to be
`undefined` during prerendering, just as it is in the browser. It is not — the
prerender runs with the full server `process.env`, and the result is sent to the
browser.

## Suggested fix

Run the server prerender/SSR pass of Client Components with a scrubbed
`process.env` that only exposes `NEXT_PUBLIC_*` variables (matching the security
assumptions the docs already describe for Client Components), so that server-only
env vars evaluate to `undefined` in any code path whose output is sent to the
browser.

## Files

- [`app/page.tsx`](./app/page.tsx) — page rendering the Client Component
- [`components/client-env-display.tsx`](./components/client-env-display.tsx) — the
  Client Component reading `process.env.INTERNAL_CONFIG`
- [`.env.local`](./.env.local) — defines the fake server-only secret (committed
  intentionally so the repro is self-contained; the value is not sensitive)
