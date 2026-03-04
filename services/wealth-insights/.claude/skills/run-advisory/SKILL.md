---
name: run-advisory
description: Run the full advisory pipeline for a user — analysis, dashboard, insights, actionables, and standalone features (peer percentile, shadow index, FI countdown). Generates dashboard-data.json and embeds into dashboard.html.
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
argument-hint: "[path-to-parsed.json]"
---

# Run Advisory Pipeline

Run the full end-to-end advisory pipeline for a mutual fund investor.

## Input

The pipeline needs a `parsed.json` file containing the user's `MFDetailedStatementData`. By default it looks at `./parsed.json` in the project root.

If the user provides a path as `$ARGUMENTS`, copy or symlink that file to `parsed.json` first:

```
If $ARGUMENTS is not empty:
  1. Verify the file exists at the given path
  2. Copy it to ./parsed.json (overwrite if exists)
```

## Steps

1. **Verify prerequisites**: Ensure `parsed.json` exists in the project root. If not, tell the user to provide one or run the CAMS parser first.

2. **Run the advisory script**:
   ```bash
   npx ts-node -r tsconfig-paths/register src/scripts/run-advisory.ts
   ```

3. **Verify outputs**: After the script completes, confirm:
   - `dashboard-data.json` was generated and contains `peerPercentile`, `shadowIndex`, `fiCountdown` fields (no NaN values)
   - Data was embedded into `dashboard.html`

4. **Print a summary** of key results:
   - Investor name and PAN
   - Portfolio value, XIRR, unrealised gain
   - Fitness Score (composite + 4 dimensions)
   - Peer Percentile (overall + personality)
   - Shadow Index (alpha amount)
   - FI Countdown (progress %, years to FI)
   - Number of ready insights and actionables

5. **Open the dashboard** (macOS):
   ```bash
   open dashboard.html
   ```

## Error Handling

- If `parsed.json` is missing, tell the user: "No parsed.json found. Either provide a path (`/run-advisory /path/to/file.json`) or run the CAMS parser first."
- If the script fails, show the error output and suggest checking MongoDB connectivity (`config.db.uri`).
- If TypeScript compilation errors occur, run `npx tsc --noEmit 2>&1 | head -20` to diagnose.
