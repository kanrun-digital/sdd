<!-- Template for `sequences` — embedded INLINE in docs/features/<slug>/sad.md §6 (Runtime view). -->
<!-- One `### <flow name>` block per critical flow. Participants are GENERIC placeholders — -->
<!-- replace the <…> message/note text with this flow's specifics, NOT the participant names. -->
<!-- Generic vocabulary (the only allowed participants): -->
<!--   <client>          — whatever initiates the flow (UI, CLI, another service, a scheduler) -->
<!--   <service>         — the building block that owns this flow (from §5) -->
<!--   <data-store>      — the persistent store the service reads/writes -->
<!--   <external-system> — a third party the service calls -->
<!--   <message-bus>     — async transport (queue / event stream) for non-sync flows -->
<!-- Naming the concrete technology is `design`/`data-model`'s job, not the runtime view's. -->

### <flow name>

<!-- SYNC flow: request → response, with the error branches the spec's acceptance criteria demand. -->
<!-- Every write becomes a persist note so `data-model` knows what to index downstream. -->

```mermaid
sequenceDiagram
    autonumber
    participant C as <client>
    participant S as <service>
    participant D as <data-store>

    Note over C,S: Precondition: <state required before this flow, from spec>
    C->>S: <action>
    S->>D: <read / lookup>
    D-->>S: <result>
    S->>D: <write>
    Note over S,D: persists <entity> (see §6 / informs data-model indexes)
    D-->>S: <ack>
    S-->>C: <success outcome>
    alt <error condition from acceptance criteria>
        S-->>C: <error outcome — name it, no status numbers>
    else <second error condition>
        D-->>S: <store failure>
        S-->>C: <error outcome>
    end
    Note over C,S: Postcondition: <state guaranteed after this flow, from spec>
```

### <async flow name>

<!-- ASYNC flow (webhook in / scheduled job / queued or event-driven step / third-party callback). -->
<!-- MUST include: idempotency-key check as the first handler step, a retry note, a dead-letter branch. -->

```mermaid
sequenceDiagram
    autonumber
    participant C as <client>
    participant B as <message-bus>
    participant S as <service>
    participant X as <external-system>
    participant D as <data-store>

    Note over C,B: Trigger: <event / schedule / callback that starts this flow>
    C->>B: <enqueue event>
    B->>S: <deliver event>
    S->>S: check idempotency key (skip if already processed)
    S->>X: <outbound call>
    X-->>S: <response>
    S->>D: <write result>
    Note over S,D: persists <entity> (informs data-model indexes)
    D-->>S: <ack>
    Note over S,X: retry <N> times with exponential backoff on failure
    alt exhausted retries
        S->>B: <route to dead-letter>
        Note over S,B: dead-letter after <N> failed attempts
    end
```

### <compensation flow name> (saga rollback — draw when ≥2 async actors chain)

<!-- COMPENSATION flow (W5). Draw when a flow chains ≥2 async actors into a multi-step saga and a -->
<!-- later step can fail after an earlier step already committed side-effects. The dead-letter -->
<!-- branch above only quarantines the failing step. It does NOT undo the steps that succeeded. -->
<!-- Gate: if you draw a multi-step async flow, draw this OR mark an explicit N/A with a reason -->
<!-- ("each step is independently idempotent + DLQ-only is an accepted policy — ADR-NNNN"). -->

```mermaid
sequenceDiagram
    autonumber
    participant C as <client>
    participant S as <service>
    participant D as <data-store>
    participant X as <external-system>

    Note over C,S: Saga: steps 1..N each commit a side-effect; step K failed
    Note over S,D: Step 1..K-1 already committed (not rolled back by the dead-letter)
    S->>S: step K failed — initiate compensation
    loop undo steps K-1 down to 1
        S->>D: <compensating write — reverse of step i's effect>
        Note over S,D: e.g. release reserved stock / refund charge / mark record void
        S->>X: <compensating outbound call if step i called out>
    end
    S->>D: <mark saga as compensated-failed>
    Note over C,S: Postcondition: no partial success leaked — the saga is all-or-nothing OR the
    Note over C,S: compensations are documented + the final state is consistent
```

### <timeout / degrade flow name> (fallback when an external-system call times out)

<!-- TIMEOUT / DEGRADE flow (W5). Draw when a flow includes an <external-system> participant and -->
<!-- the spec's success criteria cannot tolerate indefinite blocking. Gate: if you draw a flow -->
<!-- with <external-system>, draw a timeout branch OR mark N/A with a reason -->
<!-- ("the call is fire-and-forget / has its own async retry — no sync degradation needed"). -->

```mermaid
sequenceDiagram
    autonumber
    participant C as <client>
    participant S as <service>
    participant X as <external-system>
    participant D as <data-store>

    Note over C,S: Precondition: <external call has a documented timeout budget>
    C->>S: <action requiring external data>
    S->>X: <outbound call>
    alt response within <timeout budget>
        X-->>S: <result>
        S->>D: <write fresh result (cache it if applicable)>
        S-->>C: <success outcome>
    else timeout / X unreachable
        Note over S,X: timeout after <budget> — do NOT block the user indefinitely
        S->>D: <read last-known / cached / default>
        D-->>S: <stale-or-default value>
        S-->>C: <degraded outcome — name what the user sees: "showing cached" / "default" / partial>
        Note over S,D: emits a metric: external_call_degraded (informs §8 observability)
    end
```

### <concurrency / conflict flow name> (optimistic-lock conflict)

<!-- CONCURRENCY flow (W5). Draw when ≥2 writers can race on the same entity (two requests mutating -->
<!-- the same record, two jobs claiming the same work item). Gate: if the spec's domain-invariant -->
<!-- ACs imply concurrent writes to one entity, draw this OR mark N/A ("single-writer guarantee -->
<!-- elsewhere — e.g. a queue serializes writes to this entity"). -->

```mermaid
sequenceDiagram
    autonumber
    participant C1 as <client A>
    participant C2 as <client B>
    participant S as <service>
    participant D as <data-store>

    Note over S,D: Precondition: entity carries a version / optimistic-lock token
    C1->>S: <mutate entity, version=N>
    C2->>S: <mutate entity, version=N> (concurrent)
    S->>D: <apply C1's write — version becomes N+1>
    D-->>S: ok
    S->>D: <apply C2's write — expected version=N, actual=N+1>
    D-->>S: conflict (version mismatch)
    alt conflict
        Note over S,C2: optimistic-lock conflict — C2's write rejected, NOT silently applied
        S-->>C2: <conflict outcome — name it: "stale, re-read and retry">
        C2->>S: <re-read fresh version=N+1, re-apply with merged intent>
        S->>D: <write version=N+2>
        D-->>S: ok
        S-->>C2: <success on retry>
    end
```
