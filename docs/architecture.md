# Architecture

Moved out of `CLAUDE.md` on 2026-10-31, word for word, so it no longer loads into every
session. `CLAUDE.md` keeps each rule as a line or two and points here for the reason. Where the
text below says "this file", it means `CLAUDE.md` as it stood when the passage was written.

**Change detection is zone-based and Eager, deliberately.** `main.ts` bootstraps through
`platformBrowser()` with `provideZoneChangeDetection()`, and zone.js is still loaded. Every
component declares `changeDetection: ChangeDetectionStrategy.Eager` because Angular 22 made
OnPush the default; Eager is the pre-22 behaviour this code is written for — fields assigned in
`subscribe` callbacks, which OnPush would not re-render. Give a new component the same two
settings (`ng generate` emits a standalone OnPush component). Templates use the built-in
control flow (`@if` / `@for`), not `*ngIf` / `*ngFor`.

**HTTP** is `provideHttpClient(withXhr(), withInterceptorsFromDi())` in `AppModule`.
`withInterceptorsFromDi()` is what keeps the class-based `AuthInterceptor` in the chain;
`withXhr()` keeps the XMLHttpRequest backend Angular 22 replaced with `fetch` as the default.

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
(`message-list.component.html:14`) — that mounting is what gives `QueueSelectionService` a
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
both**, or the suite fails to compile while the app builds fine. The same block carries
`sass.silenceDeprecations: ["import"]` on both builders: Bootstrap 5.3 is consumed through
`@import`, which Dart Sass deprecates, and it has no `@use` API to migrate to. Per-component SCSS
on top of that.
Angular Material is gone entirely, dependency included — all UI is Bootstrap markup. TypeScript is
in `strict` mode with `strictTemplates`.

