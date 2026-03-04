# CAMS Workflow Improvements Plan

Pre-API-access phase (browser-based, ~1000 users). Goal: minimize error rate, maximize debuggability from DB docs alone.

---

## 1. Capture Decrypted Request & Response

### What

Currently we only store the encrypted response (`rawResponse`). We need both encrypted + decrypted versions of request AND response saved to the DB doc.

### How

**`src/core/generator/cams.client.ts` — `submitAndIntercept`**

-   In the response handler, use `res.request().postData()` to get the encrypted request body
-   Use `encryption.decryptRequest()` (already exists) to decrypt it
-   Return 4 fields: `rawRequest`, `decryptedRequest`, `rawResponse`, `decryptedResponse`

**`src/core/generator/type.ts` — `StatementResult`**
Add fields:

```ts
rawRequest?: string;        // encrypted POST body sent to CAMS
decryptedRequest?: string;  // decrypted request JSON string
decryptedResponse?: string; // decrypted response JSON string
```

**`src/types/statements/mf-statements-requests.type.ts` — `requestMeta`**
Add fields:

```ts
rawRequest?: string;
decryptedRequest?: string;
decryptedResponse?: string;
```

**`src/jobs/statements.workflow.ts` — `requestStatement`**
Map the new fields from `StatementResult` into `requestMeta`.

### DB doc after this change

```json
{
    "requestMeta": {
        "rawRequest": "nX0NBSj99s...",
        "decryptedRequest": "{\"email\":\"user@gmail.com\",\"from_date\":\"01-Jan-2018\",...}",
        "rawResponse": "\"nX0NBSj99s...\"",
        "decryptedResponse": "{\"status\":{\"errorflag\":false,...},\"detail\":{...}}"
    }
}
```

---

## 2. Retry Logic — Browser Submission

### What

Currently if the browser form submission fails (CAPTCHA, timeout, dialog issues), it returns `{ success: false }` and the workflow throws with no retry.

### How

**`src/core/generator/cams.client.ts` — `submitForm`**

Wrap the core logic in a retry loop:

```
MAX_RETRIES = 3
RETRYABLE errors: CAPTCHA_ERROR, Timeout, dialog/navigation failures
NON-RETRYABLE: quota exceeded, invalid email, form validation errors

For each attempt:
  1. Close previous browser (if any)
  2. Reset proxy session (new IP)
  3. Re-init browser, re-fill form, re-submit
  4. If success → return result with attempt number
  5. If retryable error → log, continue to next attempt
  6. If non-retryable → return failure immediately
```

Add `attempt` field to `StatementResult` so we know which attempt succeeded.

### What NOT to do

-   No exponential backoff needed here — each attempt already takes 15-30s (browser init + form fill + captcha wait)
-   No queueing — keep it simple, sequential retries

---

## 3. Retry Logic — Email Fetch

### What

Currently: blind `while(true)` loop, 20 iterations, 30s sleep. No DB tracking of retries, no backoff, no failure handling.

### How

**`src/jobs/statements.workflow.ts` — `fetchReports`**

Replace with structured retry:

```
MAX_RETRIES = 15
INTERVALS: 30s for first 5, 60s for next 5, 120s for last 5
Total max wait: ~18 min (CAMS emails typically arrive within 5-10 min) //make it 30 mins, as we take full history which takes time.

For each attempt:
  1. Check Gmail for statement email matching refNumber
  2. If found → download, parse, save, return
  3. If not found:
     - Update DB: emailData.retries++, emailData.lastRetryAt
     - Log: attempt #, elapsed time since request, refNumber
     - Sleep for interval
  4. After all retries exhausted:
     - markFailed(requestId, 'email')
     - Save error details to requestMeta
```

---

## 4. Timing Milestones

### What

Track timestamps at key workflow phases. Stored in `requestMeta.timings` so we can see from the DB doc where time was spent and where things failed.

### How

**`src/types/statements/mf-statements-requests.type.ts` — `requestMeta`**
Add:

```ts
timings?: { //add duration keys for email finding, request submission. dont need it for parsing.
  startedAt: Date;
  requestSubmittedAt?: Date;  // form submitted, response received
  emailFoundAt?: Date;        // matching email found in Gmail
  parsedAt?: Date;            // PDF parsed successfully
  completedAt?: Date;         // entire workflow done
  failedAt?: Date;            // if workflow failed
  totalDurationMs?: number;   // end-to-end duration
};
```

**`src/jobs/statements.workflow.ts`**
Track `Date.now()` at each phase, save to requestMeta via a service method.

**`src/services/requests/statement-requests.service.ts`**
Add method:

```ts
async syncTimings(requestId: string, timings: Partial<MFStatementsRequests['requestMeta']['timings']>)
```

