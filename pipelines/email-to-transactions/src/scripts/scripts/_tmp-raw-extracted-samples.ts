import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { parserConfigService } from '@/services/parsers/parser-config.service';

const USER_ID = '69ad593fb3726a47dec36515';

function hasContent(obj: any): boolean {
    if (!obj) return false;
    for (const v of Object.values(obj)) {
        if (typeof v === 'number' && v !== 0) return true;
        if (typeof v === 'string' && v !== '') return true;
        if (Array.isArray(v) && v.length > 0) return true;
    }
    return false;
}

(async () => {
    await databaseLoader();

    const allConfigs = await parserConfigService.find({});
    const configMap: Record<string, string> = {};
    for (const c of allConfigs) {
        configMap[String((c as any)._id)] = (c as any).slug || (c as any).name || String((c as any)._id);
    }

    const emails = await rawEmailsService.find({
        userId: USER_ID,
        status: 'parsed',
        marchedParserId: { $exists: true, $ne: null },
    });

    // Group by marchedParserId - prefer a sample with actual data
    const bySlug: Record<string, any> = {};
    for (const e of emails) {
        const id = String((e as any).marchedParserId);
        if (!id) continue;
        const slug = configMap[id] || id;
        if (!bySlug[slug]) {
            bySlug[slug] = {
                count: 0,
                sample: null,
                hasSolidSample: false,
                configId: id,
            };
        }
        bySlug[slug].count++;
        const raw = (e as any).parsedData?.rawExtracted;
        if (!bySlug[slug].hasSolidSample && raw) {
            if (hasContent(raw)) {
                bySlug[slug].sample = raw;
                bySlug[slug].hasSolidSample = true;
            } else if (!bySlug[slug].sample) {
                bySlug[slug].sample = raw;
            }
        }
    }

    const slugs = Object.keys(bySlug).sort();
    console.log(`\n=== Found ${slugs.length} parser slugs across ${emails.length} parsed emails ===\n`);

    for (const slug of slugs) {
        const { count, sample, configId, hasSolidSample } = bySlug[slug];
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SLUG: ${slug}  (${count} emails)  [configId: ${configId}]${!hasSolidSample ? '  [WARNING: no solid sample found]' : ''}`);
        console.log('='.repeat(80));
        console.log(JSON.stringify(sample, null, 2));
    }

    process.exit(0);
})();
