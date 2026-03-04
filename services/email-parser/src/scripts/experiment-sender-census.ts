import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ── Config ──────────────────────────────────────────────────────────────────
dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const userCreds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

// ── Known Financial Senders (domain → type) ─────────────────────────────────
const KNOWN_FINANCIAL_DOMAINS: Record<string, { type: string; name: string }> = {
    // Banks
    'sbi.co.in': { type: 'bank', name: 'SBI' },
    'sbi.bank.in': { type: 'bank', name: 'SBI' },
    'alerts.sbi': { type: 'bank', name: 'SBI' },
    'hdfcbank.net': { type: 'bank', name: 'HDFC Bank' },
    'hdfcbank.com': { type: 'bank', name: 'HDFC Bank' },
    'icicibank.com': { type: 'bank', name: 'ICICI Bank' },
    'kotak.com': { type: 'bank', name: 'Kotak' },
    'kotak.bank.in': { type: 'bank', name: 'Kotak' },
    'axisbank.com': { type: 'bank', name: 'Axis Bank' },
    'yesbank.in': { type: 'bank', name: 'Yes Bank' },
    'indusind.com': { type: 'bank', name: 'IndusInd' },
    'federalbank.co.in': { type: 'bank', name: 'Federal Bank' },

    // Credit Cards
    'hdfcbankcc': { type: 'credit_card', name: 'HDFC CC' },

    // Payments / UPI
    'paytm.com': { type: 'payment', name: 'Paytm' },
    'phonepe.com': { type: 'payment', name: 'PhonePe' },
    'googlepay': { type: 'payment', name: 'Google Pay' },
    'razorpay.com': { type: 'payment', name: 'Razorpay' },

    // Food & Dining
    'swiggy.in': { type: 'food', name: 'Swiggy' },
    'zomato.com': { type: 'food', name: 'Zomato' },
    'dunzo.com': { type: 'food', name: 'Dunzo' },

    // Groceries
    'bfrn.in': { type: 'grocery', name: 'Blinkit' },
    'blinkit.com': { type: 'grocery', name: 'Blinkit' },
    'bigbasket.com': { type: 'grocery', name: 'BigBasket' },
    'zepto.co': { type: 'grocery', name: 'Zepto' },

    // Transport
    'uber.com': { type: 'transport', name: 'Uber' },
    'olacabs.com': { type: 'transport', name: 'Ola' },
    'rapido.bike': { type: 'transport', name: 'Rapido' },

    // Shopping
    'amazon.in': { type: 'shopping', name: 'Amazon' },
    'amazon.com': { type: 'shopping', name: 'Amazon' },
    'flipkart.com': { type: 'shopping', name: 'Flipkart' },
    'myntra.com': { type: 'shopping', name: 'Myntra' },
    'ajio.com': { type: 'shopping', name: 'Ajio' },
    'nykaa.com': { type: 'shopping', name: 'Nykaa' },
    'meesho.com': { type: 'shopping', name: 'Meesho' },

    // Subscriptions
    'apple.com': { type: 'subscription', name: 'Apple' },
    'netflix.com': { type: 'subscription', name: 'Netflix' },
    'spotify.com': { type: 'subscription', name: 'Spotify' },
    'youtube.com': { type: 'subscription', name: 'YouTube' },
    'hotstar.com': { type: 'subscription', name: 'Hotstar' },
    'disneyplus.com': { type: 'subscription', name: 'Disney+' },
    'primevideo.com': { type: 'subscription', name: 'Prime Video' },

    // Investments
    'groww.in': { type: 'investment', name: 'Groww' },
    'zerodha.com': { type: 'investment', name: 'Zerodha' },
    'camsonline.com': { type: 'investment', name: 'CAMS' },
    'kfintech.com': { type: 'investment', name: 'KFintech' },
    'nsdl.com': { type: 'investment', name: 'NSDL' },
    'cdslindia.com': { type: 'investment', name: 'CDSL' },
    'aboretum.in': { type: 'investment', name: 'Smallcase' },

    // Insurance
    'hdfclife.com': { type: 'insurance', name: 'HDFC Life' },
    'iciciprulife.com': { type: 'insurance', name: 'ICICI Pru' },
    'licindia.in': { type: 'insurance', name: 'LIC' },
    'maxlifeinsurance.com': { type: 'insurance', name: 'Max Life' },
    'acko.com': { type: 'insurance', name: 'Acko' },

    // Bills & Recharges
    'airtel.in': { type: 'bill', name: 'Airtel' },
    'jio.com': { type: 'bill', name: 'Jio' },
    'vodafone.in': { type: 'bill', name: 'Vodafone' },
    'tatapower.com': { type: 'bill', name: 'Tata Power' },
    'bsesdelhi.com': { type: 'bill', name: 'BSES' },

    // Travel
    'makemytrip.com': { type: 'travel', name: 'MakeMyTrip' },
    'goibibo.com': { type: 'travel', name: 'Goibibo' },
    'irctc.co.in': { type: 'travel', name: 'IRCTC' },
    'ixigo.com': { type: 'travel', name: 'Ixigo' },
    'cleartrip.com': { type: 'travel', name: 'Cleartrip' },
    'bookmyshow.com': { type: 'travel', name: 'BookMyShow' },

    // Services
    'urbancompany.com': { type: 'service', name: 'Urban Company' },

    // Tax
    'incometax.gov.in': { type: 'tax', name: 'Income Tax' },

    // Loans
    'bajajfinserv.in': { type: 'loan', name: 'Bajaj Finserv' },
};

