# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: the parent directory `C:\Users\jason\Claude` has a CLAUDE.md describing itself as a
> non-code scratch space. This subdirectory is a real Angular project and is the exception —
> this file takes precedence here.

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
- `QueueService` — `http://localhost:8080/api/queues`. Three ways to list queues, reflecting two
  backend strategies: `artemis-straight` (direct), `artemis-jolokia`, and
  `artemis-jolokia/names`. The Jolokia endpoints return the JMX envelope shape
  `JolokiaResponse<T>` — the payload is in `.value`, not the response body itself.
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

**Styling:** Bootstrap 5 (global, via `angular.json` styles) plus Angular Material components,
SCSS per-component. TypeScript is in `strict` mode with `strictTemplates`.

## Gotchas

- **`QueueService.getLastUsedQueue` / `saveLastUsedQueue` hit relative paths** (`/last-used/{userId}`),
  unlike every other call which is absolute to `:8080`. With no `proxy.conf.json` in the repo these
  resolve against `localhost:4200` and will 404 in dev. If you touch queue persistence, this is
  likely the bug. **Note the restore path in `QueueDropdownComponent` deliberately swallows this
  error** — a first run with no stored preference is legitimate and must not raise a toast — so the
  broken URL fails invisibly and a spec pins that silence. Fix the URL and the silence stops being
  a problem; do not "fix" it by making the restore path noisy.
- `QueueDropdownComponent` hardcodes `userId = 'jason'` (Phase 4 replaces this with the
  authenticated user).
- **`message-list.html` fires Delete and Move to DLQ with no confirmation.** The modal is wired up
  in `message-detail` only. Same bug class, still open in the list view.
- `app.module.ts` imports **both** `NoopAnimationsModule` and `BrowserAnimationsModule`. Import
  order means Noop wins, so Material/toastr animations are disabled app-wide.
- Backend base URLs are hardcoded in the services; there are no `src/environments/` files.
