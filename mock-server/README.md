# Mock backend

A standalone stand-in for the Spring/Artemis backend, so the frontend can be developed and
exercised without Docker, Redis, a broker or a JVM.

```bash
npm run mock                      # http://localhost:8080
npm start                         # the Angular app, in another terminal
```

Then open the control panel at **<http://localhost:8080/__mock>** and sign in to the app as
`admin`/`admin` (ADMIN) or `jason`/`jason` (USER) — the same two accounts the real
`UserConfig` defines.

No dependencies: it is `node:http` and three files. `npm ci` is not needed to run it, and it
adds nothing to the Angular build.

```
node mock-server/server.js --port 8099 --origin http://localhost:4300
PORT=8099 MOCK_ORIGIN=http://localhost:4300 node mock-server/server.js
```

## Why it exists

Most of the frontend's error handling is unreachable in normal development. Seeing a 502
means stopping a real broker; seeing `{"success": false}` on an HTTP 200 means contriving a
broker-side failure; seeing the ADMIN-only 403 means logging in twice. The control panel
turns each of those into a button, so the branches can be walked in a few seconds.

## The contract it reproduces

Faithfulness to the real backend is the whole point — a mock that is merely *plausible* would
hide the bugs this is meant to surface.

| Endpoint | Behaviour |
|---|---|
| `POST /api/auth/login` | `{token, username, roles}`; roles are bare (`ADMIN`, `USER`), no `ROLE_` prefix |
| `GET /api/queues/artemis-jolokia/names` | a bare JSON array of strings — no Jolokia envelope |
| `GET /api/queues/last-used` | `text/plain`; **absence is an empty 200**, never a 404 |
| `POST /api/queues/last-used` | raw `text/plain` body; the user comes from the token, not the path |
| `GET /api/messages/queue/{q}` | array of `JmsMessageDto` (`messageId`, `payload`, `queueName`, `timestamp`, `properties`) |
| `GET /api/messages/queue/{q}/message/{id}` | one DTO, or an **empty 200** when it is absent |
| `POST .../resend` | `ApiResponse`; allowed for USER |
| `DELETE .../message/{id}` | `ApiResponse`; **ADMIN only** |
| `POST .../move-to-dlq` | `ApiResponse`; **ADMIN only** |

Three details are easy to get wrong and are reproduced deliberately:

- **A mutating call fails with HTTP 200.** `{"success": false, "message": "..."}` is the
  failure shape; the status line stays 200. Any caller that only handles the error callback
  treats it as a success. The `refused` scenario forces this on every mutating endpoint.
- **The two 401s are different.** Bad credentials at login go through `ApiExceptionHandler`
  and carry an `ApiResponse` body. A missing or expired token is rejected by the
  resource-server filter *before* any controller, so it is a **bare 401 with no body** —
  which is what `AuthInterceptor` keys off to clear the session.
- **403 has no body either.** `@PreAuthorize` raises `AccessDeniedException`, which
  `ApiExceptionHandler` does not handle, so it is translated by the security filter chain
  into a bare 403. Log in as `jason` and try to delete to see it.

Upstream faults keep their honest statuses: **502** for a broker failure (the broker is a
dependency, not this app), **400** for a message ID rejected by the `SAFE_MESSAGE_ID` guard,
**500** for anything else.

## Scenarios

Each row in the panel forces one endpoint into one state until you change it back. `ok` is
the happy path.

| Route | Scenarios |
|---|---|
| `messages.list` | `ok` `empty` `slow` `broker-down` `server-error` |
| `messages.get` | `ok` `not-found` `broker-down` `server-error` |
| `messages.resend` | `ok` `refused` `bad-id` `broker-down` |
| `messages.delete` | `ok` `refused` `forbidden` `broker-down` |
| `messages.dlq` | `ok` `refused` `bad-id` `broker-down` |
| `queues.names` | `ok` `empty` `broker-down` |
| `queues.lastUsed` | `ok` `none` `server-error` |
| `auth.login` | `ok` `invalid` |

`slow` adds 3s to the message list alone; the latency box adds its delay to every `/api`
response, which is the one to reach for when checking that a spinner appears at all.

The panel is driven by a small HTTP API, so a script can do the same thing:

```bash
curl -X POST localhost:8080/__mock/state -H 'Content-Type: application/json' \
     -d '{"route":"messages.list","scenario":"broker-down"}'
curl -X POST localhost:8080/__mock/reset          # fixtures and scenarios back to seed
curl localhost:8080/__mock/state                  # current state + the request log
```

## State

Mutations are real: deleting removes the message, and move-to-DLQ relocates it and stamps
`_AMQ_ORIG_QUEUE`, so the list refresh after an action shows something true. It is all
in-memory — **Reset fixtures**, or a restart, puts it back.

`activemq.management::orders` is in the fixture set on purpose: its `::` becomes `%3A%3A` on
the wire, which is the shape of name that exposed the double-encoding bug. Payloads cover
JSON, XML, delimited text and one truncated JSON body, because `prettyPayload` takes a
different branch through each.

## The double-encoding trap

The panel's **Reject double-encoded paths** toggle (on by default) makes the mock answer 400
to any path segment containing `%25`, reproducing what the real deployment does when a route
param is encoded twice — `%3A` becoming `%253A`. That request is rejected by the container
before Spring sees it, so nothing appears in the backend log and the browser reports only
that the call failed, which is what made the original bug expensive to find.

The mock logs a loud `[mock] 400 double-encoded path segment: ...` line and tags the request
in the panel's log, so the same mistake announces itself immediately. It reproduces the
*observed* behaviour; the container's exact rule for rejecting these is not modelled, so
treat the trap as a tripwire rather than a specification. Turn it off if a legitimate queue
name ever needs a literal `%`.

## Fidelity caveat

This mock is hand-written against the backend as it stood on 2026-08-28, not generated from
it — nothing keeps the two in step automatically. If a contract detail here disagrees with
the real backend, the backend is right and this file is stale. The behaviours worth
re-checking after backend changes are the ones above: the 200-with-`success:false` envelope,
which endpoints are ADMIN-only, and whether 401/403 carry bodies.