// ── Financial Keywords (for subject-based detection) ────────────────────────
const FINANCIAL_KEYWORDS = [
    'payment', 'receipt', 'invoice', 'order', 'transaction',
    'statement', 'bill', 'recharge', 'subscription', 'renewal',
    'trip', 'ride', 'delivery', 'delivered', 'shipped',
    'refund', 'cashback', 'reward',
    'premium', 'emi', 'sip', 'investment', 'mutual fund', 'nav',
    'insurance', 'policy', 'claim',
    'debit', 'credit', 'transfer', 'upi', 'neft', 'imps',
    'amount', 'paid', '₹', 'rs.', 'rs ', 'inr',
    'booking', 'confirmation', 'booked',
    'salary', 'credited',
    'autopay', 'mandate', 'nach',
];

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

// ── Sender Analysis ─────────────────────────────────────────────────────────

interface SenderInfo {
    email: string;
    name: string;
    domain: string;
    count: number;
    subjects: string[];
    dates: string[];
    financialType: string | null;
    detectedBy: 'known_domain' | 'keyword' | 'none';
}

function extractSenderEmail(fromHeader: string): { email: string; name: string } {
    // "Swiggy <noreply@swiggy.in>" → email: "noreply@swiggy.in", name: "Swiggy"
    const match = fromHeader.match(/<?([^\s<>]+@[^\s<>]+)>?/);
    const email = match ? match[1].toLowerCase() : fromHeader.toLowerCase();

    const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*</);
    const name = nameMatch ? nameMatch[1].trim() : email.split('@')[0];

    return { email, name };
}

function extractDomain(email: string): string {
    return email.split('@').pop() || email;
}

