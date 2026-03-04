import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import TurndownService from 'turndown';

// ── Config ──────────────────────────────────────────────────────────────────
dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const MODEL_ID = 'gpt-4.1-mini';

const userCreds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
const turndown = new TurndownService();

// ── Cost Tracking ───────────────────────────────────────────────────────────
// gpt-4.1-mini pricing per 1M tokens (USD)
const PRICING = { input: 0.8, output: 3.2 };

interface CostEntry {
    label: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
}

const costLog: CostEntry[] = [];

function trackCost(label: string, usage: any) {
    const inputTokens = usage?.inputTokens ?? usage?.promptTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? usage?.completionTokens ?? 0;
    const cost = (inputTokens / 1_000_000) * PRICING.input +
                 (outputTokens / 1_000_000) * PRICING.output;
    costLog.push({ label, inputTokens, outputTokens, cost });
    return cost;
}

function fmtCost(usd: number): string {
    if (usd < 0.01) return `$${usd.toFixed(6)}`;
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

// ── Target Senders ──────────────────────────────────────────────────────────
const TARGET_SENDERS = [
    {
        id: 'swiggy',
        name: 'Swiggy',
        query: 'from:swiggy.in subject:delivered',
        category: 'food_dining',
        maxEmails: 15,
    },
    {
        id: 'uber',
        name: 'Uber',
        query: 'from:uber.com subject:"trip with Uber"',
        category: 'transport',
        maxEmails: 15,
    },
    {
        id: 'apple',
        name: 'Apple',
        query: 'from:apple.com subject:invoice',
        category: 'subscription',
        maxEmails: 10,
    },
];

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const fieldRuleSchema = z.object({
    selector: z.string().describe('CSS selector to find the HTML element'),
    regex: z.string().nullable().describe('Regex with capture group to extract value from element text. null if no regex needed.'),
    transform: z.enum(['currency', 'number', 'date', 'string']).describe('How to parse the extracted text'),
});

const templateSchema = z.object({
    merchantName: z.string().describe('Normalized merchant name (e.g. "Swiggy" not "Bundl Technologies")'),
    rules: z.object({
        date: fieldRuleSchema.describe('Extracts the order/transaction date'),
        amount: fieldRuleSchema.describe('Extracts the total amount in INR'),
        orderId: fieldRuleSchema.nullable().describe('Extracts the order or transaction ID. null if not available.'),
        paymentMethod: fieldRuleSchema.nullable().describe('Extracts the payment method used. null if not available.'),
    }),
    lineItems: z.object({
        containerSelector: z.string().describe('CSS selector for the container holding all line items'),
        itemSelector: z.string().describe('CSS selector for each individual line item, relative to container'),
        nameRule: z.object({
            selector: z.string(),
            regex: z.string().nullable(),
        }).describe('Rule to extract item name from each line item'),
        priceRule: z.object({
            selector: z.string(),
            regex: z.string().nullable(),
        }).describe('Rule to extract item price from each line item'),
        quantityRule: z.object({
            selector: z.string(),
            regex: z.string().nullable(),
        }).nullable().describe('Rule to extract item quantity. null if not applicable.'),
    }).nullable().describe('Rules for extracting itemized line items (food orders, products, etc). null if no line items.'),
});

const directExtractionSchema = z.object({
    date: z.string().describe('Transaction date in YYYY-MM-DD format'),
    amount: z.number().describe('Total amount in INR'),
    merchantName: z.string(),
    orderId: z.string().nullable(),
    paymentMethod: z.string().nullable(),
    lineItems: z.array(z.object({
        name: z.string(),
        quantity: z.number().nullable(),
        price: z.number(),
    })).nullable().describe('Individual items if this is an itemized receipt. null if not applicable.'),
});

type ExtractionTemplate = z.infer<typeof templateSchema>;
type DirectExtraction = z.infer<typeof directExtractionSchema>;

// ── Gmail Auth ──────────────────────────────────────────────────────────────

async function getGmailService() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!,
    );
    oauth2Client.setCredentials({
        access_token: userCreds.accessToken,
        refresh_token: userCreds.refreshToken,
    });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        console.log('  Token refreshed');
    } catch (err: any) {
        console.log('  Token refresh failed, using existing...', err.message);
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
}

