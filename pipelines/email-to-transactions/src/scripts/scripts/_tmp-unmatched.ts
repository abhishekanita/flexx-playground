import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

async function main() {
    await databaseLoader();
    const emails = await rawEmailsService.find({ userId: '69ad593fb3726a47dec36515' });
    console.log('Total emails:', emails.length);

    // Build matchers from configs
    const matchers = PARSER_CONFIGS.map(c => {
        let fromTest: RegExp | null = null;
        const fp = c.match.fromAddress;
        if (fp.startsWith('/')) {
            const parts = fp.match(/^\/(.+)\/([gimsuy]*)$/);
            if (parts) fromTest = new RegExp(parts[1], parts[2]);
        }
        let subjTest: RegExp | null = null;
        if (c.match.subject) {
            const sp = c.match.subject;
            if (sp.startsWith('/')) {
                const parts = sp.match(/^\/(.+)\/([gimsuy]*)$/);
                if (parts) subjTest = new RegExp(parts[1], parts[2]);
            }
        }
        return { slug: c.slug, fromTest, fromStr: fp, subjTest };
    });

    let matched = 0;
    const unmatched: Array<{ from: string; subject: string; date: any; hasPdf: boolean; attCount: number }> = [];
    for (const e of emails) {
        const from = e.fromAddress || '';
        const subject = e.subject || '';
        let found = false;
        for (const m of matchers) {
            const fromOk = m.fromTest ? m.fromTest.test(from) : from === m.fromStr;
            if (!fromOk) continue;
            if (m.subjTest && !m.subjTest.test(subject)) continue;
            found = true;
            break;
        }
        if (found) { matched++; }
        else { unmatched.push({ from, subject, date: e.receivedAt, hasPdf: e.hasPdf, attCount: e.attachments?.length || 0 }); }
    }
    console.log('Matched:', matched, 'Unmatched:', unmatched.length);

    // Group unmatched by from address
    const groups: Record<string, { count: number; subjects: Record<string, number>; hasPdf: boolean; hasAtt: boolean }> = {};
    for (const u of unmatched) {
        if (!groups[u.from]) groups[u.from] = { count: 0, subjects: {}, hasPdf: false, hasAtt: false };
        groups[u.from].count++;
        const subj = u.subject.replace(/\d+/g, 'N').replace(/Rs\.?\s*[\d,.]+/g, 'Rs.N').substring(0, 80);
        groups[u.from].subjects[subj] = (groups[u.from].subjects[subj] || 0) + 1;
        if (u.hasPdf) groups[u.from].hasPdf = true;
        if (u.attCount > 0) groups[u.from].hasAtt = true;
    }

    // Sort by count desc
    const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
    for (const [from, g] of sorted) {
        console.log('\n' + from + ' (' + g.count + 'x)' + (g.hasPdf ? ' [PDF]' : '') + (g.hasAtt ? ' [ATT]' : ''));
        const topSubjects = Object.entries(g.subjects).sort((a, b) => b[1] - a[1]).slice(0, 5);
        for (const [s, c] of topSubjects) {
            console.log('  ' + c + 'x "' + s + '"');
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
