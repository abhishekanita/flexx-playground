// Exploration script — understand all email types for Ashutosh's account
// Run: npx ts-node --files -r tsconfig-paths/register src/scripts/scripts/_tmp-ashu-emails.ts

import { rawEmailsService } from '@/services/emails/raw-emails.service';

const USER_ID = '69ad593fb3726a47dec36515';

// Higher-level category detection based on domain + subject heuristics
function categorize(domain: string, subjects: string[]): string {
    const d = domain.toLowerCase();
    const allSubjects = subjects.join(' ').toLowerCase();

    // Banks
    const bankDomains = ['kotak', 'hdfcbank', 'sbi', 'icicibank', 'axisbank', 'idfcfirstbank', 'indusind', 'yesbank', 'bobfinancial', 'rbl', 'federalbank', 'canarabank', 'pnb', 'unionbank', 'bankofbaroda'];
    const isBankDomain = bankDomains.some(b => d.includes(b));

    if (isBankDomain || d.includes('bank')) {
        if (allSubjects.includes('statement') && (allSubjects.includes('credit card') || allSubjects.includes('card statement'))) {
            return 'CREDIT_CARD_STATEMENT';
        }
        if (allSubjects.includes('statement')) return 'BANK_STATEMENT';
        if (allSubjects.includes('alert') || allSubjects.includes('transaction') || allSubjects.includes('debited') || allSubjects.includes('credited') || allSubjects.includes('otp') || allSubjects.includes('debit') || allSubjects.includes('credit')) {
            return 'BANK_ALERT';
        }
        return 'BANK_OTHER';
    }

    // Investments / MF
    if (d.includes('cams') || d.includes('kfintech') || d.includes('mfcentral') || d.includes('amfi') || d.includes('mutualfund') || d.includes('zerodha') || d.includes('groww') || d.includes('kuvera') || d.includes('smallcase') || d.includes('coin') || allSubjects.includes('mutual fund') || allSubjects.includes('folio') || allSubjects.includes('nav') || allSubjects.includes('sip')) {
        return 'INVESTMENT_MF';
    }
    if (d.includes('cdsl') || d.includes('nsdl') || d.includes('bse') || d.includes('nse') || allSubjects.includes('demat') || allSubjects.includes('share') || allSubjects.includes('dividend')) {
        return 'INVESTMENT_STOCKS';
    }

    // Insurance
    if (d.includes('insurance') || d.includes('acko') || d.includes('digit') || d.includes('policybazaar') || d.includes('starhealth') || d.includes('irdai') || allSubjects.includes('insurance') || allSubjects.includes('policy') || allSubjects.includes('premium')) {
        return 'INSURANCE';
    }

    // Loans / EMI
    if (allSubjects.includes('loan') || allSubjects.includes('emi') || d.includes('loan') || d.includes('bajajfinserv') || d.includes('lendingkart')) {
        return 'LOAN_EMI';
    }

    // UPI / Payments
    if (d.includes('phonepe') || d.includes('paytm') || d.includes('gpay') || d.includes('google') && allSubjects.includes('payment') || d.includes('razorpay') || d.includes('bhim') || d.includes('upi')) {
        return 'UPI_PAYMENTS';
    }

    // Food / Delivery
    if (d.includes('swiggy') || d.includes('zomato') || d.includes('dunzo') || d.includes('blinkit') || d.includes('zepto') || d.includes('bigbasket') || d.includes('instamart')) {
        return 'FOOD_DELIVERY';
    }

    // E-commerce / Invoices
    if (d.includes('amazon') || d.includes('flipkart') || d.includes('myntra') || d.includes('ajio') || d.includes('nykaa') || d.includes('meesho') || d.includes('snapdeal')) {
        return 'ECOMMERCE';
    }

    // Cab / Travel
    if (d.includes('uber') || d.includes('ola') || d.includes('rapido') || d.includes('makemytrip') || d.includes('goibibo') || d.includes('irctc') || d.includes('cleartrip') || d.includes('yatra')) {
        return 'CAB_TRAVEL';
    }

    // Bills / Utilities
    if (allSubjects.includes('bill') || allSubjects.includes('recharge') || allSubjects.includes('electricity') || d.includes('jio') || d.includes('airtel') || d.includes('vi.') || d.includes('bsnl') || d.includes('tatapower') || d.includes('bescom')) {
        return 'BILLS_UTILITIES';
    }

    // Subscriptions
    if (d.includes('netflix') || d.includes('spotify') || d.includes('hotstar') || d.includes('prime') || d.includes('youtube') || d.includes('apple')) {
        return 'SUBSCRIPTION';
    }

    // Receipts / Invoices (generic)
    if (allSubjects.includes('invoice') || allSubjects.includes('receipt') || allSubjects.includes('order') || allSubjects.includes('booking')) {
        return 'RECEIPT_INVOICE';
    }

    // Marketing / Promo
    if (allSubjects.includes('offer') || allSubjects.includes('sale') || allSubjects.includes('cashback') || allSubjects.includes('coupon') || allSubjects.includes('exclusive') || allSubjects.includes('% off') || allSubjects.includes('discount')) {
        return 'MARKETING_PROMO';
    }

    return 'OTHER';
}