// ── HTML Extraction ─────────────────────────────────────────────────────────

function extractHtmlFromPayload(payload: any): string {
    if (payload.mimeType === 'text/html' && payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            const html = extractHtmlFromPayload(part);
            if (html) return html;
        }
    }
    return '';
}

function getHeaders(payload: any): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const h of payload.headers || []) {
        headers[h.name.toLowerCase()] = h.value;
    }
    return headers;
}

// ── Fetch Emails ────────────────────────────────────────────────────────────

interface FetchedEmail {
    id: string;
    subject: string;
    from: string;
    date: string;
    html: string;
}

async function fetchEmails(gmail: any, query: string, maxResults: number): Promise<FetchedEmail[]> {
    const listRes = await gmail.users.messages.list({
        userId: 'me', q: query, maxResults,
    });

    const messages = listRes.data.messages || [];
    const emails: FetchedEmail[] = [];

    for (const msg of messages) {
        try {
            const detail = await gmail.users.messages.get({
                userId: 'me', id: msg.id, format: 'full',
            });
            const headers = getHeaders(detail.data.payload);
            const html = extractHtmlFromPayload(detail.data.payload);

            if (!html || html.length < 100) continue; // Skip non-HTML emails

            emails.push({
                id: msg.id,
                subject: headers['subject'] || '',
                from: headers['from'] || '',
                date: headers['date'] || '',
                html,
            });
        } catch (err: any) {
            console.log(`    Skip message ${msg.id}: ${err.message}`);
        }
    }

    return emails;
}

// ── Template Generation (LLM) ──────────────────────────────────────────────

async function generateTemplate(senderName: string, category: string, sampleHtml: string): Promise<{
    template: ExtractionTemplate;
    usage: { promptTokens: number; completionTokens: number };
    durationMs: number;
}> {
    // Cap HTML at 100K to avoid token explosion
    const html = sampleHtml.length > 100_000 ? sampleHtml.substring(0, 100_000) : sampleHtml;

    const start = Date.now();
    const result = await generateObject({
        model: openai(MODEL_ID),
        schema: templateSchema,
        system: `You are a data extraction engineer building reusable templates for financial emails.
Your task: Generate CSS selector-based extraction rules that work on ANY email from this sender, not just this specific one.

CRITICAL RULES:
1. Use class-based selectors (e.g. ".total-amount") when available
2. If no classes, use tag + attribute combinations (e.g. "td[style*='bold']", "span.price")
3. For the amount field: extract the FINAL TOTAL the customer paid (including taxes, fees, etc.), NOT the subtotal
4. For amounts like "₹599.00" or "Rs. 1,234.50", provide a regex capture group: "₹\\s?([\\d,]+\\.?\\d*)"
5. AVOID positional selectors like ":nth-child(3)" — they break across emails with different content
6. For dates, provide a regex that captures the full date string (e.g. "28 Feb 2026" or "2026-02-28")
7. Think about what changes between emails (order ID, items, amounts) vs what stays the same (layout, classes)
8. Test mentally: would these selectors still work if the order had different items or a different total?`,
        prompt: `Generate extraction rules for emails from "${senderName}" (${category} category).

Here is a sample HTML email:

${html}`,
    });

    return {
        template: result.object,
        usage: result.usage as any,
        durationMs: Date.now() - start,
    };
}

// ── Template Application (Cheerio) ──────────────────────────────────────────

