# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read the roadmap first: `C:\Users\jason\Claude\plans\message-inspector-completion-plan.md`** — the phased
plan shared with the backend repo (`C:\Users\jason\Projects\message-inspector\`, which links
the same file). It carries a `▶ CURRENT POSITION` block at the top and is the source of
truth for what is done, what is deliberately deferred, and the known gaps in both halves.
Frontend work is recorded there too, not just backend. Phases 0–7 are complete, so trust that
block over any phase numbering left behind in code comments.

## Commands

Angular CLI 16 project (`ng` via `npx ng` or the npm scripts):

- `npm start` — dev server on http://localhost:4200 (`ng serve`, development config)
- `npm run build` — production build to `dist/message-inspector-ui`
- `npm run watch` — incremental development build
- `npm test` — Karma + Jasmine in a launched Chrome, watch mode

Running a subset of tests: there is no `karma.conf.js` (the CLI karma builder generates the
config), so use Jasmine focus instead — change `describe`/`it` to `fdescribe`/`fit` in the spec,
or filter in the Karma browser UI. For a single non-watch run:
`npx ng test --watch=false --browsers=ChromeHeadless`.

There is no linter configured and no e2e setup.

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

**Auth — the whole app is gated.** `/login` is the only route reachable without a session.

- `AuthService` — POSTs to `.../api/auth/login` and keeps `{token, username, roles}` in
  `sessionStorage` under the key `mi.auth`. Deliberate trade-off: a refresh within the tab stays
  signed in, closing the tab signs out. That is only safe because the token is short-lived
  (~1h server-side) and a 401 bounces to login; the hardened alternative (in-memory token plus a
  refresh endpoint) is deliberately deferred. A corrupt entry reads as "no session" rather than
  throwing out of every getter.
- `authGuard` (`services/auth.guard.ts`) — a functional `CanActivateFn` that returns a `UrlTree`
  for `/login` instead of calling `navigate()`, so the Router cancels the original navigation and
  redirects in one step.
- `AuthInterceptor` — registered in `AppModule` through `HTTP_INTERCEPTORS`. Attaches the bearer
  token only to URLs starting with `http://localhost:8080/api`, and skips the login call itself.
  A 401 on anything else clears the session and navigates to `/login` — that is what makes an
  expired token self-correct.

**Routes** (`app-routing.module.ts`): `/login` (ungated), `/messages` (list),
`/messages/:queueName` (list, deep-linked to one queue), `/messages/:queueName/:messageId`
(detail), `/queues` (diagnostic view). `/` redirects to `/messages`. Every route except `/login`
carries `canActivate: [authGuard]`. `/messages/:queueName` is also the return target from the
detail view (Back, and after a delete/DLQ) — without it those navigations fail with NG04002 and
leave the user on a stale page.

**Services** (all `providedIn: 'root'`):

- `MessageService` — CRUD against `http://localhost:8080/api/messages/queue/{queue}/message/{id}`
  plus `/resend` and `/move-to-dlq` sub-paths. Queue names are `encodeURIComponent`-ed.
- `QueueService` — `http://localhost:8080/api/queues`. One queue-discovery call,
  `artemis-jolokia/names`, returning a plain JSON array of names — the Jolokia JMX envelope
  it used to pass through is unwrapped server-side since 2026-07-23. (Two dead discovery
  calls, `artemis-straight` and `artemis-jolokia`, were deleted 2026-07-24.) `last-used`
  (GET as text, POST as `text/plain`) stores the signed-in user's queue preference — there is
  **no user id in the path**, the bearer token identifies them server-side.
- `QueueSelectionService` — a `BehaviorSubject<string | null>` that is the single source of truth
  for "which queue am I looking at". `QueueDropdownComponent` and a deep-linked route write to it;
  `MessageListComponent` subscribes and refetches on every emission. This is the main
  cross-component wiring — changing the selected queue anywhere drives the message list.
- `ToastService` — wrapper over `ngx-toastr`; use it rather than injecting `ToastrService`.
  `apiError(err, fallback)` is the single place HTTP failures become user-facing text: it
  prefers the server's own `message`, and only invents one when that is absent.
  `describeApiError(err, fallback)` is the same mapping *returned* rather than shown.

**The response contract — read this before touching any service call.** The mutating
endpoints (resend / delete / move-to-dlq) return **HTTP 200 even when the operation
failed**, with the outcome in the body: `{"success": false, "message": "..."}`. An
Observable `next` therefore does *not* mean the call worked — every caller must check
`res.success`. Transport and server faults are separate and truthful: **400** for a
rejected message ID, **502** when the broker is unavailable, **500** otherwise, all with
the same body shape. Both halves have to be handled; neither one alone is sufficient.

**Errors: inline vs. toast** is a convention, not incidental. *Load* failures render inline via
`describeApiError` (the `loadError` / `error` fields in the list, detail and queue views) — a
toast over a silently stale table vanished and left no sign the load had failed, and a failed
detail load left a blank page. *Mutations* keep their toasts.

**Components** under `src/app/components/`. `MessageDetailComponent` owns its own confirmation
flow via a `confirm: {visible, action, handler}` object bound to the shared
`ConfirmationModalComponent` (a plain `@Input`/`@Output` component, not a Material dialog).
Destructive actions there go through `showDeleteConfirm()` / `showDLQConfirm()`, never
straight to `onDeleteConfirmed()` / `onDLQConfirmed()` — a spec guards this, because the
template previously called the latter and the modal never opened. `MessageListComponent` carries
the same confirm shape for its per-row actions, and mounts `<app-queue-dropdown>`
(`message-list.component.html:12`) — that mounting is what gives `QueueSelectionService` a
writer. The list also still accepts a queue typed into its text box.

**Shared** — `shared/models/` holds `JmsMessage` and `ApiResponse`.
`shared/pipes/pretty-payload.pipe.ts` declares the `prettyPayload` pipe used by the detail view:
JSON is detected **by parsing, not sniffing**; XML goes through `DOMParser`, which reports failure
as a `<parsererror>` document rather than throwing; anything that does not parse is returned
untouched. It is a pure pipe, so the parse runs once per payload rather than per
change-detection cycle.

**Styling:** Bootstrap 5, **compiled from source** in `src/styles.scss` rather than pulled in as
prebuilt CSS, so `src/styles/_tokens.scss` can override its `!default` variables before they are
used. The import order there is load-bearing: `bootstrap/scss/functions`, then the tokens, then
`bootstrap/scss/bootstrap`. The bare `bootstrap/...` paths resolve through
`stylePreprocessorOptions.includePaths` in `angular.json` — set on the **build and test builders
both**, or the suite fails to compile while the app builds fine. Per-component SCSS on top of that.
Angular Material is gone entirely, dependency included — all UI is Bootstrap markup. TypeScript is
in `strict` mode with `strictTemplates`.

**Tests** are behavioural, not smoke-only, and run against **jasmine-spied services rather than
`HttpClientTestingModule`** — each component is covered for success, body-level failure
(`success: false` on a 200) and HTTP-level failure. Match that style when adding specs.

## Gotchas

- **Every service URL must be absolute to `:8080`.** There is no `proxy.conf.json`, so a relative
  URL resolves against the dev server on `:4200` and silently does the wrong thing. This is not
  hypothetical: `getLastUsedQueue`/`saveLastUsedQueue` were relative from Phase 1 until
  2026-07-21, so the last-used-queue preference never once worked through the UI. `queue.service.spec.ts`
  now pins the URLs.
- **The base URL is hardcoded in two kinds of place** — each service, *and*
  `AuthInterceptor.API_PREFIX`. Change the services without the interceptor and requests still go
  out, just unauthenticated: the 401 then clears the session and bounces to `/login`, which reads
  as a login bug rather than a URL one. There are no `src/environments/` files.
- **Absence is an empty 200, not a 404 — in more than one place.** No stored queue preference (see
  `QueueControllerTest.testGetLastUsedQueue_NoPreferenceReturnsOkWithEmptyBody`) and a message that
  is not on the queue both arrive as 200 with an empty body. Handle absence in the success path
  (`MessageDetailComponent` checks `!msg.messageId`); an error from those endpoints is a genuine
  fault.
- **`AuthService.hasRole()` is called from no component or template.** ADMIN-only actions (delete,
  move-to-DLQ) are enforced **server-side only** — the buttons render for every signed-in user and
  a USER discovers the restriction as an error toast. Gate them in the UI before claiming
  role-based UX.
- **A deep-linked queue must be published, not fetched.** `MessageListComponent` pushes
  `:queueName` into `QueueSelectionService` rather than calling `fetchMessages()` directly, so the
  dropdown displays it and `restoreLastUsedQueue()` sees a selection already exists and stands
  down. Fetching directly is how the restored preference silently won over the route queue and
  showed the wrong queue's messages.
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
