require('@/loaders/logger');
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';

const USER_ID = '69ad593fb3726a47dec36515';

function getDomain(email: string): string {
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : email.toLowerCase();
}

(async () => {
    await databaseLoader();

    // ═══════════════════════════════════════════════════════════════════
    // 1. STATUS BREAKDOWN
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('1. EMAIL STATUS BREAKDOWN');
    console.log('='.repeat(80));

    const allEmails = await rawEmailsService.find({ userId: USER_ID });
    const statusCounts: Record<string, number> = {};
    for (const e of allEmails) {
        const s = e.status || 'unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    console.log(`Total emails: ${allEmails.length}`);
    for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${status}: ${count}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. UNMATCHED EMAILS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('2. UNMATCHED EMAILS (no parser matched)');
    console.log('='.repeat(80));

    const unmatched = allEmails.filter(e => e.status === 'unmatched');
    console.log(`Total unmatched: ${unmatched.length}`);

    // Group by domain
    const unmatchedByDomain: Record<string, any[]> = {};
    for (const e of unmatched) {
        const domain = getDomain(e.fromAddress || '');
        if (!unmatchedByDomain[domain]) unmatchedByDomain[domain] = [];
        unmatchedByDomain[domain].push(e);
    }

    console.log('\nGrouped by sender domain:');
    const sortedDomains = Object.entries(unmatchedByDomain).sort((a, b) => b[1].length - a[1].length);
    for (const [domain, emails] of sortedDomains) {
        console.log(`\n  [${domain}] — ${emails.length} emails`);
        const samples = emails.slice(0, 3);
        for (const s of samples) {
            console.log(`    from: ${s.fromAddress}`);
            console.log(`    subj: ${s.subject}`);
            console.log(`    date: ${s.receivedAt?.toISOString?.() || 'N/A'}`);
            console.log(`    hasPdf: ${s.hasPdf}, hasAtt: ${s.hasAttachments}`);
            console.log('    ---');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. FETCHED EMAILS (unprocessed)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('3. FETCHED EMAILS (not processed yet)');
    console.log('='.repeat(80));

    const fetched = allEmails.filter(e => e.status === 'fetched');
    console.log(`Total fetched: ${fetched.length}`);

    const fetchedByDomain: Record<string, any[]> = {};
    for (const e of fetched) {
        const domain = getDomain(e.fromAddress || '');
        if (!fetchedByDomain[domain]) fetchedByDomain[domain] = [];
        fetchedByDomain[domain].push(e);
    }

    console.log('\nGrouped by sender domain:');
    const sortedFetchedDomains = Object.entries(fetchedByDomain).sort((a, b) => b[1].length - a[1].length);
    for (const [domain, emails] of sortedFetchedDomains) {
        console.log(`\n  [${domain}] — ${emails.length} emails`);
        for (const s of emails.slice(0, 3)) {
            console.log(`    from: ${s.fromAddress}`);
            console.log(`    subj: ${s.subject}`);
            console.log(`    date: ${s.receivedAt?.toISOString?.() || 'N/A'}`);
            console.log('    ---');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. PARSE_FAILED EMAILS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('4. PARSE_FAILED EMAILS');
    console.log('='.repeat(80));

    const parseFailed = allEmails.filter(e => e.status === 'parse_failed');
    console.log(`Total parse_failed: ${parseFailed.length}`);

    const failedByParser: Record<string, any[]> = {};
    for (const e of parseFailed) {
        const pid = (e as any).matchedParserId || (e as any).parserId || 'unknown';
        if (!failedByParser[pid]) failedByParser[pid] = [];
        failedByParser[pid].push(e);
    }

    for (const [parserId, emails] of Object.entries(failedByParser).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`\n  Parser: ${parserId} — ${emails.length} failures`);
        for (const s of emails.slice(0, 3)) {
            console.log(`    from: ${s.fromAddress}`);
            console.log(`    subj: ${s.subject}`);
            console.log(`    error: ${(s as any).lastParseError || 'N/A'}`);
            console.log(`    date: ${s.receivedAt?.toISOString?.() || 'N/A'}`);
            console.log('    ---');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. INSERT_FAILED EMAILS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('5. INSERT_FAILED EMAILS');
    console.log('='.repeat(80));

    const insertFailed = allEmails.filter(e => e.status === 'insert_failed');
    console.log(`Total insert_failed: ${insertFailed.length}`);
    for (const s of insertFailed.slice(0, 5)) {
        console.log(`  from: ${s.fromAddress}`);
        console.log(`  subj: ${s.subject}`);
        console.log(`  error: ${(s as any).lastParseError || (s as any).lastInsertError || 'N/A'}`);
        console.log('  ---');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. DISTINCT SENDERS WITHOUT PARSER CONFIGS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('6. ALL DISTINCT SENDERS (for cross-ref with parser registry)');
    console.log('='.repeat(80));

    const senderCounts: Record<string, { count: number; statuses: Record<string, number>; subjects: string[] }> = {};
    for (const e of allEmails) {
        const addr = (e.fromAddress || '').toLowerCase();
        if (!senderCounts[addr]) senderCounts[addr] = { count: 0, statuses: {}, subjects: [] };
        senderCounts[addr].count++;
        const s = e.status || 'unknown';
        senderCounts[addr].statuses[s] = (senderCounts[addr].statuses[s] || 0) + 1;
        if (senderCounts[addr].subjects.length < 3) senderCounts[addr].subjects.push(e.subject || '');
    }

    // Show senders that have unmatched or fetched emails (potential parseable senders)
    console.log('\nSenders with unmatched/fetched emails (potential parser candidates):');
    const candidates = Object.entries(senderCounts)
        .filter(([_, info]) => (info.statuses['unmatched'] || 0) + (info.statuses['fetched'] || 0) > 0)
        .sort((a, b) => b[1].count - a[1].count);

    for (const [addr, info] of candidates) {
        const statusStr = Object.entries(info.statuses).map(([k, v]) => `${k}:${v}`).join(', ');
        console.log(`\n  ${addr} — total:${info.count} [${statusStr}]`);
        for (const subj of info.subjects) {
            console.log(`    subj: ${subj}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. ALL FETCHED EMAILS - FULL LIST
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('7. ALL FETCHED EMAILS — FULL LIST');
    console.log('='.repeat(80));

    const fetchedSorted = fetched.sort((a: any, b: any) => {
        const da = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const db = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return db - da;
    });

    for (const e of fetchedSorted) {
        console.log(JSON.stringify({
            from: e.fromAddress,
            subject: e.subject,
            date: e.receivedAt?.toISOString?.()?.slice(0, 10) || 'N/A',
            hasPdf: e.hasPdf || false,
            hasAtt: e.hasAttachments || false,
            attCount: e.attachments?.length || 0,
        }));
    }

    process.exit(0);
})();