interface TemplateResult {
    date: string | null;
    amount: number | null;
    orderId: string | null;
    paymentMethod: string | null;
    lineItems: { name: string; quantity?: number; price: number }[];
    fieldsExtracted: number;
    fieldsFailed: number;
}

function applyTemplate(html: string, template: ExtractionTemplate): TemplateResult {
    const $ = cheerio.load(html);
    const result: TemplateResult = {
        date: null,
        amount: null,
        orderId: null,
        paymentMethod: null,
        lineItems: [],
        fieldsExtracted: 0,
        fieldsFailed: 0,
    };

    // Extract each field using its rule
    const fieldMap: Record<string, keyof ExtractionTemplate['rules']> = {
        date: 'date',
        amount: 'amount',
        orderId: 'orderId',
        paymentMethod: 'paymentMethod',
    };

    for (const [resultField, ruleKey] of Object.entries(fieldMap)) {
        const rule = template.rules[ruleKey];
        if (!rule) continue;

        try {
            const elements = $(rule.selector);
            if (elements.length === 0) {
                result.fieldsFailed++;
                continue;
            }

            let text = elements.first().text().trim();

            if (rule.regex) {
                const match = text.match(new RegExp(rule.regex));
                if (match) text = match[1] || match[0];
            }

            if (!text) {
                result.fieldsFailed++;
                continue;
            }

            switch (rule.transform) {
                case 'currency':
                    (result as any)[resultField] = parseFloat(text.replace(/[₹,\s]/g, ''));
                    break;
                case 'number':
                    (result as any)[resultField] = parseInt(text.replace(/,/g, ''), 10);
                    break;
                default:
                    (result as any)[resultField] = text;
            }
            result.fieldsExtracted++;
        } catch {
            result.fieldsFailed++;
        }
    }

    // Line items
    if (template.lineItems) {
        try {
            const container = $(template.lineItems.containerSelector);
            container.find(template.lineItems.itemSelector).each((_, el) => {
                const item: any = {};

                // Name
                try {
                    let nameText = $(el).find(template.lineItems!.nameRule.selector).text().trim();
                    if (template.lineItems!.nameRule.regex) {
                        const m = nameText.match(new RegExp(template.lineItems!.nameRule.regex));
                        if (m) nameText = m[1] || m[0];
                    }
                    if (nameText) item.name = nameText;
                } catch {}

                // Price
                try {
                    let priceText = $(el).find(template.lineItems!.priceRule.selector).text().trim();
                    if (template.lineItems!.priceRule.regex) {
                        const m = priceText.match(new RegExp(template.lineItems!.priceRule.regex));
                        if (m) priceText = m[1] || m[0];
                    }
                    if (priceText) item.price = parseFloat(priceText.replace(/[₹,\s]/g, ''));
                } catch {}

                // Quantity
                if (template.lineItems!.quantityRule) {
                    try {
                        let qtyText = $(el).find(template.lineItems!.quantityRule.selector).text().trim();
                        if (template.lineItems!.quantityRule.regex) {
                            const m = qtyText.match(new RegExp(template.lineItems!.quantityRule.regex));
                            if (m) qtyText = m[1] || m[0];
                        }
                        if (qtyText) item.quantity = parseInt(qtyText, 10);
                    } catch {}
                }

                if (item.name || item.price) result.lineItems.push(item);
            });
        } catch {}
    }

    return result;
}

// ── Direct LLM Extraction ───────────────────────────────────────────────────