function classifySender(domain: string, subjects: string[]): { type: string | null; detectedBy: 'known_domain' | 'keyword' | 'none' } {
    // Check known domains
    for (const [knownDomain, info] of Object.entries(KNOWN_FINANCIAL_DOMAINS)) {
        if (domain.includes(knownDomain) || knownDomain.includes(domain)) {
            return { type: info.type, detectedBy: 'known_domain' };
        }
    }

    // Check subject keywords
    const allSubjects = subjects.join(' ').toLowerCase();
    for (const keyword of FINANCIAL_KEYWORDS) {
        if (allSubjects.includes(keyword)) {
            return { type: 'detected_financial', detectedBy: 'keyword' };
        }
    }

    return { type: null, detectedBy: 'none' };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Count emails matching a Gmail query (uses resultSizeEstimate for speed) */
async function countEmails(gmail: any, query: string): Promise<number> {
    let count = 0;
    let pageToken: string | undefined;
    // Paginate to get exact count (resultSizeEstimate is unreliable)
    do {
        const res = await gmail.users.messages.list({
            userId: 'me', q: query, maxResults: 500, pageToken,
        });
        count += (res.data.messages || []).length;
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return count;
}

/** Fetch a sample email's subject for a given query */
async function fetchSampleSubjects(gmail: any, query: string, n: number): Promise<string[]> {
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: n });
    const subjects: string[] = [];
    for (const msg of (res.data.messages || []).slice(0, n)) {
        try {
            const detail = await gmail.users.messages.get({
                userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject'],
            });
            const subj = detail.data.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || '';
            subjects.push(subj);
        } catch {}
    }
    return subjects;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║       EXPERIMENT 2: Sender Discovery Census — "Who Sends Money Emails?"║
╚══════════════════════════════════════════════════════════════════════════╝
`);

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

    const gmail = await getGmailService();

    const senderMap = new Map<string, SenderInfo>();

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Count emails from known financial senders (fast — 1 query each)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  Phase 1: Counting emails from known financial senders...\n');

    // Build unique domain → query list
    const domainQueries: { domain: string; type: string; name: string; query: string }[] = [];
    const seenDomains = new Set<string>();
    for (const [domain, info] of Object.entries(KNOWN_FINANCIAL_DOMAINS)) {
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);
        domainQueries.push({
            domain,
            type: info.type,
            name: info.name,
            query: `from:${domain} newer_than:6m`,
        });
    }

    let knownTotal = 0;
    for (const dq of domainQueries) {
        try {
            const count = await countEmails(gmail, dq.query);
            if (count > 0) {
                const subjects = await fetchSampleSubjects(gmail, dq.query, 3);
                const email = `*@${dq.domain}`;
                senderMap.set(email, {
                    email,
                    name: dq.name,
                    domain: dq.domain,
                    count,
                    subjects,
                    dates: [],
                    financialType: dq.type,
                    detectedBy: 'known_domain',
                });
                knownTotal += count;
                console.log(`    ${dq.name.padEnd(20)} ${dq.domain.padEnd(30)} ${String(count).padStart(5)} emails`);
            }
        } catch {}
    }

    console.log(`\n  Phase 1 done: ${senderMap.size} known senders, ${knownTotal} emails\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Sample 500 recent emails to discover unknown financial senders
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  Phase 2: Sampling 500 recent emails for unknown sender discovery...\n');

    let totalSampled = 0;
    const discoveredSenders = new Map<string, SenderInfo>();
    let pageToken: string | undefined;

    // Fetch 5 pages of 100 messages each
    for (let page = 0; page < 5; page++) {
        const listRes = await gmail.users.messages.list({
            userId: 'me', q: 'newer_than:6m', maxResults: 100, pageToken,
        });
        const messages = listRes.data.messages || [];
        pageToken = listRes.data.nextPageToken || undefined;

        for (const msg of messages) {
            try {
                const detail = await gmail.users.messages.get({
                    userId: 'me', id: msg.id, format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date'],
                });
                const headers: Record<string, string> = {};
                for (const h of detail.data.payload?.headers || []) {
                    headers[h.name.toLowerCase()] = h.value;
                }

                const fromHeader = headers['from'] || '';
                const subject = headers['subject'] || '';
                const { email, name } = extractSenderEmail(fromHeader);
                const domain = extractDomain(email);

                // Skip if already covered by known domain check
                const isKnown = [...senderMap.values()].some(s => domain.includes(s.domain) || s.domain.includes(domain));
                if (isKnown) { totalSampled++; continue; }

                const existing = discoveredSenders.get(email) || {
                    email, name, domain, count: 0, subjects: [], dates: [],
                    financialType: null, detectedBy: 'none' as const,
                };
                existing.count++;
                if (existing.subjects.length < 5) existing.subjects.push(subject);
                discoveredSenders.set(email, existing);
                totalSampled++;
            } catch {}
        }

        process.stdout.write(`\r  Sampled ${totalSampled} emails, discovered ${discoveredSenders.size} additional senders`);
        if (!pageToken) break;
    }

    // Classify discovered senders
    for (const [, info] of discoveredSenders) {
        const { type, detectedBy } = classifySender(info.domain, info.subjects);
        info.financialType = type;
        info.detectedBy = detectedBy;
        senderMap.set(info.email, info);
    }

    // Get total email count estimate
    const totalEstimate = await gmail.users.messages.list({
        userId: 'me', q: 'newer_than:6m', maxResults: 1,
    });
    const totalMessages = totalEstimate.data.resultSizeEstimate || totalSampled;

    const allSenders = [...senderMap.values()];
    const financialSenders = allSenders.filter(s => s.financialType !== null);
    const nonFinancialSenders = allSenders.filter(s => s.financialType === null);

    console.log(`\n\n  Phase 2 done: ${discoveredSenders.size} additional senders found\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════════════════════════════════

    console.log('┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  1. OVERALL STATISTICS                                              │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    const totalFinancialEmails = financialSenders.reduce((s, x) => s + x.count, 0);

    console.log(`  Total emails (6 months est.): ~${totalMessages}`);
    console.log(`  Unique senders found:         ${allSenders.length}`);
    console.log(`  Financial senders:            ${financialSenders.length}`);
    console.log(`  Non-financial senders:        ${nonFinancialSenders.length}`);
    console.log(`  Financial email count:        ${totalFinancialEmails}`);

    // ── Financial senders by type ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  2. FINANCIAL SENDERS BY TYPE                                       │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    const byType = new Map<string, SenderInfo[]>();
    for (const s of financialSenders) {
        const type = s.financialType || 'unknown';
        const list = byType.get(type) || [];
        list.push(s);
        byType.set(type, list);
    }

    const sortedTypes = [...byType.entries()].sort((a, b) =>
        b[1].reduce((s, x) => s + x.count, 0) - a[1].reduce((s, x) => s + x.count, 0),
    );

    for (const [type, senders] of sortedTypes) {
        const typeEmails = senders.reduce((s, x) => s + x.count, 0);
        console.log(`  ${type.toUpperCase()} (${senders.length} senders, ${typeEmails} emails):`);
        const sorted = senders.sort((a, b) => b.count - a.count);
        for (const s of sorted) {
            console.log(`    ${s.name.substring(0, 25).padEnd(25)} ${s.domain.padEnd(30)} ${String(s.count).padStart(5)} emails  "${s.subjects[0]?.substring(0, 40) || ''}"`);
        }
        console.log();
    }

    // ── Top financial senders ──
    console.log('┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  3. TOP FINANCIAL SENDERS BY VOLUME                                 │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    const topFinancial = [...financialSenders].sort((a, b) => b.count - a.count).slice(0, 20);
    const maxCount = topFinancial[0]?.count || 1;
    let cumulativePct = 0;

    console.log(`  ${'#'.padStart(3)} ${'Sender'.padEnd(20)} ${'Domain'.padEnd(25)} ${'Count'.padStart(6)} ${'%'.padStart(6)} ${'Cum%'.padStart(6)}  Visual`);
    console.log(`  ${'─'.repeat(90)}`);

    for (let i = 0; i < topFinancial.length; i++) {
        const s = topFinancial[i];
        const pct = (s.count / totalFinancialEmails) * 100;
        cumulativePct += pct;
        const bar = '█'.repeat(Math.round((s.count / maxCount) * 20)) +
                    '░'.repeat(20 - Math.round((s.count / maxCount) * 20));
        console.log(
            `  ${String(i + 1).padStart(3)} ${s.name.substring(0, 20).padEnd(20)} ` +
            `${s.domain.substring(0, 25).padEnd(25)} ` +
            `${String(s.count).padStart(6)} ${pct.toFixed(1).padStart(5)}% ${cumulativePct.toFixed(0).padStart(5)}%  ${bar}`,
        );
    }

    // ── Coverage analysis ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  4. COVERAGE ANALYSIS — "How many senders cover X% of emails?"      │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    const sorted = [...financialSenders].sort((a, b) => b.count - a.count);
    let cumulative = 0;
    const thresholds = [50, 75, 80, 90, 95, 99];
    const thresholdResults: { pct: number; senders: number }[] = [];

    for (let i = 0; i < sorted.length; i++) {
        cumulative += sorted[i].count;
        const coveragePct = (cumulative / totalFinancialEmails) * 100;
        for (const threshold of thresholds) {
            if (coveragePct >= threshold && !thresholdResults.some(r => r.pct === threshold)) {
                thresholdResults.push({ pct: threshold, senders: i + 1 });
            }
        }
    }

    for (const r of thresholdResults) {
        console.log(`  Top ${String(r.senders).padStart(3)} senders cover ${r.pct}% of financial emails`);
    }

    // ── Keyword-detected senders ──
    const keywordSenders = financialSenders.filter(s => s.detectedBy === 'keyword');
    if (keywordSenders.length > 0) {
        console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
        console.log('│  5. NEW SENDERS FOUND (not in known list, detected by keywords)    │');
        console.log('└──────────────────────────────────────────────────────────────────────┘\n');

        for (const s of keywordSenders.sort((a, b) => b.count - a.count).slice(0, 15)) {
            console.log(`    ${s.name.substring(0, 25).padEnd(25)} ${s.email.substring(0, 40).padEnd(40)} ${String(s.count).padStart(3)} emails`);
            for (const subj of s.subjects.slice(0, 2)) {
                console.log(`      "${subj.substring(0, 65)}"`);
            }
        }
    }

    // ── Key Insights ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  6. KEY INSIGHTS                                                    │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    console.log(`  * ${financialSenders.length} unique financial senders found in 6 months`);
    if (thresholdResults.length > 0) {
        const t80 = thresholdResults.find(r => r.pct === 80);
        const t95 = thresholdResults.find(r => r.pct === 95);
        if (t80) console.log(`  * Top ${t80.senders} senders cover 80% of financial emails (validates 80/20 rule)`);
        if (t95) console.log(`  * Top ${t95.senders} senders cover 95% (practical target for sender registry)`);
    }
    if (keywordSenders.length > 0) {
        console.log(`  * ${keywordSenders.length} financial senders not in our known list — add these to the registry`);
    }

    // ── Save Results ──
    const outputPath = path.join(DOWNLOADS_DIR, 'experiment-sender-census.json');
    const output = {
        summary: {
            totalMessagesEstimate: totalMessages,
            uniqueSenders: allSenders.length,
            financialSenders: financialSenders.length,
            nonFinancialSenders: nonFinancialSenders.length,
            financialEmailCount: totalFinancialEmails,
            coverageThresholds: thresholdResults,
        },
        financialSenders: [...financialSenders].sort((a, b) => b.count - a.count).map(s => ({
            email: s.email,
            name: s.name,
            domain: s.domain,
            count: s.count,
            type: s.financialType,
            detectedBy: s.detectedBy,
            sampleSubjects: s.subjects,
        })),
        nonFinancialTopSenders: [...nonFinancialSenders]
            .sort((a, b) => b.count - a.count)
            .slice(0, 30)
            .map(s => ({
                email: s.email,
                name: s.name,
                count: s.count,
                sampleSubjects: s.subjects.slice(0, 2),
            })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n  Results saved: ${outputPath}`);
}

main().catch(console.error);
