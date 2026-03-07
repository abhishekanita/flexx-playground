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
        version: 2,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@swiggy.in',
            subject: '/order was delivered/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'orderId',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Order No:\\s*(\\d+)', group: 1 }],
                },
                {
                    name: 'restaurant',
                    type: 'string',
                    required: true,
                    extractors: [
                        {
                            type: 'regex',
                            pattern:
                                'Ordered from:\\s+(.+?)(?:\\s+Shop No|\\s+Lg-|\\s+\\d{1,3}(?:st|nd|rd|th)|\\s+Ground|\\s+First|\\s+Second|\\s+Delivery To)',
                            group: 1,
                        },
                        {
                            type: 'regex',
                            pattern: '(?:Restaurant|Ordered from:)\\s+(.+?)(?:\\s+Your Order Summary|\\s+Shop No|\\s+\\d|$)',
                            group: 1,
                        },
                    ],
                },
                {
                    name: 'orderedAt',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Order placed at:\\s+(.+?)(?:\\s+Order delivered)', group: 1 }],
                },
                {
                    name: 'deliveredAt',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Order delivered at:\\s+(.+?)(?:\\s+Order Status)', group: 1 }],
                },
                {
                    name: 'itemTotal',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Item Total:\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'packagingFee',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(?:Restaurant )?Packaging:\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'platformFee',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Platform Fee:\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'deliveryFee',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Delivery Fee.*?:\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'discount',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Discount Applied.*?:\\s*-?\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'discountCode',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Discount Applied\\s*\\((\\w+)\\)', group: 1 }],
                },
                {
                    name: 'taxes',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Taxes:\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'orderTotal',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Order Total:\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'paidVia',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Paid Via\\s+(\\w+):\\s*₹', group: 1 }],
                },
                {
                    name: 'isGourmet',
                    type: 'boolean',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(Gourmet)', flags: 'i', group: 1 }],
                },
            ],
            arrays: [
                {
                    name: 'items',
                    type: 'string',
                    required: false,
                    extractors: [
                        {
                            type: 'regex_repeat',
                            pattern: '(.+?)\\s+(\\d+)\\s+₹\\s*([\\d,.]+)',
                            flags: 'g',
                            fields: ['name:string', 'quantity:int', 'price:amount'],
                        },
                    ],
                },
            ],
            validation: [{ type: 'field_present', fields: ['orderId', 'orderTotal'] }],
        },
        variants: [],
        stats: emptyStats(),
        domain: 'transaction',
    },

    {
        id: 'swiggy_instamart',
        name: 'Swiggy Instamart Order',
        provider: 'swiggy',
        version: 2,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply@swiggy.in',
            subject: '/instamart order/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'orderId',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'order id:\\s*(\\d+)', flags: 'i', group: 1 }],
                },
                {
                    name: 'deliveryAddress',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Deliver To:\\s*(.+?)(?:\\s+Order Items)', group: 1 }],
                },
                {
                    name: 'itemBill',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Item Bill\\s*₹([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'handlingFee',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Handling Fee\\s*₹([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'deliveryPartnerFee',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Delivery Partner Fee\\s*₹([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'grandTotal',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Grand Total\\s*₹([\\d,.]+)', group: 1 }],
                },
            ],
            arrays: [
                {
                    name: 'items',
                    type: 'string',
                    required: false,
                    extractors: [
                        {
                            type: 'regex_repeat',
                            pattern: '(\\d+)\\s+x\\s+(.+?)\\s+₹([\\d,.]+)',
                            flags: 'g',
                            fields: ['quantity:int', 'name:string', 'price:amount'],
                        },
                    ],
                },
            ],
            validation: [{ type: 'field_present', fields: ['orderId', 'grandTotal'] }],
        },
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

    // ── MakeMyTrip (HTML, declarative) ───────────────────────────────────

    {
        id: 'makemytrip_flight',
        name: 'MakeMyTrip Flight E-Ticket',
        provider: 'makemytrip',
        version: 2,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/makemytrip/i',
            subject: '/E-Ticket/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'bookingId',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Booking ID:\\s*([A-Z0-9]+)', group: 1 }],
                },
                {
                    name: 'route',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Booking Confirmed\\s+(.+?)\\s+(?:One Way|Round Trip|Multi City)', group: 1 }],
                },
                {
                    name: 'tripType',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: 'Booking Confirmed\\s+.+?\\s+(One Way|Round Trip|Multi City)', flags: 'i', group: 1 },
                    ],
                },
                {
                    name: 'travelDate',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(?:One Way|Round Trip),\\s+(.+?)\\s+Booking ID', group: 1 }],
                },
                {
                    name: 'bookedOn',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Booked on\\s+(.+?)\\)', group: 1 }],
                },
                {
                    name: 'airline',
                    type: 'string',
                    required: false,
                    extractors: [
                        {
                            type: 'regex',
                            pattern:
                                '(Air India Express|Air India|IndiGo|SpiceJet|Vistara|Akasa Air|GoAir|Alliance Air|AirAsia India|Star Air)\\s+[A-Z0-9]{2}\\s*\\d+',
                            group: 1,
                        },
                    ],
                },
                {
                    name: 'flightNumber',
                    type: 'string',
                    required: false,
                    extractors: [
                        {
                            type: 'regex',
                            pattern:
                                '(?:Air India Express|Air India|IndiGo|SpiceJet|Vistara|Akasa Air|GoAir|Alliance Air|AirAsia India|Star Air)\\s+([A-Z0-9]{2}\\s*\\d+)',
                            group: 1,
                        },
                    ],
                },
                {
                    name: 'pnr',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'PNR:\\s*([A-Z0-9]+)', group: 1 }],
                },
                {
                    name: 'departureTime',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(\\d{2}:\\d{2})\\s*hrs', group: 1 }],
                },
                {
                    name: 'duration',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(\\d{2}\\s*h\\s*\\d{2}\\s*m)', group: 1 }],
                },
                {
                    name: 'traveler',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: 'TRAVELLER.*?(?:Mr|Mrs|Ms)\\s+([A-Za-z\\s]+?)(?:\\s+\\(ADULT\\)|\\s+-)', group: 1 },
                    ],
                },
                {
                    name: 'totalAmount',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Total Amount\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'paidVia',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Paid by\\s+(\\w+)\\s*₹', group: 1 }],
                },
                {
                    name: 'amountPaid',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Paid by\\s+\\w+\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'discountAmount',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'You saved\\s*₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'discountCode',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'You saved\\s*₹\\s*[\\d,.]+\\s*with\\s+(\\w+)\\s+coupon', group: 1 }],
                },
                {
                    name: 'cabinBaggage',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Cabin Baggage:\\s*(.+?)(?:\\s+Check-in)', group: 1 }],
                },
                {
                    name: 'checkinBaggage',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Check-in Baggage:\\s*(.+?)(?:\\s+TRAVELLER)', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['bookingId', 'totalAmount'] }],
        },
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

    // ── PhonePe (encrypted PDF, declarative) ────────────────────────────

    {
        id: 'phonepe_statement',
        name: 'PhonePe Transaction Statement',
        provider: 'phonepe',
        version: 2,
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
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'pdf_text',
            fields: [
                {
                    name: 'phone',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Transaction Statement for \\+91(\\d+)', group: 1 }],
                },
                {
                    name: 'period',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(\\w{3} \\d{2}, \\d{4}) - (\\w{3} \\d{2}, \\d{4})', group: 0 }],
                },
                {
                    name: 'totalPages',
                    type: 'int',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Page \\d+ of (\\d+)', group: 1 }],
                },
            ],
            arrays: [
                {
                    name: 'transactions',
                    type: 'string',
                    required: false,
                    extractors: [
                        {
                            type: 'regex_repeat',
                            pattern:
                                '([A-Z][a-z]{2} \\d{1,2}, \\d{4})\\s+(\\d{1,2}:\\d{2} [AP]M)\\s+(Paid to|Received from)\\s+(.+?)\\s+Transaction ID : (\\S+)\\s+UTR No : (\\S+)\\s+(Paid by|Credited to) (XX\\d+)\\s+(Debit|Credit)\\s+INR\\s*([\\d,.]+)',
                            flags: 'g',
                            fields: [
                                'date:string',
                                'time:string',
                                'direction:string',
                                'payee:string',
                                'transactionId:string',
                                'utrNo:string',
                                'accountLabel:string',
                                'account:string',
                                'type:string',
                                'amount:amount',
                            ],
                        },
                    ],
                },
            ],
            validation: [{ type: 'min_items', arrayField: 'transactions', minCount: 1 }],
        },
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
