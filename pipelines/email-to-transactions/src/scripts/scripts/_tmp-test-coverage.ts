import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();
    const emails = await rawEmailsService.find({ userId: USER_ID });

    console.log(`Total emails: ${emails.length}\n`);

    let matchedCount = 0;
    let unmatchedCount = 0;
    const matchedBySlugs: Record<string, number> = {};

    for (const e of emails) {
        const from = e.fromAddress || '';
        const subject = e.subject || '';

        let matched = false;
        for (const pc of PARSER_CONFIGS) {
            const pattern = pc.match.fromAddress;
            let fromMatch = false;
            if (pattern.startsWith('/')) {
                const parts = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
                if (parts) fromMatch = new RegExp(parts[1], parts[2]).test(from);
            } else {
                fromMatch = pattern === from;
            }
            if (!fromMatch) continue;

            if (pc.match.subject) {
                const subParts = pc.match.subject.match(/^\/(.+)\/([gimsuy]*)$/);
                if (subParts && !new RegExp(subParts[1], subParts[2]).test(subject)) continue;
            }

            matched = true;
            matchedBySlugs[pc.slug] = (matchedBySlugs[pc.slug] || 0) + 1;
            break;
        }

        if (matched) matchedCount++;
        else unmatchedCount++;
    }

    console.log('=== PARSER COVERAGE ===\n');
    const sorted = Object.entries(matchedBySlugs).sort((a, b) => b[1] - a[1]);
    for (const [slug, count] of sorted) {
        console.log(`  ${count.toString().padStart(4)}x  ${slug}`);
    }
    console.log(`\nMatched: ${matchedCount} / ${emails.length} (${((matchedCount / emails.length) * 100).toFixed(1)}%)`);
    console.log(`Unmatched: ${unmatchedCount}`);

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
