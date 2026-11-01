# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This file holds the rules; the reasons are in `docs/`.** Until 2026-10-31 the reasoning and
the bug behind each rule were in here too, loaded into every session; they moved word for word
into the files below, and here each rule is a line or two. **Read a rule's reason before
changing or deleting it.** New reasoning goes in the matching `docs/` file, not here.

| Topic | Reasons in |
|---|---|
| Change detection, HTTP, auth, routes, services, errors, components, the pipe, styling, tests | `docs/architecture.md` |
| Absolute URLs, the two base URLs, empty 200s, roles, deep links, the modal, ngx-toastr, Jasmine, route encoding | `docs/gotchas.md` |

**Read the roadmap first** — a local planning doc kept outside the repo, the phased
plan shared with the backend repo (`message-inspector`, which links
the same file). It carries a `▶ CURRENT POSITION` block at the top and is the source of
truth for what is done, what is deliberately deferred, and the known gaps in both halves.
Frontend work is recorded there too, not just backend. Phases 0–7 are complete, so trust that
block over any phase numbering left behind in code comments.

## Commands

Angular CLI 22 project on **Node 24** (`ng` via `npx ng` or the npm scripts):

- `npm start` — dev server on http://localhost:4200 (`ng serve`, development config)
- `npm run build` — production build to `dist/message-inspector-ui/browser/` (the esbuild
  `@angular/build:application` builder's layout — not `dist/message-inspector-ui` itself)
- `npm run watch` — incremental development build
- `npm test` — Karma + Jasmine in a launched Chrome, watch mode
- `npm run lint` — angular-eslint over `src/**/*.ts` and `src/**/*.html`
- `npm run mock` — the mock backend on :8080 in place of the real Spring/Artemis stack

Running a subset of tests: there is no `karma.conf.js` (the `@angular/build:karma` builder
generates the config), so pass `--include src/app/path/to/file.spec.ts` to `ng test`, or use
Jasmine focus — change `describe`/`it` to `fdescribe`/`fit` in the spec, or filter in the Karma
browser UI. For a single non-watch run: `npx ng test --watch=false --browsers=ChromeHeadless`.

**Lint** is angular-eslint's recommended set (`eslint.config.js`, flat config) with three rules
turned off, each commented with why: `prefer-standalone` (NgModule by design),
`prefer-on-push-component-change-detection` (Eager on purpose, see Architecture) and
`prefer-inject` (constructor injection is the house style). There is no e2e setup.

**Mock backend** (`mock-server/`, its own README): a zero-dependency `node:http` stand-in for
the Spring/Artemis stack, so the UI runs with no Docker, broker or JVM. `npm run mock` serves
the real contract on :8080 and a control panel on `/__mock` that forces each endpoint into its
failure modes — the 200-with-`success:false` envelope, the bodyless 401 and 403, 502, latency
— none of which are otherwise reachable without breaking a real broker. It is hand-written
against the backend, so **the backend is the authority whenever the two disagree**.

**CI** (`.github/workflows/ci.yml`, Phase 7): on push/PR to `master`, `npm ci` →
`npm run lint` → the headless test command above → `npm run build`. Node is pinned to
**24.18.0** via `.nvmrc` (Angular 20+ rejects the old 20.11.1 pin; Angular 22 accepts
`^22.22.3 || ^24.15 || >=26`), read by the workflow through `node-version-file`. ubuntu-latest
ships Google Chrome for the ChromeHeadless run.

## Architecture

Angular 22 **NgModule** app (not standalone components) — everything is declared in
`src/app/app.module.ts`, and every declaration carries `standalone: false` (standalone is the
default since Angular 19). Frontend only; it talks to a separate Spring/JMS backend expected at
`http://localhost:8080`.

**Change detection is zone-based and Eager, deliberately.** Angular 22 made OnPush the default,
and this code assigns fields in `subscribe` callbacks, which OnPush would not re-render. Give a
new component `standalone: false` and `changeDetection: ChangeDetectionStrategy.Eager`
(`ng generate` emits a standalone OnPush component). Templates use the built-in control flow
(`@if` / `@for`), not `*ngIf` / `*ngFor`.

**HTTP** is `provideHttpClient(withXhr(), withInterceptorsFromDi())` in `AppModule`.
`withInterceptorsFromDi()` is what keeps the class-based `AuthInterceptor` in the chain;
`withXhr()` keeps the XMLHttpRequest backend Angular 22 replaced with `fetch` as the default.

**Domain:** a browser UI for inspecting ActiveMQ Artemis JMS queues — list queues, list messages
on a queue, view a message, and resend / delete / move-to-DLQ it.

**Auth — the whole app is gated.** `/login` is the only route reachable without a session.

- `AuthService` keeps `{token, username, roles}` in `sessionStorage` under `mi.auth`: a refresh
  stays signed in, closing the tab signs out. The in-memory-token alternative is deliberately
  deferred.
- `authGuard` (`services/auth.guard.ts`) returns a `UrlTree` for `/login` rather than calling
  `navigate()`.
- `AuthInterceptor` attaches the bearer token only to URLs starting with
  `http://localhost:8080/api`, skipping the login call. A 401 on anything else clears the
  session and navigates to `/login`.

**Routes** (`app-routing.module.ts`): `/login` (ungated), `/messages` (list),
`/messages/:queueName` (list, deep-linked to one queue), `/messages/:queueName/:messageId`
(detail), `/queues` (diagnostic view). `/` redirects to `/messages`. Every route except `/login`
carries `canActivate: [authGuard]`. `/messages/:queueName` is also the return target from the
detail view (Back, and after a delete/DLQ); without it those navigations fail with NG04002.

**Services** (all `providedIn: 'root'`):

- `MessageService` — CRUD against `http://localhost:8080/api/messages/queue/{queue}/message/{id}`
  plus `/resend` and `/move-to-dlq` sub-paths. Queue names are `encodeURIComponent`-ed.
- `QueueService` — `http://localhost:8080/api/queues`. One discovery call,
  `artemis-jolokia/names`, returning a plain JSON array; `last-used` (GET as text, POST as
  `text/plain`) has **no user id in the path** — the bearer token identifies the user.
- `QueueSelectionService` — a `BehaviorSubject<string | null>`, the single source of truth for
  "which queue am I looking at". `QueueDropdownComponent` and a deep-linked route write to it;
  `MessageListComponent` refetches on every emission.
- `ToastService` — use it rather than injecting `ToastrService`. `apiError(err, fallback)` is
  the single place HTTP failures become user-facing text, preferring the server's `message`;
  `describeApiError(err, fallback)` returns the same text rather than showing it.

**The response contract — read this before touching any service call.** The mutating
endpoints (resend / delete / move-to-dlq) return **HTTP 200 even when the operation
failed**, with the outcome in the body: `{"success": false, "message": "..."}`. An
Observable `next` therefore does *not* mean the call worked — every caller must check
`res.success`. Transport and server faults are separate and truthful: **400** for a
rejected message ID, **502** when the broker is unavailable, **500** otherwise, all with
the same body shape. Both halves have to be handled; neither one alone is sufficient.

**Errors: inline vs. toast** is a convention, not incidental. *Load* failures render inline via
`describeApiError`; *mutations* keep their toasts.

**Components** under `src/app/components/`. `MessageDetailComponent` and `MessageListComponent`
each carry a `confirm: {visible, action, handler}` object bound to the shared
`ConfirmationModalComponent` (a plain `@Input`/`@Output` component, not a Material dialog).
Destructive actions go through `showDeleteConfirm()` / `showDLQConfirm()`, never straight to
`onDeleteConfirmed()` / `onDLQConfirmed()`. `MessageListComponent` mounts
`<app-queue-dropdown>`, which is what gives `QueueSelectionService` a writer.

**Shared** — `shared/models/` holds `JmsMessage` and `ApiResponse`. The pure `prettyPayload`
pipe detects JSON **by parsing, not sniffing**, and returns anything that does not parse
untouched.

**Styling:** Bootstrap 5, **compiled from source** in `src/styles.scss`, and the import order
there is load-bearing: `bootstrap/scss/functions`, then the tokens, then `bootstrap/scss/bootstrap`.
`stylePreprocessorOptions.includePaths` and `sass.silenceDeprecations: ["import"]` in
`angular.json` go on the **build and test builders both**. No Angular Material. TypeScript is in
`strict` mode with `strictTemplates`.

**Tests** are behavioural, not smoke-only, and run against **jasmine-spied services rather than
`HttpClientTestingModule`** — each component is covered for success, body-level failure
(`success: false` on a 200) and HTTP-level failure. Match that style when adding specs.

## Gotchas

Rules, with the reasons in `docs/gotchas.md`:

- **Every service URL must be absolute to `:8080`.** There is no `proxy.conf.json`, so a
  relative URL resolves against the dev server on `:4200`. `queue.service.spec.ts` pins the URLs.
- **The base URL is hardcoded in two kinds of place** — each service, *and*
  `AuthInterceptor.API_PREFIX`. Change one without the other and requests go out
  unauthenticated, which reads as a login bug. There are no `src/environments/` files.
- **Absence is an empty 200, not a 404 — in more than one place**: no stored queue preference,
  and a message that is not on the queue. Handle absence in the success path
  (`MessageDetailComponent` checks `!msg.messageId`).
- **`AuthService.hasRole()` is called from no component or template.** ADMIN-only actions are
  enforced **server-side only**. Gate them in the UI before claiming role-based UX.
- **A deep-linked queue must be published, not fetched.** `MessageListComponent` pushes
  `:queueName` into `QueueSelectionService` rather than calling `fetchMessages()` directly.
- **Destructive actions go through `ConfirmationModalComponent` in *both* list and detail
  views**, each pinned by a spec that clicks the rendered button, not one that calls
  `showDeleteConfirm()` directly.
- **The modal's outputs are `confirm` and `cancelled`.** A binding to an undeclared output
  still compiles as a native DOM listener, so a stale `(cancel)` leaves Cancel dead with no
  error.
- **ngx-toastr is held on Angular 22 by an npm `overrides` entry in `package.json`.** Drop it
  once ngx-toastr declares 22. Do not re-add `@angular/animations` or `BrowserAnimationsModule`.
- **The Jasmine that runs is karma-jasmine's, not the root `jasmine-core`**, so the root
  `jasmine-core` / `@types/jasmine` stay on 4.6. Do not force Jasmine 5+; Vitest is the way
  forward.
- **Pass route params to `Router.navigate` raw.** The Router encodes path segments,
  `ActivatedRoute` decodes them, and `MessageService` encodes for the HTTP call — one encode per
  boundary. Pre-encoding produces `%253A`, which Tomcat rejects with a 400 before Spring sees it.
- **Every URL the app navigates to needs a route that matches.** `app-routing.module.spec.ts`
  asserts this. Component specs mock `Router`, which records a `navigate()` to a URL matching
  nothing without complaint — that is how `/messages/:queueName` came to be missing while four
  navigations were dead and the suite stayed green.
