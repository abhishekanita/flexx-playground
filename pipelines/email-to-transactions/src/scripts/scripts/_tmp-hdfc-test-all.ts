import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { DeclarativeEngine } from '@/pipelines/parsers/helpers/declarative-engine';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    const config = PARSER_CONFIGS.find(c => c.slug === 'hdfc_upi_alert');
    if (!config || config.strategy !== 'declarative' || !config.declarativeRules) {
        console.log('Config not found');
        process.exit(1);
    }

    const engine = new DeclarativeEngine();
    const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'alerts@hdfcbank.net' });

    // Match subject
    const subjectPattern = config.match.subject;
    const subParts = subjectPattern?.match(/^\/(.+)\/([gimsuy]*)$/);
    const subjectRe = subParts ? new RegExp(subParts[1], subParts[2]) : null;

    let success = 0;
    let fail = 0;

    for (const e of emails) {
        if (subjectRe && !subjectRe.test(e.subject || '')) continue;
        if (!e.bodyHtml) continue;

        const result = engine.runParser(e.bodyHtml, config.declarativeRules) as any;
        if (result.amount > 0) {
            success++;
        } else {
            fail++;
            console.log(`FAIL: "${e.subject}"`);
            console.log(`  result:`, JSON.stringify(result));
        }
    }

    console.log(`\nSuccess: ${success}, Fail: ${fail}`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