async function directExtract(senderName: string, html: string, emailDate: string): Promise<{
    data: DirectExtraction;
    usage: { promptTokens: number; completionTokens: number };
    durationMs: number;
}> {
    // Convert to markdown to save tokens
    let markdown: string;
    try {
        markdown = turndown.turndown(html);
    } catch {
        // Fallback: strip HTML tags
        markdown = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 20000);
    }

    // Cap at ~20K chars to keep costs reasonable
    if (markdown.length > 20000) markdown = markdown.substring(0, 20000);

    const start = Date.now();
    const result = await generateObject({
        model: openai(MODEL_ID),
        schema: directExtractionSchema,
        system: 'You are a financial data extraction expert. Extract structured financial data from email receipts and notifications. For dates use YYYY-MM-DD format. For amounts use numeric values in INR (the final total including taxes).',
        prompt: `Extract financial data from this email from ${senderName}.\nEmail was sent on: ${emailDate}\n\n${markdown}`,
    });

    return {
        data: result.object,
        usage: result.usage as any,
        durationMs: Date.now() - start,
    };
}

// ── Comparison ──────────────────────────────────────────────────────────────

interface ComparisonResult {
    emailId: string;
    subject: string;
    templateResult: TemplateResult;
    directResult: DirectExtraction;
    matches: {
        date: boolean;
        amount: boolean;
        orderId: boolean;
        lineItemCount: boolean;
    };
    templateApplyMs: number;
    directExtractMs: number;
    directExtractCost: number;
}

function compareResults(
    templateResult: TemplateResult,
    directResult: DirectExtraction,
): { date: boolean; amount: boolean; orderId: boolean; lineItemCount: boolean } {
    // Date: compare month+day (year is often wrong from LLM or missing from template)
    const tDate = templateResult.date ? parseMonthDay(templateResult.date) : null;
    const dDate = directResult.date ? parseMonthDay(directResult.date) : null;
    const dateMatch = !!(tDate && dDate && tDate.month === dDate.month && tDate.day === dDate.day);

    // Amount: within 5% tolerance (pre-tax vs post-tax differences, rounding)
    const amountMatch = !!(templateResult.amount && directResult.amount &&
        Math.abs(templateResult.amount - directResult.amount) / directResult.amount < 0.05);

    // Order ID: substring match (template might capture extra text, ignore dashes/spaces)
    const tOrderId = (templateResult.orderId || '').replace(/[\s-]/g, '');
    const dOrderId = (directResult.orderId || '').replace(/[\s-]/g, '');
    const orderIdMatch = (!tOrderId && !dOrderId) ||
        !!(tOrderId && dOrderId && (tOrderId.includes(dOrderId) || dOrderId.includes(tOrderId)));

    // Line items: both found some, or both found none
    const templateLineCount = templateResult.lineItems.length;
    const directLineCount = directResult.lineItems?.length || 0;
    const lineItemCount = (templateLineCount === 0 && directLineCount === 0) ||
        (templateLineCount > 0 && directLineCount > 0);

    return { date: dateMatch, amount: amountMatch, orderId: orderIdMatch, lineItemCount };
}

const MONTH_MAP: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function parseMonthDay(s: string): { month: number; day: number } | null {
    if (!s) return null;

    // "2026-02-28" or "2024-02-27"
    const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return { month: parseInt(isoMatch[2]), day: parseInt(isoMatch[3]) };

    // "Feb 20, 2026" or "Feb 27, 8:13 PM" or "February 28, 2026"
    const mdy = s.match(/([A-Za-z]+)\s+(\d{1,2})/);
    if (mdy) {
        const month = MONTH_MAP[mdy[1].toLowerCase()];
        if (month) return { month, day: parseInt(mdy[2]) };
    }

    // "28 Feb 2026" or "28 February"
    const dmy = s.match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (dmy) {
        const month = MONTH_MAP[dmy[2].toLowerCase()];
        if (month) return { month, day: parseInt(dmy[1]) };
    }

    // "28/02/2026" or "02/28/2026"
    const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) return { month: parseInt(slashMatch[2]), day: parseInt(slashMatch[1]) };

    try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return { month: d.getMonth() + 1, day: d.getDate() };
    } catch {}

    return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║     EXPERIMENT 1: LLM Template Generation — "Learn Once, Parse Forever"║
