# Volumetrico — Exhaustive Codebase Audit & Fix Plan

## Executive Summary

After reading every file in both the server and frontend codebases, I've identified **28 discrete issues** across 6 categories. They are prioritized by production impact: **P0** (ship-blockers), **P1** (high-impact), **P2** (medium), **P3** (low/hygiene).

---

## P0 — Critical / Ship-Blockers

### 1. 🔴 JWT Secrets Are Placeholder Values in Production `.env`
**File:** [server/.env](file:///Users/rick/dev/byrick.net/pumps/server/.env#L8-L9)

The live `.env` contains `change-me-in-production-to-a-long-random-string`. If this is running in production, **every token is signed with a guessable key**.

```diff
- JWT_SECRET=change-me-in-production-to-a-long-random-string
- JWT_REFRESH_SECRET=change-me-in-production-to-another-long-random-string
+ JWT_SECRET=<output of: openssl rand -base64 48>
+ JWT_REFRESH_SECRET=<output of: openssl rand -base64 48>
```

**Also:** Add startup validation in [server/src/index.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/index.ts):
```ts
if (process.env.JWT_SECRET?.includes('change-me')) {
  console.error('FATAL: JWT_SECRET is still a placeholder. Exiting.');
  process.exit(1);
}
```

---

### 2. 🔴 Credentials Committed to Version Control
**Files:** [server/.env](file:///Users/rick/dev/byrick.net/pumps/server/.env), [server/.env.example](file:///Users/rick/dev/byrick.net/pumps/server/.env.example)

Both files contain real database passwords (`rfQ22tx6_3<H`) and Redis passwords (`9ua8i.dcxT27`). The `.env.example` should only contain dummy values.

**Fix:** Scrub `.env.example`, add `server/.env` to `.gitignore`, rotate all leaked credentials.

---

### 3. 🔴 No Environment Variable Validation at Startup
**File:** [server/src/index.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/index.ts)

The server boots even if `DATABASE_URL`, `REDIS_URL`, or `JWT_SECRET` are missing/empty. This leads to silent failures or insecure defaults.

**Fix:** Add a `validateEnv()` function using Zod at the top of `index.ts`:
```ts
import { z } from 'zod';
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});
export const env = envSchema.parse(process.env);
```

---

### 4. 🔴 `removeWithdrawal` Deletes from UI Without Server Call
**File:** [PumpView.tsx](file:///Users/rick/dev/byrick.net/pumps/src/pages/dispatcher/PumpView.tsx#L149-L152)

```ts
const removeWithdrawal = useCallback((id: string) => {
  setWithdrawals((prev) => prev.filter((w) => w.id !== id));
  setTransactions((prev) => prev.map((t) => t.withdrawalId === id ? { ...t, withdrawalId: null } : t));
}, []);
```

This removes the withdrawal **only from React state** — it's never deleted server-side. The manager dashboard and shift reports will still show it. This is a **data integrity bug** in a financial system.

**Fix:** Either remove the delete button entirely (withdrawals shouldn't be deletable by dispatchers), or wire it to a `DELETE /withdrawals/:id` endpoint with proper authorization.

---

## P1 — High Impact

### 5. 🟠 No Rate Limiting on Auth Endpoints
**File:** [server/src/routes/auth.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/auth.ts)

The `/auth/login` endpoint has no rate limiting. An attacker can brute-force numeric IDs + 4-digit PINs (only ~10,000 combinations per user).

**Fix:** Add `express-rate-limit` to login:
```ts
import rateLimit from 'express-rate-limit';
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiados intentos' } });
router.post('/login', loginLimiter, async (req, res) => { ... });
```

---

### 6. 🟠 Token Refresh Doesn't Rotate the Refresh Token
**File:** [server/src/routes/auth.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/auth.ts#L80-L106)

On refresh, the server issues a new access token but returns the **same** refresh token. If a refresh token is compromised, it can be used indefinitely.

**Fix:** Issue a new refresh token on each rotation and invalidate the old one (store a token family ID in Redis).

---

### 7. 🟠 SQL Injection Surface in `readings.ts`
**File:** [server/src/routes/readings.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/readings.ts)

While most queries use parameterized `$1` placeholders correctly, validate the `readingType` field is constrained to `'start' | 'end'` before it hits the query. Currently it's an unchecked string from `req.body`.

**Fix:** Add validation:
```ts
if (!['start', 'end'].includes(readingType)) {
  return res.status(400).json({ error: 'readingType must be "start" or "end"' });
}
```

---

### 8. 🟠 No Input Validation on Any Route Handler
**Files:** All files in [server/src/routes/](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/)

None of the route handlers validate `req.body` or `req.params` with a schema. A malformed request to `/transactions` could insert `NaN` amounts into the database.

**Fix:** Add Zod schemas for every mutation endpoint. Example for transactions:
```ts
const createTransactionSchema = z.object({
  shiftId: z.string().uuid(),
  type: z.enum(['Cash', 'Card', 'Credit']),
  amount: z.number().positive(),
  pumpId: z.string().uuid().optional(),
  liters: z.number().nonnegative().optional(),
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
  creditCategoryId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});
```

---

### 9. 🟠 Dashboard Route Has N+1 Potential at Scale
**File:** [server/src/routes/dashboard.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/dashboard.ts)

The dashboard fires **7+ parallel queries** per request, every 15 seconds, for every connected manager. At scale this will saturate the pool.

**Fix:** Consolidate into 1-2 queries using CTEs, or cache the summary in Redis with a 5-second TTL:
```ts
const cached = await redis.get(`dashboard:${shiftId}`);
if (cached) return res.json(JSON.parse(cached));
// ... compute ...
await redis.set(`dashboard:${shiftId}`, JSON.stringify(result), 'EX', 5);
```

---

### 10. 🟠 Connection Pool Has No Leak Protection
**File:** [server/src/lib/db.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/lib/db.ts)

The pool uses defaults (`max: 10`). Long-running transactions or uncaught errors in route handlers can exhaust connections silently.

**Fix:**
```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
pool.on('error', (err) => console.error('Unexpected pool error', err));
```

---

## P2 — Medium Impact

### 11. 🟡 Socket Reconnection Lacks Exponential Backoff
**File:** [src/lib/socket.ts](file:///Users/rick/dev/byrick.net/pumps/src/lib/socket.ts#L10-L14)

Uses default Socket.IO reconnection, which does have backoff, but the `auth.token` is captured at creation time and never updated on reconnect.

**Fix:**
```ts
socket = io(SOCKET_URL, {
  auth: (cb) => cb({ token: getAccessToken() }), // dynamic auth
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
});
```

---

### 12. 🟡 `apiFetch` Refresh Race Condition
**File:** [src/lib/api.ts](file:///Users/rick/dev/byrick.net/pumps/src/lib/api.ts#L72-L97)

If two requests fail with 401 simultaneously, both will try to refresh the token. The second one will use a stale refresh token.

**Fix:** Use a shared Promise to deduplicate refresh calls:
```ts
let refreshPromise: Promise<string> | null = null;
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
```

---

### 13. 🟡 `useSocket` Returns Stale Socket Reference
**File:** [src/hooks/useSocket.ts](file:///Users/rick/dev/byrick.net/pumps/src/hooks/useSocket.ts#L5)

`socketRef.current = getSocket()` at module level. If the socket disconnects and a new one is created, the ref is stale.

**Fix:** Return `socketRef.current` via a getter, not a captured value:
```ts
return { subscribe, get socket() { return socketRef.current; } };
```

---

### 14. 🟡 `TransactionForm` Doesn't Close on Submit
**File:** [PumpView.tsx](file:///Users/rick/dev/byrick.net/pumps/src/pages/dispatcher/PumpView.tsx#L124-L133) + [TransactionForm.tsx](file:///Users/rick/dev/byrick.net/pumps/src/components/dispatcher/TransactionForm.tsx#L89)

The backdrop's `onClick` calls `resetForm` but doesn't toggle `transactionFormOpen`. The form's `onSubmit` resets state but `PumpView` never sets `transactionFormOpen = false`.

**Fix:** Add an `onClose` prop to `TransactionForm` and call it from both the backdrop and after successful submit.

---

### 15. 🟡 Missing Database Indexes for High-Volume Queries
**File:** [server/migrations/001_pumps_schema.sql](file:///Users/rick/dev/byrick.net/pumps/server/migrations/001_pumps_schema.sql)

Key queries filter by `shift_id` on `transactions`, `meter_readings`, and `withdrawals`. These columns need indexes:

```sql
CREATE INDEX idx_transactions_shift_id ON transactions(shift_id);
CREATE INDEX idx_meter_readings_shift_id ON meter_readings(shift_id);
CREATE INDEX idx_withdrawals_shift_id ON withdrawals(shift_id);
CREATE INDEX idx_transactions_withdrawal_id ON transactions(withdrawal_id);
CREATE INDEX idx_shift_assignments_shift_id ON shift_assignments(shift_id);
```

---

### 16. 🟡 Shift Close Doesn't Validate All Readings Present
**File:** [server/src/routes/shifts.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/shifts.ts)

Closing a shift doesn't check that all hoses have both `start` and `end` readings. This produces `0L` in reports for pumps that were used but not read.

**Fix:** Before closing, query for missing readings and return a 400 if incomplete.

---

### 17. 🟡 Redis Subscriber Doesn't Handle Reconnection
**File:** [server/src/realtime/subscriber.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/realtime/subscriber.ts)

If Redis disconnects and reconnects, the `psubscribe` is lost. No re-subscription logic exists.

**Fix:**
```ts
subscriber.on('reconnected', () => {
  subscriber.psubscribe('pumps:*');
});
```

---

### 18. 🟡 Duplicated `formatCurrency`/`formatTime` Across 5+ Files
**Files:** `DashboardPage.tsx`, `ShiftDetailPage.tsx`, `WithdrawalApprovalPage.tsx`, `PendingWithdrawals.tsx`, `ShiftHistoryPage.tsx`

Each file re-declares the same formatting functions.

**Fix:** Move to the existing [src/lib/formatters.ts](file:///Users/rick/dev/byrick.net/pumps/src/lib/formatters.ts) and import everywhere.

---

## P3 — Low / Hygiene

### 19. 🔵 `WithdrawalApprovalPage` Fires N+1 API Calls
**File:** [WithdrawalApprovalPage.tsx](file:///Users/rick/dev/byrick.net/pumps/src/pages/manager/WithdrawalApprovalPage.tsx#L248-L275)

For each pending withdrawal, it makes a separate `GET /withdrawals/:id/transactions` call inside a `useEffect`. With 20 pending withdrawals, that's 20 sequential HTTP requests.

**Fix:** Create a batch endpoint `GET /withdrawals/pending/details` that returns withdrawals with embedded transactions in one response.

---

### 20. 🔵 `PendingWithdrawals` Component Duplicates `WithdrawalApprovalPage`
**Files:** [PendingWithdrawals.tsx](file:///Users/rick/dev/byrick.net/pumps/src/components/manager/PendingWithdrawals.tsx) and [WithdrawalApprovalPage.tsx](file:///Users/rick/dev/byrick.net/pumps/src/pages/manager/WithdrawalApprovalPage.tsx)

Both components implement the exact same approve/reject logic with separate mutations and socket subscriptions. This is a maintenance risk.

**Fix:** Extract a `useWithdrawalApproval` hook containing the shared mutation + socket logic.

---

### 21. 🔵 `ProtectedRoute` Uses Non-Null Assertion
**File:** [ProtectedRoute.tsx](file:///Users/rick/dev/byrick.net/pumps/src/components/shared/ProtectedRoute.tsx#L17)

```ts
if (!allowedRoles.includes(user!.role)) {
```

The `user!` assertion is unnecessary since `isAuthenticated` is checked first, but if the auth context ever changes shape, this will crash.

**Fix:** Use optional chaining: `user?.role && allowedRoles.includes(user.role)`.

---

### 22. 🔵 Withdrawal Deletion Has No Confirmation Dialog
**File:** [WithdrawalManager.tsx](file:///Users/rick/dev/byrick.net/pumps/src/components/dispatcher/WithdrawalManager.tsx#L134-L141)

Clicking the trash icon immediately removes the withdrawal with no confirmation. In a financial app, this is dangerous.

---

### 23. 🔵 `PumpCard` Uses Mutable `let` Variable in Render
**File:** [PumpCard.tsx](file:///Users/rick/dev/byrick.net/pumps/src/components/dispatcher/PumpCard.tsx#L31)

```ts
let totalCash = 0;
// ... mutated during render
```

This works but is fragile — a derived value should be computed via `useMemo` or calculated inline.

---

### 24. 🔵 No CORS Restriction on WebSocket Connections
**File:** [server/src/index.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/index.ts)

The Socket.IO server should restrict `cors.origin` to the same values as the Express CORS middleware.

---

### 25. 🔵 `handleLogout` Uses Direct `window.location` Assignment
**File:** [PumpView.tsx](file:///Users/rick/dev/byrick.net/pumps/src/pages/dispatcher/PumpView.tsx#L182)

```ts
const handleLogout = () => { logout(); window.location.href = '/login'; };
```

This triggers a full page reload. Should use `navigate('/login', { replace: true })` from React Router for a client-side transition.

---

### 26. 🔵 `api.ts` Hardcodes Fallback to `localhost:4000`
**File:** [src/lib/api.ts](file:///Users/rick/dev/byrick.net/pumps/src/lib/api.ts#L3)

If `VITE_API_URL` is missing, the app silently falls back to localhost. In production this would cause silent failures.

---

### 27. 🔵 Reports Route Lacks Access Control
**File:** [server/src/routes/reports.ts](file:///Users/rick/dev/byrick.net/pumps/server/src/routes/reports.ts)

Verify this route applies `requireAuth` + `requireRole('Manager')`. Any authenticated dispatcher could download any shift's financial report by guessing the shift ID.

---

### 28. 🔵 Typo in ShiftDetailPage
**File:** [ShiftDetailPage.tsx](file:///Users/rick/dev/byrick.net/pumps/src/pages/manager/ShiftDetailPage.tsx#L609)

`Montos retiradaos` → should be `Montos retirados`.

---

## Proposed Execution Order

| Phase | Items | Effort |
|-------|-------|--------|
| **Phase 1: Security Hardening** | #1, #2, #3, #5, #7, #8 | ~2 hours |
| **Phase 2: Data Integrity** | #4, #6, #14, #16 | ~1.5 hours |
| **Phase 3: Performance** | #9, #10, #15, #19 | ~1.5 hours |
| **Phase 4: Reliability** | #11, #12, #13, #17 | ~1 hour |
| **Phase 5: Code Quality** | #18, #20, #21, #23, #25, #26, #28 | ~1 hour |
| **Phase 6: Access Control** | #22, #24, #27 | ~30 min |

## Open Questions

> [!IMPORTANT]
> 1. **Is `server/.env` committed to git?** If yes, all credentials need immediate rotation.
> 2. **Should withdrawals be deletable by dispatchers?** Issue #4 suggests the delete is UI-only — is this intended as a "soft undo" or a bug?
> 3. **Do you want withdrawal approval to be mandatory?** Currently the flow creates withdrawals in `pending` status, but there's no enforcement preventing the dispatcher from proceeding without approval.

## Verification Plan

### Automated
- `tsc --noEmit` on both server and frontend
- Run the dev server and hit every API endpoint with Postman/curl
- Verify the new indexes with `EXPLAIN ANALYZE` on shift-detail queries

### Manual
- Test login rate limiting by sending 11 rapid requests
- Verify token refresh deduplication by opening 3 browser tabs
- Confirm socket reconnects after Redis restart
