# WP13 — Yahoo lineup-write beta

**Goal**: allow an explicitly consenting Yahoo user to apply reviewed date-specific lineup changes
without enabling autonomous or transactional roster management.
**Depends on**: WP11 stable read sync. **Branch**: `wp13-yahoo-lineup-write`.

**Owner gates**: approve Yahoo Read/Write app permission, production credentials/settings, beta
cohort, and release after the security/safety review. Do not start or enable writes unprompted.

## Safety model

1. Generate recommendation from a fresh Yahoo read.
2. User selects one date and opens a before/after diff.
3. Re-read roster, eligibility, lock state, and relevant date immediately before execution.
4. Detect drift and force regeneration rather than overwriting changed state.
5. Require explicit confirmation naming the date and moves.
6. Issue only supported roster-position changes.
7. Read after write and compare expected versus actual state.
8. Store an audit record without credentials/private raw payloads.

No automatic/background execution. No add/drop, waiver, trade, or commissioner operations even if
the broad Yahoo grant technically permits them.

## Delivery stages

- Internal one-day writes.
- Small opt-in beta with monitoring and kill switch.
- Multi-day preview where each affected date is independently selectable and confirmed.
- Weekly apply only after lock/date semantics are proven in real hockey leagues.

## Acceptance criteria

- [ ] Locked/ineligible/drifted changes cannot be submitted.
- [ ] Every write has preview, confirmation, audit id, response, and read-after-write result.
- [ ] Retries cannot duplicate or mutate unintended dates.
- [ ] Partial failures show exact verified Yahoo state and recovery path.
- [ ] Kill switch disables writes while leaving read sync usable.
- [ ] Security review, real-league dogfood, and explicit owner release approval completed.

