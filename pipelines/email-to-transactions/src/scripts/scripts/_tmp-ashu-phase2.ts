import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();
    const emails = await rawEmailsService.find({ userId: USER_ID });

    console.log(`Total emails for Ashutosh: ${emails.length}\n`);

    // Group by fromAddress
    const groups: Record<string, { count: number; subjects: Set<string>; hasPdf: boolean; hasHtml: boolean }> = {};
    for (const e of emails) {
        const from = e.fromAddress || 'unknown';
        if (!groups[from]) groups[from] = { count: 0, subjects: new Set(), hasPdf: false, hasHtml: false };
        groups[from].count++;
        groups[from].subjects.add((e.subject || '').substring(0, 80));
        if (e.hasPdf || (e.attachments && e.attachments.length > 0)) groups[from].hasPdf = true;
        if (e.bodyHtml) groups[from].hasHtml = true;
    }

    // Check which parser configs match each sender
    const sorted = Object.entries(groups).sort((a, b) => (b[1] as any).count - (a[1] as any).count);

    console.log('=== EMAIL GROUPS vs PARSER COVERAGE ===\n');

    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const [from, info] of sorted) {
        // Check if any parser config matches this fromAddress
        const matchingParsers = PARSER_CONFIGS.filter(pc => {
            const pattern = pc.match.fromAddress;
            if (pattern.startsWith('/')) {
                const parts = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
                if (parts) {
                    return new RegExp(parts[1], parts[2]).test(from);
                }
            }
            return pattern === from;
        });

        // Check subject matching too
        let subjectMatched = 0;
        if (matchingParsers.length > 0) {
            for (const subject of info.subjects) {
                for (const pc of matchingParsers) {
                    if (!pc.match.subject) { subjectMatched++; continue; }
                    const subParts = pc.match.subject.match(/^\/(.+)\/([gimsuy]*)$/);
                    if (subParts && new RegExp(subParts[1], subParts[2]).test(subject)) {
                        subjectMatched++;
                    }
                }
            }
        }

        const flags = [info.hasPdf ? 'PDF' : '', info.hasHtml ? 'HTML' : ''].filter(Boolean).join('+');
        const parserNames = matchingParsers.map(p => p.slug).join(', ');
        const status = matchingParsers.length > 0 ? '✓' : '·';

        if (matchingParsers.length > 0) {
            matchedCount += info.count;
        } else {
            unmatchedCount += info.count;
        }

        console.log(`${status} ${info.count.toString().padStart(3)}x | ${from} [${flags}]`);
        if (matchingParsers.length > 0) {
            console.log(`       PARSER: ${parserNames} (${subjectMatched}/${info.subjects.size} subjects match)`);
        }
        const subjects = [...info.subjects].slice(0, 3);
        for (const s of subjects) console.log(`       "${s}"`);
        if (info.subjects.size > 3) console.log(`       ... and ${info.subjects.size - 3} more`);
        console.log();
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Matched by existing parsers: ${matchedCount} emails`);
    console.log(`Not matched: ${unmatchedCount} emails`);
    console.log(`Parser configs: ${PARSER_CONFIGS.length}`);

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