export async function exploreEmails() {
    // Fetch all emails for the user
    const emails = await rawEmailsService.find({ userId: USER_ID });
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TOTAL EMAILS: ${emails.length}`);
    console.log(`${'='.repeat(80)}\n`);

    // Group by domain
    const domainMap = new Map<string, {
        count: number;
        subjects: Set<string>;
        hasPdf: boolean;
        hasOtherAttachments: boolean;
        fromAddresses: Set<string>;
        sampleDates: string[];
        statuses: Map<string, number>;
    }>();

    for (const email of emails) {
        const from = email.fromAddress || 'unknown';
        const domain = from.includes('@') ? from.split('@')[1].toLowerCase() : from.toLowerCase();

        if (!domainMap.has(domain)) {
            domainMap.set(domain, {
                count: 0,
                subjects: new Set(),
                hasPdf: false,
                hasOtherAttachments: false,
                fromAddresses: new Set(),
                sampleDates: [],
                statuses: new Map(),
            });
        }

        const entry = domainMap.get(domain)!;
        entry.count++;
        if (email.subject) entry.subjects.add(email.subject);
        entry.fromAddresses.add(from);
        if (email.receivedAt) entry.sampleDates.push(String(email.receivedAt));

        const status = (email as any).status || 'unknown';
        entry.statuses.set(status, (entry.statuses.get(status) || 0) + 1);

        if (email.attachments && email.attachments.length > 0) {
            for (const att of email.attachments) {
                if (att.mimeType === 'application/pdf' || att.filename?.endsWith('.pdf')) {
                    entry.hasPdf = true;
                } else {
                    entry.hasOtherAttachments = true;
                }
            }
        }
    }

    // Sort by count descending
    const sorted = [...domainMap.entries()].sort((a, b) => b[1].count - a[1].count);

    console.log(`GROUPED BY DOMAIN (${sorted.length} unique domains)`);
    console.log(`${'='.repeat(80)}\n`);

    for (const [domain, data] of sorted) {
        const subjectArr = [...data.subjects];
        const sampleSubjects = subjectArr.slice(0, 5);
        const fromArr = [...data.fromAddresses];
        const statusStr = [...data.statuses.entries()].map(([s, c]) => `${s}:${c}`).join(', ');

        console.log(`--- ${domain} (${data.count} emails) ---`);
        console.log(`  From addresses: ${fromArr.slice(0, 3).join(', ')}${fromArr.length > 3 ? ` (+${fromArr.length - 3} more)` : ''}`);
        console.log(`  PDF attachments: ${data.hasPdf ? 'YES' : 'no'}`);
        console.log(`  Other attachments: ${data.hasOtherAttachments ? 'YES' : 'no'}`);
        console.log(`  Statuses: ${statusStr}`);
        console.log(`  Unique subjects: ${subjectArr.length}`);
        console.log(`  Sample subjects:`);
        for (const s of sampleSubjects) {
            console.log(`    - ${s}`);
        }
        if (subjectArr.length > 5) {
            console.log(`    ... and ${subjectArr.length - 5} more unique subjects`);
        }
        console.log('');
    }

    // Category grouping
    console.log(`\n${'='.repeat(80)}`);
    console.log(`GROUPED BY CATEGORY`);
    console.log(`${'='.repeat(80)}\n`);

    const categoryMap = new Map<string, { domains: Set<string>; count: number; hasPdf: boolean }>();

    for (const [domain, data] of sorted) {
        const cat = categorize(domain, [...data.subjects]);
        if (!categoryMap.has(cat)) {
            categoryMap.set(cat, { domains: new Set(), count: 0, hasPdf: false });
        }
        const entry = categoryMap.get(cat)!;
        entry.domains.add(domain);
        entry.count += data.count;
        if (data.hasPdf) entry.hasPdf = true;
    }

    const sortedCategories = [...categoryMap.entries()].sort((a, b) => b[1].count - a[1].count);

    for (const [cat, data] of sortedCategories) {
        console.log(`${cat} — ${data.count} emails, ${data.domains.size} domains, PDF: ${data.hasPdf ? 'YES' : 'no'}`);
        for (const d of data.domains) {
            const domainData = domainMap.get(d)!;
            console.log(`  - ${d} (${domainData.count})`);
        }
        console.log('');
    }

    // Summary of parsing status
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PARSING STATUS SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);

    const globalStatus = new Map<string, number>();
    for (const email of emails) {
        const status = (email as any).status || 'unknown';
        globalStatus.set(status, (globalStatus.get(status) || 0) + 1);
    }
    for (const [status, count] of [...globalStatus.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${status}: ${count}`);
    }
    console.log('');
}

// Run directly
if (require.main === module) {
    require('@/loaders/logger');
    const initServer = require('@/loaders').default;
    initServer().then(async () => {
        await exploreEmails();
        process.exit(0);
    });
}