Uses `$set` with dot notation to merge timing fields without overwriting existing ones.

### DB doc after this change

```json
{
    "requestMeta": {
        "timings": {
            "startedAt": "2026-03-01T10:08:08.730Z",
            "requestSubmittedAt": "2026-03-01T10:08:41.535Z",
            "emailFoundAt": "2026-03-01T10:12:16.308Z",
            "parsedAt": "2026-03-01T10:12:17.200Z",
            "completedAt": "2026-03-01T10:12:17.201Z",
            "totalDurationMs": 248471
        }
    }
}
```

---

## 5. Error Tracking in DB

### What

Currently errors are `console.log`'d and lost. We need every failure to be visible in the DB doc so we can query for failed requests and see exactly what went wrong.

### How

**`src/types/statements/mf-statements-requests.type.ts` — `requestMeta`**
Add:

```ts
error?: {
  step: 'browser' | 'submit' | 'captcha' | 'email' | 'parse';
  message: string;
  attempt?: number;
};
```

**`src/jobs/statements.workflow.ts`**
At every catch block, save error details to DB before re-throwing:

-   Browser/dialog failure → `{ step: 'browser', message: err.message, attempt }`
-   CAPTCHA failure (after retries) → `{ step: 'captcha', message, attempt }`
-   Submission failure → `{ step: 'submit', message }`
-   Email not found (after retries) → `{ step: 'email', message: '15 retries exhausted' }`
-   PDF parse failure → `{ step: 'parse', message: err.message }`

Also update `status` field via existing `markFailed()` method.

**`src/services/requests/statement-requests.service.ts`**
Update `markFailed` to also accept and save error details:

```ts
async markFailed(requestId: string, reason: 'statement' | 'email' | 'parse', error?: { step: string; message: string; attempt?: number })
```

### DB doc on failure

```json
{
    "status": "request-failed",
    "requestMeta": {
        "error": {
            "step": "captcha",
            "message": "CAPTCHA_ERROR. Score: 0.1",
            "attempt": 3
        },
        "timings": {
            "startedAt": "...",
            "failedAt": "...",
            "totalDurationMs": 95000
        }
    }
}
```

---

## 6. Status Updates — Complete Lifecycle

### What

Currently `hasData` stays `false` and status doesn't always reflect reality. Need proper status transitions.

### How

**`src/jobs/statements.workflow.ts`**
After successful parse + save:

```ts
await statementRequestsService.findOneAndUpdate({ requestId }, { status: MFStatementStatus.StatementParsed, hasData: true, data });
```

### Status flow

```
request-created → (submit success) → request-created (with requestMeta)
                → (submit fail)    → request-failed

request-created → (email found)    → email-received
                → (email timeout)  → email-failed

email-received  → (parsed ok)     → statement-parsed (hasData: true)
                → (parse fail)    → parsed-failed
```

---

## Files to Modify (in order)

| #   | File                                                  | Changes                                                                                           |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `src/core/generator/type.ts`                          | Add `rawRequest`, `decryptedRequest`, `decryptedResponse`, `attempt` to `StatementResult`         |
| 2   | `src/types/statements/mf-statements-requests.type.ts` | Add `rawRequest`, `decryptedRequest`, `decryptedResponse`, `timings`, `error` to `requestMeta`    |
| 3   | `src/core/generator/cams.client.ts`                   | Capture request body in interceptor, add submission retry loop                                    |
| 4   | `src/services/requests/statement-requests.service.ts` | Add `syncTimings` method, update `markFailed` to accept error details                             |
| 5   | `src/jobs/statements.workflow.ts`                     | Timing tracking, email retry with backoff, error handling, pass new fields, proper status updates |

Schema (`mf-statements-requests.schema.ts`) needs no changes — `requestMeta` is `Schema.Types.Mixed`.

---

## What This Does NOT Include (intentionally)

-   No alerting system (can be added later by querying `status: *-failed` docs)
-   No queue/job system (sequential is fine for 1000 users)
-   No request deduplication (not needed at this scale)
-   No dashboard (DB queries suffice for now)

## Debugging Queries After Implementation

```js
// Find all failed requests
db.getCollection('statements.requests').find({ status: { $in: ['request-failed', 'email-failed', 'parsed-failed'] } });

// Find slow requests (>5 min)
db.getCollection('statements.requests').find({ 'requestMeta.timings.totalDurationMs': { $gt: 300000 } });

// Find CAPTCHA failures
db.getCollection('statements.requests').find({ 'requestMeta.error.step': 'captcha' });

// Find requests that needed retries
db.getCollection('statements.requests').find({ 'requestMeta.retries': { $gt: 0 } });
```
