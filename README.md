# Message Inspector — UI

An Angular 16 front end for inspecting **ActiveMQ Artemis JMS queues**: pick a queue, browse
its messages, view one (with pretty-printed JSON/XML payloads), and resend / delete / move
it to a dead-letter queue. It talks to the
[Spring Boot backend](https://github.com/Jason-McKay/message-inspector) on `:8080`.

## Screenshots

| Message list | Message detail (pretty-printed payload) |
|---|---|
| ![Message list](docs/images/message-list.jpg) | ![Message detail](docs/images/message-detail-json.jpg) |

| Confirm a destructive action | Queue diagnostics |
|---|---|
| ![Confirmation modal](docs/images/confirm-modal.jpg) | ![Queues](docs/images/queues.jpg) |

Sign-in ([screenshot](docs/images/login.jpg)) gates the whole app behind a route guard.

## How it fits together

An **NgModule** app (not standalone components) — everything is declared in `app.module.ts`.
The one piece of cross-component wiring worth knowing is `QueueSelectionService`: it is the
single source of truth for "which queue am I looking at". The dropdown writes to it; the
message list subscribes and refetches on every change.

```mermaid
flowchart TD
    Login[LoginComponent] -->|JWT to sessionStorage| Auth[AuthService]
    Auth --> Guard[authGuard]
    Auth --> Intc["AuthInterceptor<br/>bearer + 401 → /login"]
    Dropdown[QueueDropdownComponent] -->|setSelectedQueue| Sel[(QueueSelectionService)]
    Route["/messages/:queueName"] -->|publishes route queue| Sel
    Sel -->|selectedQueue$| List[MessageListComponent]
    List -->|View| Detail[MessageDetailComponent]
    List & Detail -->|HTTP| API["Backend :8080"]
    Intc -. attaches token .-> API
```

## Running it

Needs the **backend running on `:8080`** (see its repo) and **Node 20.11.1** — Angular 16
does not support the global Node 24, so pin it:

```bash
nvm use 20.11.1     # nvm install 20.11.1 first if needed
npm install
npm start           # ng serve on http://localhost:4200
```

Log in with `jason`/`jason` (USER) or `admin`/`admin` (ADMIN — the only role that can delete
or move to DLQ).

## Testing

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

The suite is behavioural, not smoke-only: it runs against jasmine-spied services (not
`HttpClientTestingModule`), so each component is covered for success, body-level failure,
and HTTP-level failure. Destructive actions carry template-level specs that click the
rendered button — a regression guard, because the bug they prevent (wiring a button straight
to the service, bypassing the confirm modal) passes a spec that calls the handler directly.

## Patterns worth knowing before you touch a service call

- **The backend returns HTTP 200 on business failure**, with the outcome in the body as
  `{"success": false, "message": "..."}`. An Observable `next` does **not** mean the call
  worked — every caller checks `res.success`. Transport faults are separate: **400**
  rejected id, **502** broker down, **500** otherwise. `ToastService.apiError` /
  `describeApiError` is the single place these become user-facing text.
- **Every service URL is absolute to `:8080`.** There is no `proxy.conf.json`; a relative
  URL silently resolves against the dev server on `:4200`.
- **Route params pass through `Router.navigate` raw** — one encode per boundary (Router
  encodes, `ActivatedRoute` decodes, the service encodes for the HTTP call). Pre-encoding
  produces `%253A`, which the backend's servlet container rejects with a 400.

More detail — the gotchas, the response contract, and why several things are the way they
are — is in [`CLAUDE.md`](CLAUDE.md) and the backend's
[Architecture Decision Records](https://github.com/Jason-McKay/message-inspector/tree/master/docs/adr).
