import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { DeclarativeEngine } from '@/pipelines/parsers/helpers/declarative-engine';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();
    const engine = new DeclarativeEngine();

    const slugs = [
        'zerodha_coin_redemption',
        'zerodha_coin_sell_order',
        'zerodha_demat_amc',
        'kfintech_mf_valuation',
        'kfintech_mf_redemption',
    ];

    for (const slug of slugs) {
        const config = PARSER_CONFIGS.find(c => c.slug === slug);
        if (!config || config.strategy !== 'declarative' || !config.declarativeRules) {
            console.log(`\n=== ${slug} === NOT FOUND`);
            continue;
        }

        // Match emails
        const fromPattern = config.match.fromAddress;
        let fromRe: RegExp | null = null;
        if (fromPattern.startsWith('/')) {
            const parts = fromPattern.match(/^\/(.+)\/([gimsuy]*)$/);
            if (parts) fromRe = new RegExp(parts[1], parts[2]);
        }

        const subjectPattern = config.match.subject;
        let subjectRe: RegExp | null = null;
        if (subjectPattern) {
            const parts = subjectPattern.match(/^\/(.+)\/([gimsuy]*)$/);
            if (parts) subjectRe = new RegExp(parts[1], parts[2]);
        }

        const emails = await rawEmailsService.find({ userId: USER_ID });
        const matching = emails.filter(e => {
            const from = e.fromAddress || '';
            const subject = e.subject || '';
            const fromMatch = fromRe ? fromRe.test(from) : from === fromPattern;
            if (!fromMatch) return false;
            if (subjectRe && !subjectRe.test(subject)) return false;
            return true;
        });

        console.log(`\n=== ${slug} (${matching.length} emails) ===`);

        for (const e of matching.slice(0, 2)) {
            if (!e.bodyHtml) continue;
            const result = engine.runParser(e.bodyHtml, config.declarativeRules);
            console.log(`  Subject: ${e.subject?.substring(0, 60)}`);
            console.log(`  Result: ${JSON.stringify(result)}`);
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