╚══════════════════════════════════════════════════════════════════════════╝
`);

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

    const gmail = await getGmailService();

    const allResults: {
        senderId: string;
        senderName: string;
        emailsFetched: number;
        template: ExtractionTemplate | null;
        templateGenCost: number;
        templateGenMs: number;
        comparisons: ComparisonResult[];
        accuracy: { date: number; amount: number; orderId: number; lineItems: number; overall: number };
        totalDirectCost: number;
    }[] = [];

    for (const sender of TARGET_SENDERS) {
        console.log(`\n┌──────────────────────────────────────────────────────────────────────┐`);
        console.log(`│  ${sender.name.toUpperCase()} (${sender.id})`.padEnd(71) + '│');
        console.log(`└──────────────────────────────────────────────────────────────────────┘`);
        console.log(`  Query: ${sender.query}`);

        // ── Step 1: Fetch emails ──
        console.log(`\n  Fetching emails...`);
        const emails = await fetchEmails(gmail, sender.query, sender.maxEmails);
        console.log(`  Found ${emails.length} HTML emails`);

        if (emails.length < 2) {
            console.log(`  Need at least 2 emails (1 sample + 1 test). Skipping.`);
            allResults.push({
                senderId: sender.id,
                senderName: sender.name,
                emailsFetched: emails.length,
                template: null,
                templateGenCost: 0,
                templateGenMs: 0,
                comparisons: [],
                accuracy: { date: 0, amount: 0, orderId: 0, lineItems: 0, overall: 0 },
                totalDirectCost: 0,
            });
            continue;
        }

        // Show what we got
        for (const email of emails) {
            console.log(`    ${email.subject.substring(0, 60).padEnd(60)}  ${email.date.substring(0, 16)}`);
        }

        // ── Step 2: Generate template from first email ──
        const sampleEmail = emails[0];
        console.log(`\n  Generating template from sample: "${sampleEmail.subject.substring(0, 50)}..."`);
        console.log(`  Sample HTML size: ${(sampleEmail.html.length / 1024).toFixed(1)} KB`);

        let template: ExtractionTemplate;
        let templateGenCost = 0;
        let templateGenMs = 0;

        try {
            const genResult = await generateTemplate(sender.name, sender.category, sampleEmail.html);
            template = genResult.template;
            templateGenMs = genResult.durationMs;
            templateGenCost = trackCost(`${sender.id}/template-gen`, genResult.usage);

            console.log(`  Template generated in ${(templateGenMs / 1000).toFixed(1)}s (${fmtCost(templateGenCost)})`);
            console.log(`  Merchant: ${template.merchantName}`);
            console.log(`  Fields: ${Object.keys(template.rules).filter(k => (template.rules as any)[k]).length}`);
            console.log(`  Line items: ${template.lineItems ? 'Yes' : 'No'}`);

            // Log the template rules for inspection
            for (const [field, rule] of Object.entries(template.rules)) {
                if (!rule) continue;
                console.log(`    ${field}: selector="${rule.selector}" regex=${rule.regex || 'none'} transform=${rule.transform}`);
            }
        } catch (err: any) {
            console.log(`  Template generation FAILED: ${err.message}`);
            allResults.push({
                senderId: sender.id,
                senderName: sender.name,
                emailsFetched: emails.length,
                template: null,
                templateGenCost: 0,
                templateGenMs: 0,
                comparisons: [],
                accuracy: { date: 0, amount: 0, orderId: 0, lineItems: 0, overall: 0 },
                totalDirectCost: 0,
            });
            continue;
        }

        // ── Step 3: Apply template + direct extract on remaining emails ──
        const testEmails = emails.slice(1); // All except sample
        console.log(`\n  Testing template on ${testEmails.length} emails...`);
        console.log(`  ${'Email'.padEnd(45)} ${'Template'.padEnd(12)} ${'Direct'.padEnd(12)} ${'Match'.padEnd(20)}`);
        console.log(`  ${'─'.repeat(90)}`);

        const comparisons: ComparisonResult[] = [];
        let totalDirectCost = 0;

        for (const email of testEmails) {
            // Apply template (zero LLM cost)
            const templateStart = Date.now();
            const templateResult = applyTemplate(email.html, template);
            const templateApplyMs = Date.now() - templateStart;

            // Direct LLM extraction (for ground truth)
            let directResult: DirectExtraction;
            let directMs = 0;
            let directCost = 0;

            try {
                const directRes = await directExtract(sender.name, email.html, email.date);
                directResult = directRes.data;
                directMs = directRes.durationMs;
                directCost = trackCost(`${sender.id}/direct/${email.id.substring(0, 8)}`, directRes.usage);
                totalDirectCost += directCost;
            } catch (err: any) {
                console.log(`    ${email.subject.substring(0, 45).padEnd(45)} ${'-'.padEnd(12)} FAILED       ${err.message}`);
                continue;
            }

            // Compare
            const matches = compareResults(templateResult, directResult);
            const matchCount = [matches.date, matches.amount, matches.orderId, matches.lineItemCount]
                .filter(Boolean).length;

            comparisons.push({
                emailId: email.id,
                subject: email.subject,
                templateResult,
                directResult,
                matches,
                templateApplyMs,
                directExtractMs: directMs,
                directExtractCost: directCost,
            });

            const tAmt = templateResult.amount ? `₹${templateResult.amount}` : '-';
            const dAmt = directResult.amount ? `₹${directResult.amount}` : '-';
            const matchStr = `${matchCount}/4 (${matches.date ? 'D' : '-'}${matches.amount ? 'A' : '-'}${matches.orderId ? 'O' : '-'}${matches.lineItemCount ? 'L' : '-'})`;

            console.log(`  ${email.subject.substring(0, 45).padEnd(45)} ${tAmt.padEnd(12)} ${dAmt.padEnd(12)} ${matchStr}`);

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }

        // ── Accuracy summary for this sender ──
        const n = comparisons.length;
        const accuracy = {
            date: n > 0 ? comparisons.filter(c => c.matches.date).length / n : 0,
            amount: n > 0 ? comparisons.filter(c => c.matches.amount).length / n : 0,
            orderId: n > 0 ? comparisons.filter(c => c.matches.orderId).length / n : 0,
            lineItems: n > 0 ? comparisons.filter(c => c.matches.lineItemCount).length / n : 0,
            overall: 0,
        };
        accuracy.overall = (accuracy.date + accuracy.amount + accuracy.orderId + accuracy.lineItems) / 4;

        console.log(`\n  Accuracy for ${sender.name}:`);
        console.log(`    Date:       ${(accuracy.date * 100).toFixed(0)}%  (${comparisons.filter(c => c.matches.date).length}/${n})`);
        console.log(`    Amount:     ${(accuracy.amount * 100).toFixed(0)}%  (${comparisons.filter(c => c.matches.amount).length}/${n})`);
        console.log(`    Order ID:   ${(accuracy.orderId * 100).toFixed(0)}%  (${comparisons.filter(c => c.matches.orderId).length}/${n})`);
        console.log(`    Line Items: ${(accuracy.lineItems * 100).toFixed(0)}%  (${comparisons.filter(c => c.matches.lineItemCount).length}/${n})`);
        console.log(`    Overall:    ${(accuracy.overall * 100).toFixed(0)}%`);
        console.log(`\n  Cost comparison:`);
        console.log(`    Template gen (one-time):     ${fmtCost(templateGenCost)}`);
        console.log(`    Template apply (${n} emails): ${fmtCost(0)} (zero LLM cost)`);
        console.log(`    Direct extraction (${n} emails): ${fmtCost(totalDirectCost)}`);
        console.log(`    Savings: ${fmtCost(totalDirectCost)} saved per ${n} emails`);

        const avgTemplateMs = comparisons.reduce((s, c) => s + c.templateApplyMs, 0) / Math.max(n, 1);
        const avgDirectMs = comparisons.reduce((s, c) => s + c.directExtractMs, 0) / Math.max(n, 1);
        console.log(`\n  Speed comparison:`);
        console.log(`    Template apply avg: ${avgTemplateMs.toFixed(0)}ms`);
        console.log(`    Direct extract avg: ${avgDirectMs.toFixed(0)}ms`);
        console.log(`    Speedup: ${(avgDirectMs / Math.max(avgTemplateMs, 1)).toFixed(0)}x faster`);

        allResults.push({
            senderId: sender.id,
            senderName: sender.name,
            emailsFetched: emails.length,
            template,
            templateGenCost,
            templateGenMs,
            comparisons,
            accuracy,
            totalDirectCost,
        });
    }

    // ── Final Summary ───────────────────────────────────────────────────────
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                         FINAL SUMMARY                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

    const totalTemplateCost = allResults.reduce((s, r) => s + r.templateGenCost, 0);
    const totalDirectCost = allResults.reduce((s, r) => s + r.totalDirectCost, 0);
    const totalComparisons = allResults.reduce((s, r) => s + r.comparisons.length, 0);

    console.log(`  Senders tested: ${allResults.length}`);
    console.log(`  Emails processed: ${allResults.reduce((s, r) => s + r.emailsFetched, 0)}`);
    console.log(`  Comparisons made: ${totalComparisons}`);

    console.log(`\n  ${'Sender'.padEnd(15)} ${'Emails'.padStart(6)} ${'Accuracy'.padStart(10)} ${'TmplCost'.padStart(10)} ${'DirectCost'.padStart(12)} ${'Savings'.padStart(10)}`);
    console.log(`  ${'─'.repeat(70)}`);

    for (const r of allResults) {
        console.log(
            `  ${r.senderName.padEnd(15)} ${String(r.emailsFetched).padStart(6)} ` +
            `${(r.accuracy.overall * 100).toFixed(0).padStart(8)}% ` +
            `${fmtCost(r.templateGenCost).padStart(10)} ` +
            `${fmtCost(r.totalDirectCost).padStart(12)} ` +
            `${fmtCost(r.totalDirectCost).padStart(10)}`,
        );
    }

    console.log(`\n  Total template gen cost (one-time): ${fmtCost(totalTemplateCost)}`);
    console.log(`  Total direct extraction cost:       ${fmtCost(totalDirectCost)}`);
    console.log(`  Template approach saves:            ${fmtCost(totalDirectCost)} per ${totalComparisons} emails`);

    // At-scale projection
    if (totalComparisons > 0) {
        const avgDirectPerEmail = totalDirectCost / totalComparisons;
        const monthlyEmails200 = 200; // emails per user per month
        const users100K = 100_000;
        const monthlyDirectCost = avgDirectPerEmail * monthlyEmails200 * users100K;
        const monthlyTemplateCost = totalTemplateCost; // templates are reused across users

        console.log(`\n  Scale projection (200 emails/user, 100K users):`);
        console.log(`    LLM-per-email approach: ${fmtCost(monthlyDirectCost)}/month`);
        console.log(`    Template approach:      ${fmtCost(monthlyTemplateCost)} (one-time) + $0/month steady-state`);
    }

    // ── Detailed Cost Log ────────────────────────────────────────────────────
    console.log(`\n  Detailed cost log:`);
    for (const entry of costLog) {
        console.log(`    ${entry.label.padEnd(40)} in:${entry.inputTokens} out:${entry.outputTokens} cost:${fmtCost(entry.cost)}`);
    }

    // ── Save Results ────────────────────────────────────────────────────────
    const outputPath = path.join(DOWNLOADS_DIR, 'experiment-template-gen-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
    console.log(`\n  Results saved: ${outputPath}`);
}

main().catch(console.error);
