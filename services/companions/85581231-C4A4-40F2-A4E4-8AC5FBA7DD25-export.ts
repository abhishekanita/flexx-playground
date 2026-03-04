/* eslint-disable no-console */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

const CONFIG = {
  loginUrl:
    "https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/User/Login",
  consentUrl:
    "https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/ConsentRequestPlus",
  fiRequestUrl:
    "https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/FIRequest",
  channelId: "fiulive@fintralease",
  userId: "channel@fintralease",
  password: "27dba773fc7f43e899a3a8faf9af4bdf",
  aaId: "cookiejaraalive@finvu",
  templateName: "BANK_STATEMENT_ONETIME",
  redirectUrl:
    "https://app.credflow.in/account-aggregation/status?orgId=1244&rm_token=token",
  consentDescription: "Consent for Account Aggregation",
  userSessionId: 123,
  pollSeconds: 3,
  maxPolls: 40,
} as const;

type OutputFormat = "json" | "xml" | "pdf";

interface Args {
  mobile: string;
  from?: string;
  to?: string;
  daysBack: number;
  format: OutputFormat;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mobile: "9810254998",
    daysBack: 182,
    format: "json",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--mobile" && val) {
      args.mobile = val;
      i += 1;
    } else if (key === "--from" && val) {
      args.from = val;
      i += 1;
    } else if (key === "--to" && val) {
      args.to = val;
      i += 1;
    } else if (key === "--days-back" && val) {
      args.daysBack = Number(val);
      i += 1;
    } else if (key === "--format" && val) {
      if (val !== "json" && val !== "xml" && val !== "pdf") {
        throw new Error("--format must be one of: json | xml | pdf");
      }
      args.format = val;
      i += 1;
    } else if (key === "--out" && val) {
      args.out = val;
      i += 1;
    } else if (key === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
Usage:
  npx tsx finvu_bank_statement_flow.ts [options]

Options:
  --mobile <10digit>       Mobile number (default: 9810254998)
  --days-back <n>          Lookback days from today (default: 182)
  --from <YYYY-MM-DD>      Custom from date (overrides --days-back)
  --to <YYYY-MM-DD>        Custom to date (default: today if --from is set)
  --format <json|xml|pdf>  FIDataFetch output format (default: json)
  --out <filepath>         Output file path
  --help                   Show help
`);
}

function isoNow(): string {
  return new Date().toISOString();
}

function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveDateRange(args: Args): {
  from: string;
  to: string;
  fromApi: string;
  toApi: string;
} {
  let from = args.from;
  let to = args.to;

  if (!from) {
    const d = new Date();
    d.setDate(d.getDate() - args.daysBack);
    from = ymd(d);
  }
  if (!to) {
    to = ymd(new Date());
  }

  // API body expects +0530 timestamp style.
  return {
    from,
    to,
    fromApi: `${from}T00:00:00.000+0530`,
    toApi: `${to}T23:59:59.000+0530`,
  };
}

async function postJson<T = JsonValue>(
  url: string,
  token: string | null,
  body: JsonValue,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${url}: ${text}`);
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from ${url}: ${JSON.stringify(parsed)}`,
    );
  }
  return parsed as T;
}

async function getJson<T = JsonValue>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${url}: ${text}`);
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from ${url}: ${JSON.stringify(parsed)}`,
    );
  }
  return parsed as T;
}

function reqHeader() {
  return { rid: randomUUID(), ts: isoNow(), channelId: CONFIG.channelId };
}

function mustString(obj: unknown, path: string[]): string {
  let cur: unknown = obj;
  for (const p of path) {
    if (!cur || typeof cur !== "object" || !(p in cur)) {
      throw new Error(`Missing response field: ${path.join(".")}`);
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== "string" || cur.length === 0) {
    throw new Error(`Invalid response field: ${path.join(".")}`);
  }
  return cur;
}

async function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input, output });
  await rl.question(prompt);
  rl.close();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dates = resolveDateRange(args);
  const custId = `${args.mobile}@finvu`;

  console.log(`Starting flow for ${custId}`);
  console.log(`Range: ${dates.fromApi} -> ${dates.toApi}`);

  // 1) Login
  const loginResp = await postJson<Record<string, unknown>>(
    CONFIG.loginUrl,
    null,
    {
      header: reqHeader(),
      body: {
        userId: CONFIG.userId,
        password: CONFIG.password,
      },
    },
  );
  const token = mustString(loginResp, ["body", "token"]);
  console.log("Login successful.");

  // 2) Consent request
  const consentResp = await postJson<Record<string, unknown>>(
    CONFIG.consentUrl,
    token,
    {
      header: reqHeader(),
      body: {
        custId,
        consentDescription: CONFIG.consentDescription,
        templateName: CONFIG.templateName,
        userSessionId: CONFIG.userSessionId,
        redirectUrl: CONFIG.redirectUrl,
        fip: [""],
        ConsentDetails: {},
        aaId: CONFIG.aaId,
      },
    },
  );

  const consentHandle = mustString(consentResp, ["body", "ConsentHandle"]);
  const onboardingUrl = mustString(consentResp, ["body", "url"]);

  console.log(`consentHandleId: ${consentHandle}`);
  console.log("Open this URL and complete OTP/approval:");
  console.log(onboardingUrl);
  await waitForEnter("Press Enter after approval is completed...");

  // 3) Poll consent status
  let consentId = "";
  for (let i = 1; i <= CONFIG.maxPolls; i += 1) {
    const statusUrl = `https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/ConsentStatus/${encodeURIComponent(consentHandle)}/${encodeURIComponent(custId)}`;
    const statusResp = await getJson<Record<string, unknown>>(statusUrl, token);
    const body = (statusResp.body ?? {}) as Record<string, unknown>;
    const status =
      typeof body.consentStatus === "string" ? body.consentStatus : "";
    const cid = typeof body.consentId === "string" ? body.consentId : "";
    console.log(
      `Consent poll ${i}/${CONFIG.maxPolls}: status=${status} consentId=${cid || "null"}`,
    );
    if (status === "ACCEPTED" && cid) {
      consentId = cid;
      break;
    }
    await new Promise((r) => setTimeout(r, CONFIG.pollSeconds * 1000));
  }
  if (!consentId) {
    throw new Error("Consent not accepted within polling window.");
  }

  // 4) FIRequest
  const fiReqResp = await postJson<Record<string, unknown>>(
    CONFIG.fiRequestUrl,
    token,
    {
      header: reqHeader(),
      body: {
        custId,
        consentHandleId: consentHandle,
        consentId,
        dateTimeRangeFrom: dates.fromApi,
        dateTimeRangeTo: dates.toApi,
      },
    },
  );
  const sessionId = mustString(fiReqResp, ["body", "sessionId"]);
  console.log(`sessionId: ${sessionId}`);

  // 5) Poll FIStatus
  let fiReady = false;
  for (let i = 1; i <= CONFIG.maxPolls; i += 1) {
    const fiStatusUrl = `https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/FIStatus/${encodeURIComponent(consentId)}/${encodeURIComponent(sessionId)}/${encodeURIComponent(consentHandle)}/${encodeURIComponent(custId)}`;
    const fiStatusResp = await getJson<Record<string, unknown>>(
      fiStatusUrl,
      token,
    );
    const status =
      typeof (fiStatusResp.body as Record<string, unknown> | undefined)
        ?.fiRequestStatus === "string"
        ? ((fiStatusResp.body as Record<string, unknown>)
            .fiRequestStatus as string)
        : "";
    console.log(`FI poll ${i}/${CONFIG.maxPolls}: ${status || "UNKNOWN"}`);
    if (status === "READY") {
      fiReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, CONFIG.pollSeconds * 1000));
  }
  if (!fiReady) {
    throw new Error("FI data not ready within polling window.");
  }

  // 6) FIDataFetch
  const accept =
    args.format === "json"
      ? "application/json"
      : args.format === "xml"
        ? "application/xml"
        : "application/pdf";
  const ext = args.format;
  const outFile =
    args.out ?? `finvu_${args.mobile}_${dates.from}_to_${dates.to}.${ext}`;
  const fetchUrl = `https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/FIDataFetch/${encodeURIComponent(consentHandle)}/${encodeURIComponent(sessionId)}`;

  const fetchResp = await fetch(fetchUrl, {
    method: "GET",
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!fetchResp.ok) {
    const msg = await fetchResp.text();
    throw new Error(`FIDataFetch failed: HTTP ${fetchResp.status} ${msg}`);
  }

  if (args.format === "json") {
    const json = await fetchResp.json();
    await writeFile(outFile, JSON.stringify(json, null, 2), "utf8");
    const bodyCount = Array.isArray((json as Record<string, unknown>).body)
      ? ((json as Record<string, unknown>).body as unknown[]).length
      : 0;
    console.log(`Saved JSON: ${outFile} (body_count=${bodyCount})`);
  } else {
    const ab = await fetchResp.arrayBuffer();
    await writeFile(outFile, Buffer.from(ab));
    console.log(`Saved ${args.format.toUpperCase()}: ${outFile}`);
  }

  console.log("Flow complete.");
  console.log(`consentHandleId: ${consentHandle}`);
  console.log(`consentId: ${consentId}`);
  console.log(`sessionId: ${sessionId}`);
}

main().catch((err: unknown) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
