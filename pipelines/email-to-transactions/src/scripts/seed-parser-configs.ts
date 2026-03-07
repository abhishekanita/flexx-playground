// =============================================================================
// Seed script — imports all existing parsers into the parser-configs collection
// =============================================================================
// Run: npx ts-node --files -r tsconfig-paths/register src/scripts/seed-parser-configs.ts

import { ParserConfigModel } from '@/schema/parser-configs.schema';
import { ParserConfig } from '@/types/parser-config.type';

const now = new Date().toISOString();

const emptyStats = (): ParserConfig['stats'] => ({
    totalAttempts: 0,
    successCount: 0,
    failCount: 0,
    emptyResultCount: 0,
    successRate: 0,
    avgConfidence: 0,
    fieldStats: {},
    versionHistory: [{ version: 1, activatedAt: now, successRate: 0, totalAttempts: 0 }],
});

const PARSER_CONFIGS: Omit<ParserConfig, '_id'>[] = [
    // ── Bank Statements (PDF, code strategy) ────────────────────────────

    {
        id: 'kotak_savings_statement',
        name: 'Kotak Bank Savings Statement',
        provider: 'kotak',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'bankstatements@kotak.bank.in',
            subject: '/statement for Kotak A\\/c/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwords: ['abhi1804'],
        },
        strategy: 'code',
        codeModule: 'kotak-statement',
        variants: [],
        stats: emptyStats(),
        domain: 'statement',
    },

    {
        id: 'sbi_savings_statement',
        name: 'SBI e-Account Statement',
        provider: 'sbi',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/cbssbi\\.cas@alerts\\.sbi\\.(co\\.in|bank\\.in)/i',
            subject: '/e-account statement/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwords: ['38083180497', 'abhi1804'],
        },
        strategy: 'code',
        codeModule: 'sbi-statement',
        variants: [],
        stats: emptyStats(),
        domain: 'statement',
    },

    // ── Swiggy (HTML, declarative) ──────────────────────────────────────

    {
        id: 'swiggy_food_delivery',
        name: 'Swiggy Food/Gourmet Order',
        provider: 'swiggy',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@swiggy.in',
            subject: '/order was delivered/i',
        },
        source: 'body_html',
        strategy: 'code',
        codeModule: 'swiggy-food',
        variants: [],
        stats: emptyStats(),
        domain: 'transaction',
    },

    {
        id: 'swiggy_instamart',
        name: 'Swiggy Instamart Order',
        provider: 'swiggy',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply@swiggy.in',
            subject: '/instamart order/i',
        },
        source: 'body_html',
        strategy: 'code',
        codeModule: 'swiggy-instamart',
        variants: [],
        stats: emptyStats(),
        domain: 'transaction',
    },

    // ── Uber (HTML, code) ───────────────────────────────────────────────

    {
        id: 'uber_trip',
        name: 'Uber Trip Receipt',
        provider: 'uber',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@uber.com',
            subject: '/trip with Uber/i',
        },
        source: 'body_html',
        strategy: 'code',
        codeModule: 'uber-trip',
        variants: [],
        stats: emptyStats(),
        domain: 'transaction',
    },

    // ── Apple (HTML, code) ──────────────────────────────────────────────

    {
        id: 'apple_invoice',
        name: 'Apple Invoice',
        provider: 'apple',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/apple\\.com/i',
            subject: '/invoice from Apple/i',
        },
        source: 'body_html',
        strategy: 'code',
        codeModule: 'apple-invoice',
        variants: [],
        stats: emptyStats(),
        domain: 'transaction',
    },

    // ── MakeMyTrip (HTML, code) ─────────────────────────────────────────

    {
        id: 'makemytrip_flight',
        name: 'MakeMyTrip Flight E-Ticket',
        provider: 'makemytrip',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/makemytrip/i',
            subject: '/E-Ticket/i',
        },
        source: 'body_html',
        strategy: 'code',
        codeModule: 'makemytrip-flight',
        variants: [],
        stats: emptyStats(),
        domain: 'transaction',
    },

    // ── Paytm (XLSX, code) ──────────────────────────────────────────────

    {
        id: 'paytm_statement',
        name: 'Paytm Monthly Statement',
        provider: 'paytm',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply@paytm.com',
            subject: '/Paytm Statement/i',
        },
        source: 'xlsx',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/\\.xlsx$/i',
            mimeTypes: ['application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        },
        strategy: 'code',
        codeModule: 'paytm-statement',
        variants: [],
        stats: emptyStats(),
        domain: 'statement',
    },

    // ── PhonePe (encrypted PDF, code) ───────────────────────────────────

    {
        id: 'phonepe_statement',
        name: 'PhonePe Transaction Statement',
        provider: 'phonepe',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@phonepe.com',
            subject: '/PhonePe transaction statement/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwords: ['7838237658'],
        },
        strategy: 'code',
        codeModule: 'phonepe-statement',
        variants: [],
        stats: emptyStats(),
        domain: 'statement',
    },
];

// =============================================================================

export async function seedParserConfigs() {
    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    for (const config of PARSER_CONFIGS) {
        const existing = await ParserConfigModel.findOne({ id: config.id });

        if (existing) {
            // Update match rules, attachment config, source — but preserve stats
            await ParserConfigModel.updateOne(
                { id: config.id },
                {
                    $set: {
                        name: config.name,
                        provider: config.provider,
                        match: config.match,
                        source: config.source,
                        attachment: config.attachment,
                        strategy: config.strategy,
                        codeModule: config.codeModule,
                        declarativeRules: config.declarativeRules,
                        domain: config.domain,
                    },
                }
            );
            updated++;
            logger.info(`[Seed] Updated: ${config.id}`);
        } else {
            await ParserConfigModel.create(config);
            inserted++;
            logger.info(`[Seed] Inserted: ${config.id}`);
        }
    }

    logger.info(`[Seed] Done: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
}

// Run directly
if (require.main === module) {
    require('@/loaders/logger');
    const initServer = require('@/loaders').default;
    initServer().then(async () => {
        await seedParserConfigs();
        process.exit(0);
    });
}
