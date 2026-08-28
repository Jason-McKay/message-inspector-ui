# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read the roadmap first: `C:\Users\jason\Claude\plans\message-inspector-completion-plan.md`** — the phased
plan shared with the backend repo (`C:\Users\jason\Projects\message-inspector\`, which links
the same file). It carries a `▶ CURRENT POSITION` block at the top and is the source of
truth for what is done, what is deliberately deferred, and the known gaps in both halves.
Frontend work is recorded there too, not just backend.

## Commands

Angular CLI 16 project (`ng` via `npx ng` or the npm scripts):

- `npm start` — dev server on http://localhost:4200 (`ng serve`, development config)
- `npm run build` — production build to `dist/message-inspector-ui`
- `npm run watch` — incremental development build
- `npm test` — Karma + Jasmine in a launched Chrome, watch mode
- `npm run mock` — the mock backend on :8080 in place of the real Spring/Artemis stack

Running a subset of tests: there is no `karma.conf.js` (the CLI karma builder generates the
config), so use Jasmine focus instead — change `describe`/`it` to `fdescribe`/`fit` in the spec,
or filter in the Karma browser UI. For a single non-watch run:
`npx ng test --watch=false --browsers=ChromeHeadless`.

There is no linter configured and no e2e setup.

**Mock backend** (`mock-server/`, its own README): a zero-dependency `node:http` stand-in for
the Spring/Artemis stack, so the UI runs with no Docker, broker or JVM. `npm run mock` serves
the real contract on :8080 and a control panel on `/__mock` that forces each endpoint into its
failure modes — the 200-with-`success:false` envelope, the bodyless 401 and 403, 502, latency
— none of which are otherwise reachable without breaking a real broker. It is hand-written
against the backend, so **the backend is the authority whenever the two disagree**.

**CI** (`.github/workflows/ci.yml`, Phase 7): on push/PR to `master`, `npm ci` → the
headless test command above → `npm run build`. Node is pinned to **20.11.1** via `.nvmrc`
(Angular 16 rejects Node 24), read by the workflow through `node-version-file`. ubuntu-latest
ships Google Chrome for the ChromeHeadless run.

## Architecture

Angular 16 **NgModule** app (not standalone components) — everything is declared in
`src/app/app.module.ts`. Frontend only; it talks to a separate Spring/JMS backend expected at
`http://localhost:8080`.

**Domain:** a browser UI for inspecting ActiveMQ Artemis JMS queues — list queues, list messages
on a queue, view a message, and resend / delete / move-to-DLQ it.

**Routes** (`app-routing.module.ts`): `/messages` (list), `/messages/:queueName/:messageId`
(detail), `/queues` (diagnostic view). `/` redirects to `/messages`.

**Services** (all `providedIn: 'root'`):

- `MessageService` — CRUD against `http://localhost:8080/api/messages/queue/{queue}/message/{id}`
  plus `/resend` and `/move-to-dlq` sub-paths. Queue names are `encodeURIComponent`-ed.
- `QueueService` — `http://localhost:8080/api/queues`. One queue-discovery call,
  `artemis-jolokia/names`, returning a plain JSON array of names — the Jolokia JMX envelope
  it used to pass through is unwrapped server-side since 2026-07-23. (Two dead discovery
  calls, `artemis-straight` and `artemis-jolokia`, were deleted 2026-07-24.)
- `QueueSelectionService` — a `BehaviorSubject<string | null>` that is the single source of truth
  for "which queue am I looking at". `QueueDropdownComponent` writes to it; `MessageListComponent`
  subscribes and refetches on every emission. This is the main cross-component wiring — changing
  the selected queue anywhere drives the message list.
- `ToastService` — wrapper over `ngx-toastr`; use it rather than injecting `ToastrService`.
  `apiError(err, fallback)` is the single place HTTP failures become user-facing text: it
  prefers the server's own `message`, and only invents one when that is absent.

**The response contract — read this before touching any service call.** The mutating
endpoints (resend / delete / move-to-dlq) return **HTTP 200 even when the operation
failed**, with the outcome in the body: `{"success": false, "message": "..."}`. An
Observable `next` therefore does *not* mean the call worked — every caller must check
`res.success`. Transport and server faults are separate and truthful: **400** for a
rejected message ID, **502** when the broker is unavailable, **500** otherwise, all with
the same body shape. Both halves have to be handled; neither one alone is sufficient.

**Components** under `src/app/components/`. `MessageDetailComponent` owns its own confirmation
flow via a `confirm: {visible, action, handler}` object bound to the shared
`ConfirmationModalComponent` (a plain `@Input`/`@Output` component, not a Material dialog).
Destructive actions there go through `showDeleteConfirm()` / `showDLQConfirm()`, never
straight to `onDeleteConfirmed()` / `onDLQConfirmed()` — a spec guards this, because the
template previously called the latter and the modal never opened.

**Styling:** Bootstrap 5, **compiled from source** in `src/styles.scss` rather than pulled in as
prebuilt CSS, so `src/styles/_tokens.scss` can override its `!default` variables before they are
used. The import order there is load-bearing: `bootstrap/scss/functions`, then the tokens, then
`bootstrap/scss/bootstrap`. The bare `bootstrap/...` paths resolve through
`stylePreprocessorOptions.includePaths` in `angular.json` — set on the **build and test builders
both**, or the suite fails to compile while the app builds fine. Per-component SCSS on top of that.
Angular Material is gone entirely, dependency included — all UI is Bootstrap markup. TypeScript is
in `strict` mode with `strictTemplates`.

## Gotchas

- **Every service URL must be absolute to `:8080`.** There is no `proxy.conf.json`, so a relative
  URL resolves against the dev server on `:4200` and silently does the wrong thing. This is not
  hypothetical: `getLastUsedQueue`/`saveLastUsedQueue` were relative from Phase 1 until
  2026-07-21, so the last-used-queue preference never once worked through the UI. `queue.service.spec.ts`
  now pins the URLs.
- **No stored preference is an empty 200, not a 404** (see
  `QueueControllerTest.testGetLastUsedQueue_NoPreferenceReturnsOkWithEmptyBody`). Handle absence in
  the success path; an error from that endpoint is a genuine fault and gets a warning toast.
- `QueueDropdownComponent` hardcodes `userId = 'jason'` (Phase 4 replaces this with the
  authenticated user).
- **Destructive actions go through `ConfirmationModalComponent` in *both* list and detail views.**
  Each has a template-level spec that clicks the rendered button — a spec calling
  `showDeleteConfirm()` directly passes just as happily when the button is rewired straight to
  `deleteMessage()`, which is how the bug existed in both templates.
- **Pass route params to `Router.navigate` raw.** The Router encodes path segments,
  `ActivatedRoute` decodes them, and `MessageService` encodes for the HTTP call — one encode per
  boundary. Pre-encoding in `viewMessage()` produced `%253A`, which **Tomcat rejects with a 400
  before Spring sees it**, so nothing appears in the backend log and the browser reports it as
  unreachable. This killed the whole detail view for a while.
- **Every URL the app navigates to needs a route that matches.** `app-routing.module.spec.ts`
  asserts this. Component specs mock `Router`, which records a `navigate()` to a URL matching
  nothing without complaint — that is how `/messages/:queueName` came to be missing while four
  navigations were dead and the suite stayed green.
- **`<app-queue-dropdown>` is declared in `AppModule` but rendered in no template**, so
  `QueueSelectionService` has no writer and `MessageListComponent`'s subscription to
  `selectedQueue$` never fires. The list runs entirely off the text input. Its specs exist and
  pass. Mounting it is Phase 4 work — and it is why the `/last-used/` bug went unnoticed for
  three phases.
- Backend base URLs are hardcoded in the services; there are no `src/environments/` files.
