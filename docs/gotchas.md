# Gotchas

Moved out of `CLAUDE.md` on 2026-10-31, word for word, so it no longer loads into every
session. `CLAUDE.md` keeps each rule as a line or two and points here for the reason. Where the
text below says "this file", it means `CLAUDE.md` as it stood when the passage was written.

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
- **The modal's outputs are `confirm` and `cancelled`** (`cancel` until the Angular 22 upgrade;
  it shadowed the DOM `cancel` event). A binding to an output the child does not declare still
  compiles — Angular binds it as a native DOM listener — so a stale `(cancel)` leaves Cancel dead
  with no error. Each view has a spec that clicks the rendered modal's Cancel for this reason.
- **ngx-toastr is held on Angular 22 by an npm `overrides` entry in `package.json`.** 19.x no
  longer builds on 22 (it injects `ComponentFactoryResolver`, which 22 no longer exports), and
  20.0.5 — the newest release — declares peers `@angular/common|core ^21`, so `npm install` fails
  ERESOLVE without the override re-pointing them at the root versions. Drop it once ngx-toastr
  declares 22. `@angular/animations` is gone too: ngx-toastr 20 animates without it, so do not
  re-add `BrowserAnimationsModule`.
- **The Jasmine that runs is karma-jasmine's, not the root `jasmine-core`.** karma-jasmine 5.1.0
  (the final release; Karma is deprecated) depends on `jasmine-core ^4.1.0` and resolves it from
  its own directory, so the root `jasmine-core` / `@types/jasmine` are held on 4.6 to match it —
  the root copy only feeds the HTML reporter. Forcing Jasmine 5+ with an override fails the run:
  it reports the router's internal `NoMatch` rejections (caught by the router, invisible in the
  app) as unhandled, and 6 adds unsupported-configuration warnings from zone.js's Jasmine patch.
  Vitest is the way forward, not a newer Jasmine under Karma.
- **Pass route params to `Router.navigate` raw.** The Router encodes path segments,
  `ActivatedRoute` decodes them, and `MessageService` encodes for the HTTP call — one encode per
  boundary. Pre-encoding in `viewMessage()` produced `%253A`, which **Tomcat rejects with a 400
  before Spring sees it**, so nothing appears in the backend log and the browser reports it as
  unreachable. This killed the whole detail view for a while.
