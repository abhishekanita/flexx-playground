import { ParserConfig } from '@/types/pipelines/parser-config.type';

export const PARSER_CONFIGS: Omit<ParserConfig, '_id'>[] = [
    // ── Bank Statements (PDF, code strategy) ────────────────────────────

    {
        slug: 'kotak_savings_statement',
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
            passwordStrategy: ['{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'kotak-statement',
        variants: [],
        domain: 'statement',
    },

    {
        slug: 'sbi_savings_statement',
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
            // passwords: ['38083180497', 'abhi1804'],
            passwordStrategy: ['{name:first4}{dob:DDMM}', '{phone:last5}{dob:DDMMYY}'],
        },
        strategy: 'code',
        codeModule: 'sbi-statement',
        variants: [],
        domain: 'statement',
    },

    // ── Credit Card Statements (PDF, code) ─────────────────────────────

    {
        slug: 'hdfc_cc_statement',
        name: 'HDFC Bank Credit Card Statement',
        provider: 'hdfc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/emailstatements\\.c(ards|c)@hdfcbank\\.net/i',
            subject: '/credit card statement/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf', 'application/octet-stream'],
            passwordStrategy: ['{name:first4}{dob:DDMM}', '{dob:DDMMYYYY}'],
        },
        strategy: 'code',
        codeModule: 'hdfc-cc-statement',
        variants: [],
        domain: 'statement',
    },

    {
        slug: 'sbicard_cc_statement',
        name: 'SBI Card Credit Card Statement',
        provider: 'sbicard',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'statements@sbicard.com',
            subject: '/monthly statement/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/\\.pdf$/i',
            mimeTypes: ['application/pdf', 'application/octet-stream'],
            passwordStrategy: ['061119954129', '061119955145', '061119954835', '{dob:DDMMYYYY}'],
        },
        strategy: 'code',
        codeModule: 'sbicard-cc-statement',
        variants: [],
        domain: 'statement',
    },

    // ── Swiggy (HTML, declarative) ──────────────────────────────────────
    // NOTE: Instamart MUST come before Food — both match "order was delivered"
    //       but Instamart has more specific subject pattern ("Instamart order")

    {
        slug: 'swiggy_instamart',
        name: 'Swiggy Instamart Order',
        provider: 'swiggy',
        version: 2,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/no-?reply@swiggy\\.in/i',
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
        domain: 'transaction',
    },

    {
        slug: 'swiggy_food_delivery',
        name: 'Swiggy Food/Gourmet Order',
        provider: 'swiggy',
        version: 2,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/no-?reply@swiggy\\.in/i',
            subject: '/^(?!.*instamart).*order was.*delivered/i',
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
        domain: 'transaction',
    },

    // ── Uber (HTML, code) ───────────────────────────────────────────────

    {
        slug: 'uber_trip',
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
        domain: 'transaction',
    },

    // ── Apple (HTML, code) ──────────────────────────────────────────────

    {
        slug: 'apple_invoice',
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
        domain: 'transaction',
    },

    // ── MakeMyTrip (HTML, declarative) ───────────────────────────────────

    {
        slug: 'makemytrip_flight',
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
        domain: 'transaction',
    },

    // ── Paytm (XLSX, code) ──────────────────────────────────────────────

    {
        slug: 'paytm_statement',
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
        domain: 'statement',
    },

    // ── Zomato (HTML, declarative) ───────────────────────────────────────

    {
        slug: 'zomato_order',
        name: 'Zomato Food Order',
        provider: 'zomato',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@zomato.com',
            subject: '/order from|bill payment/i',
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
                    extractors: [{ type: 'regex', pattern: 'ORDER ID:\\s*(\\d+)', flags: 'i', group: 1 }],
                },
                {
                    name: 'restaurant',
                    type: 'string',
                    required: true,
                    extractors: [
                        { type: 'regex', pattern: 'ordering from\\s+(.+?)(?:\\s+ORDER ID|\\s+Unit|\\s+Shop|\\s+\\d)', flags: 'i', group: 1 },
                        { type: 'regex', pattern: 'order from\\s+(.+)', flags: 'i', group: 1 },
                    ],
                },
                {
                    name: 'status',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(Delivered|Out for delivery|Preparing)', flags: 'i', group: 1 }],
                },
                {
                    name: 'totalPaid',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Total paid\\s*[-–]?\\s*₹\\s*([\\d,.]+)', flags: 'i', group: 1 }],
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
                            pattern: '(\\d+)\\s+X\\s+(.+?)(?:\\s+\\d+\\s+X|\\s+Total paid|$)',
                            flags: 'g',
                            fields: ['quantity:int', 'name:string'],
                        },
                    ],
                },
            ],
            validation: [{ type: 'field_present', fields: ['orderId', 'totalPaid'] }],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── HDFC Bank Transaction Alerts (HTML, declarative) ──────────────────

    {
        slug: 'hdfc_upi_alert',
        name: 'HDFC Bank UPI Transaction Alert',
        provider: 'hdfc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'alerts@hdfcbank.net',
            subject: '/account update|UPI txn|Credit Card|debited via/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'amount',
                    type: 'amount',
                    required: true,
                    extractors: [
                        { type: 'regex', pattern: 'Rs\\.?\\s?([\\d,.]+)\\s+(?:is\\s+successfully\\s+|has been\\s+|is\\s+)(?:debited|credited)', group: 1 },
                        { type: 'regex', pattern: 'Card ending \\d+\\s+for\\s+Rs\\s+([\\d,.]+)', group: 1 },
                    ],
                },
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    extractors: [
                        { type: 'regex', pattern: '(?:is\\s+successfully\\s+|has been\\s+|is\\s+)(debited|credited)', flags: 'i', group: 1 },
                    ],
                },
                {
                    name: 'account',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: '(?:to|from)\\s+(?:your\\s+)?account\\s+\\*\\*(\\d+)', group: 1 },
                        { type: 'regex', pattern: 'Credit Card ending\\s+(\\d+)', group: 1 },
                    ],
                },
                {
                    name: 'vpa',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'VPA\\s+(\\S+@\\S+)', group: 1 }],
                },
                {
                    name: 'payeeName',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: 'VPA\\s+\\S+@\\S+\\s+([A-Z][A-Z\\s]+?)\\s+on\\s+\\d', group: 1 },
                    ],
                },
                {
                    name: 'merchant',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: 'at\\s+(.+?)\\s+on\\s+\\d', group: 1 },
                        { type: 'regex', pattern: 'towards\\s+(.+?)\\s+on\\s+\\d', group: 1 },
                    ],
                },
                {
                    name: 'date',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: 'on\\s+(\\d{2}-\\d{2}-\\d{2,4})', group: 1 },
                        { type: 'regex', pattern: 'on\\s+(\\d{2}-\\d{2}-\\d{4}\\s+\\d{2}:\\d{2}:\\d{2})', group: 1 },
                        { type: 'regex', pattern: 'on\\s+(\\d{1,2}\\s+\\w{3},\\s+\\d{4})', group: 1 },
                    ],
                },
                {
                    name: 'upiRef',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'reference number is\\s+(\\d+)', group: 1 }],
                },
                {
                    name: 'authCode',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Authorization code[:\\-]+\\s*(\\w+)', group: 1 }],
                },
                {
                    name: 'availableBalance',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'available balance.*?Rs\\s+([\\d,.]+)', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['amount'] }],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Rapido (HTML, declarative) ────────────────────────────────────────

    {
        slug: 'rapido_ride',
        name: 'Rapido Ride Invoice',
        provider: 'rapido',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'shoutout@rapido.bike',
            subject: '/invoice|trip with rapido/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'rideId',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Ride ID\\s+(RD\\d+)', group: 1 }],
                },
                {
                    name: 'rideTime',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Time of Ride\\s+(.+?)\\s+Total', group: 1 }],
                },
                {
                    name: 'totalAmount',
                    type: 'amount',
                    required: true,
                    extractors: [
                        { type: 'regex', pattern: 'Total\\s+₹\\s*([\\d,.]+)', group: 1 },
                        { type: 'regex', pattern: 'Selected Price\\s+₹\\s*([\\d,.]+)', group: 1 },
                    ],
                },
                {
                    name: 'distance',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '([\\d.]+\\s*kms?)\\s+DISTANCE', flags: 'i', group: 1 }],
                },
                {
                    name: 'duration',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '([\\d.]+\\s*mins?)\\s+DURATION', flags: 'i', group: 1 }],
                },
                {
                    name: 'rideCharge',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Ride Charge\\s+₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'bookingFees',
                    type: 'amount',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Booking Fees.*?₹\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'paymentMethod',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'You Paid Using\\s+(\\w+)', group: 1 }],
                },
                {
                    name: 'pickup',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'DISTANCE.*?DURATION\\s+(.+?)\\s{2,}', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['rideId', 'totalAmount'] }],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Licious (HTML, declarative) ───────────────────────────────────────

    {
        slug: 'licious_order',
        name: 'Licious Order',
        provider: 'licious',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply@licious.com',
            subject: '/order/i',
        },
        source: 'body_html',
        strategy: 'code',
        codeModule: 'licious-order',
        variants: [],
        domain: 'transaction',
    },

    // ── Google Play (HTML, declarative) ───────────────────────────────────

    {
        slug: 'google_play_receipt',
        name: 'Google Play Order Receipt',
        provider: 'google',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'googleplay-noreply@google.com',
            subject: '/order receipt/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'orderNumber',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Order number:\\s*(\\S+)', group: 1 }],
                },
                {
                    name: 'orderDate',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Order date:\\s*(.+?)(?:\\s+Your account|$)', group: 1 }],
                },
                {
                    name: 'account',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Your account:\\s*(\\S+)', group: 1 }],
                },
                {
                    name: 'itemName',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Item\\s+Price\\s+(.+?)\\s+\\(by', group: 1 }],
                },
                {
                    name: 'total',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Total:\\s*(₹[\\d,.]+\\S*)', group: 1 }],
                },
                {
                    name: 'gst',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Includes GST of\\s*(₹[\\d,.]+)', group: 1 }],
                },
                {
                    name: 'paymentMethod',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Payment method:\\s*(.+?)(?:\\s+By subscribing|$)', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['orderNumber', 'total'] }],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Apartment Maintenance (HTML, declarative) ─────────────────────────

    {
        slug: 'apartment_maintenance',
        name: 'Apartment Maintenance Payment',
        provider: 'apartment',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'do-not-reply@rank1infotech.com',
            subject: '/payment received/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'date',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Date of Receipt:\\s*(\\d{2}-\\w+-\\d{4})', group: 1 }],
                },
                {
                    name: 'paymentType',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '(Maintenance Payment Received)', flags: 'i', group: 1 }],
                },
                {
                    name: 'amount',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Amount Received\\s+([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'apartment',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'apartment\\s*#\\s*(\\S+)', flags: 'i', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['amount'] }],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── PhonePe (encrypted PDF, declarative) ────────────────────────────

    {
        slug: 'phonepe_statement',
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
            passwordStrategy: ['{phone}'],
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
                                '([A-Z][a-z]{2} \\d{1,2}, \\d{4})\\s+(\\d{1,2}:\\d{2} [AP]M)\\s+(Paid to|Received from|Money added to)\\s+(.+?)\\s+Transaction ID : (\\S+)\\s+UTR No : (\\S+)\\s+(?:Paid by|Debited from|Credited to) (XX\\d+)\\s+(Debit|Credit)\\s+INR\\s*([\\d,.]+)',
                            flags: 'g',
                            fields: [
                                'date:string',
                                'time:string',
                                'direction:string',
                                'payee:string',
                                'transactionId:string',
                                'utrNo:string',
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
        domain: 'statement',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // INVESTMENT PROVIDERS
    // ═══════════════════════════════════════════════════════════════════════

    // ── Zerodha Coin MF Redemption (HTML, declarative) ────────────────────

    {
        slug: 'zerodha_coin_redemption',
        name: 'Zerodha Coin MF Redemption Report',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'alerts@mailer.zerodha.com',
            subject: '/Redemption report/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'clientId',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Hi\\s+\\w+\\s+\\((\\w+)\\)', group: 1 }],
                },
                {
                    name: 'date',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Redemption report\\s*-\\s*(\\d{2}-\\d{2}-\\d{4})', group: 1 }],
                },
            ],
            arrays: [
                {
                    name: 'redemptions',
                    type: 'string',
                    required: true,
                    extractors: [
                        {
                            type: 'regex_repeat',
                            pattern: "B'(.+?)'\\s+(T\\d+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+Rs\\.\\s*([\\d,.]+)\\s+Rs\\.\\s*([\\d,.]+)\\s+Rs\\.\\s*([\\d,.]+)",
                            flags: 'g',
                            fields: ['fund:string', 'settlementType:string', 'units:float', 'nav:float', 'amount:amount', 'exitLoad:amount', 'stt:amount'],
                        },
                    ],
                },
            ],
            validation: [{ type: 'min_items', arrayField: 'redemptions', minCount: 1 }],
        },
        variants: [],
        domain: 'investment',
    },

    // ── Zerodha Coin MF Sell Order (HTML, declarative) ────────────────────

    {
        slug: 'zerodha_coin_sell_order',
        name: 'Zerodha Coin MF Sell Order',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'alerts@mailer.zerodha.com',
            subject: '/Order placement successful/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'clientId',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Hi\\s+\\w+\\s+\\((\\w+)\\)', group: 1 }],
                },
                {
                    name: 'orderType',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Your\\s+(sell|buy)\\s+order', flags: 'i', group: 1 }],
                },
                {
                    name: 'fund',
                    type: 'string',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Fund\\s+Quantity\\s+(.+?)\\s+[\\d.]+', group: 1 }],
                },
                {
                    name: 'quantity',
                    type: 'float',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'Fund\\s+Quantity\\s+.+?\\s+([\\d.]+)', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['fund', 'quantity'] }],
        },
        variants: [],
        domain: 'investment',
    },

    // ── Zerodha Demat AMC Charge (HTML, declarative) ──────────────────────

    {
        slug: 'zerodha_demat_amc',
        name: 'Zerodha Demat AMC Charge',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'alerts@mailer.zerodha.com',
            subject: '/maintenance charge/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'clientId',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: 'for\\s+([A-Z]{2}\\d+)', group: 1 },
                        { type: 'regex', pattern: 'Dear\\s+(\\w+)', group: 1 },
                    ],
                },
                {
                    name: 'totalAmount',
                    type: 'string',
                    required: true,
                    extractors: [
                        { type: 'regex', pattern: 'due for\\s+₹([\\d,.]+)', group: 1 },
                        { type: 'regex', pattern: 'due for\\s+Rs\\.\\s*₹?([\\d,.]+)', group: 1 },
                    ],
                },
                {
                    name: 'baseAmount',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: '\\(₹([\\d,.]+)\\s*\\+\\s*GST\\)', group: 1 }],
                },
                {
                    name: 'period',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'from\\s+(\\d{2}-\\d{2}-\\d{4}\\s+to\\s+\\d{2}-\\d{2}-\\d{4})', group: 1 }],
                },
                {
                    name: 'chargeType',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'towards\\s+(.+?)\\s+(?:from|and)', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['totalAmount'] }],
        },
        variants: [],
        domain: 'investment',
    },

    // ── KFintech MF Valuation (HTML, declarative) ─────────────────────────

    {
        slug: 'kfintech_mf_valuation',
        name: 'KFintech MF Month-End Valuation',
        provider: 'kfintech',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/mfservice@kfintech\\.com|kfpl\\.mfservice@kfintech\\.com/i',
            subject: '/Month-end Valuations/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'fundHouse',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Greetings from\\s+(.+?)!', group: 1 }],
                },
                {
                    name: 'folio',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Folio\\s*:?\\s*(\\d+)', group: 1 }],
                },
                {
                    name: 'valuationDate',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Valuations? as of\\s+(\\d{2}/\\d{2}/\\d{4})', group: 1 }],
                },
                {
                    name: 'schemeName',
                    type: 'string',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: "NAV'?s?\\s*(.+?)([\\d,]+\\.\\d{2})", group: 1 },
                    ],
                },
                {
                    name: 'valuation',
                    type: 'amount',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: "NAV'?s?\\s*.+?([\\d,]+\\.\\d{2})", group: 1 },
                    ],
                },
                {
                    name: 'nav',
                    type: 'float',
                    required: false,
                    extractors: [
                        { type: 'regex', pattern: "NAV'?s?\\s*.+?[\\d,]+\\.\\d{2}([\\d.]+)", group: 1 },
                    ],
                },
            ],
            validation: [{ type: 'field_present', fields: ['valuationDate'] }],
        },
        variants: [],
        domain: 'investment',
    },

    // ── KFintech MF Redemption (HTML, declarative) ────────────────────────

    {
        slug: 'kfintech_mf_redemption',
        name: 'KFintech MF Redemption Confirmation',
        provider: 'kfintech',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/mfservice@kfintech\\.com|kfpl\\.mfservice@kfintech\\.com/i',
            subject: '/Redemption transaction/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                {
                    name: 'fundHouse',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'Greetings from\\s+(.+?)!', group: 1 }],
                },
                {
                    name: 'schemeName',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'redemption transaction in\\s+(.+?)\\s+dated', group: 1 }],
                },
                {
                    name: 'date',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'dated\\s+(\\d{2}/\\d{2}/\\d{4})', group: 1 }],
                },
                {
                    name: 'folio',
                    type: 'string',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'folio number\\s+(\\d+)', group: 1 }],
                },
                {
                    name: 'amount',
                    type: 'amount',
                    required: true,
                    extractors: [{ type: 'regex', pattern: 'for Rs\\.\\s*([\\d,.]+)', group: 1 }],
                },
                {
                    name: 'nav',
                    type: 'float',
                    required: false,
                    extractors: [{ type: 'regex', pattern: 'NAV\\s+([\\d.]+)', group: 1 }],
                },
            ],
            validation: [{ type: 'field_present', fields: ['amount'] }],
        },
        variants: [],
        domain: 'investment',
    },

    // ── Zerodha Weekly Equity Statements (PDF) ────────────────────────────

    {
        slug: 'zerodha_weekly_equity',
        name: 'Zerodha Weekly Equity Statement',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply-account-statement@reportsmailer.zerodha.net',
            subject: '/Weekly Equity Statements/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/weekly-.*\\.pdf$/i',
            mimeTypes: ['application/pdf'],
        },
        strategy: 'code',
        codeModule: 'zerodha-equity',
        variants: [],
        domain: 'investment',
    },

    // ── Zerodha Quarterly Equity Statement (PDF) ──────────────────────────

    {
        slug: 'zerodha_quarterly_equity',
        name: 'Zerodha Quarterly Equity Statement',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply-account-statement@reportsmailer.zerodha.net',
            subject: '/Quarterly Equity Account Statement/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/quarterly-.*\\.pdf$/i',
            mimeTypes: ['application/pdf'],
        },
        strategy: 'code',
        codeModule: 'zerodha-equity',
        variants: [],
        domain: 'investment',
    },

    // ── Zerodha Monthly Demat Holdings (PDF) ──────────────────────────────

    {
        slug: 'zerodha_demat_holdings',
        name: 'Zerodha Monthly Demat Transaction & Holding Statement',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply-transaction-with-holding-statement@reportsmailer.zerodha.net',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/transaction-with-holding.*\\.pdf$/i',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{name:first4}{dob:DDMM}', '{dob:DDMMYYYY}'],
        },
        strategy: 'code',
        codeModule: 'zerodha-demat',
        variants: [],
        domain: 'investment',
    },

    // ── Zerodha Retention Statement (PDF) ─────────────────────────────────

    {
        slug: 'zerodha_retention',
        name: 'Zerodha Quarterly Retention Statement',
        provider: 'zerodha',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply-retention-statements@reportsmailer.zerodha.net',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/retention.*\\.pdf$/i',
            mimeTypes: ['application/pdf'],
        },
        strategy: 'code',
        codeModule: 'zerodha-equity',
        variants: [],
        domain: 'investment',
    },

    // ── ICICI Securities Equity Statement (PDF) ───────────────────────────

    {
        slug: 'icicisec_equity_statement',
        name: 'ICICI Securities Equity Transaction Statement',
        provider: 'icicisecurities',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'service@icicisecurities.com',
            subject: '/Equity Transaction Statement|Statement of Accounts|Statement of accounts|Margin.*Statement|Provisional Margin|Contract Note|Trade confirmations|Global Transaction Statement|Mutual Fund Account Statement|NSE-STT Statement/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf', 'application/octet-stream'],
            passwordStrategy: ['{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'icici-sec-equity',
        variants: [],
        domain: 'investment',
    },

    // ── INDmoney Weekly Statement (PDF) ───────────────────────────────────

    {
        slug: 'indmoney_weekly_statement',
        name: 'INDmoney Weekly Statement of Funds & Securities',
        provider: 'indmoney',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'statements@transactions.indmoney.com',
            subject: '/Weekly Statement|Retention Statement|Bill Cum Transaction/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{dob:DDMMYYYY}', '{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'indmoney-statement',
        variants: [],
        domain: 'investment',
    },

    // ── BSE Funds/Securities Balance (PDF) ────────────────────────────────

    {
        slug: 'bse_funds_balance',
        name: 'BSE Funds & Securities Balance Report',
        provider: 'bse',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'info@bseindia.in',
            subject: '/Funds.*Securities Balance/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{dob:DDMMYYYY}', '{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'bse-funds-balance',
        variants: [],
        domain: 'investment',
    },

    // ── NSDL CAS - Consolidated Account Statement (PDF) ───────────────────

    {
        slug: 'nsdl_cas',
        name: 'NSDL Consolidated Account Statement',
        provider: 'nsdl',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'nsdl-cas@nsdl.co.in',
            subject: '/NSDL CAS/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'filename',
            filenamePattern: '/NSDLe-CAS.*\\.PDF$/i',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{dob:DDMMYYYY}', '{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'nsdl-cas',
        variants: [],
        domain: 'investment',
    },

    // ── Marketing / Newsletters (recognized, no data to parse) ──────────

    {
        slug: 'hdfc_marketing',
        name: 'HDFC Bank Marketing',
        provider: 'hdfc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^inform?ations?@(?:hdfcbank\\.net|mailers\\.hdfcbank\\.net)$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'groww_newsletter',
        name: 'Groww Newsletter / Digest',
        provider: 'groww',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/noreply@(?:digest\\.groww\\.in|groww\\.in|daily\\.digest\\.groww\\.in|dailydigest\\.groww\\.in)$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'makemytrip_marketing',
        name: 'MakeMyTrip Marketing',
        provider: 'makemytrip',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/noreply@zen-?makemytrip\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'adplist_booking',
        name: 'ADPList Booking',
        provider: 'adplist',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'mail@adplistapp.org' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'sbicard_offers',
        name: 'SBI Card Offers',
        provider: 'sbicard',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'offers@offers.sbicard.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'zomato_marketing',
        name: 'Zomato Marketing',
        provider: 'zomato',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'noreply@mailers.zomato.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'bigbasket_marketing',
        name: 'BigBasket Marketing',
        provider: 'bigbasket',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^(?:alert|noreply)@(?:info\.|notify\\.)?bigbasket\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'nykaa_marketing',
        name: 'Nykaa Marketing',
        provider: 'nykaa',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'noreply@nykaa.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'paytm_marketing',
        name: 'Paytm Marketing',
        provider: 'paytm',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^(?:mail@info\\.paytm\\.com|noreply@paytmoffers\\.in)$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'booking_com',
        name: 'Booking.com Messages',
        provider: 'booking',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/booking\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'urbanladder_marketing',
        name: 'Urban Ladder Marketing',
        provider: 'urbanladder',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'no-reply@mailer.urbanladder.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'linkedin_alerts',
        name: 'LinkedIn Alerts',
        provider: 'linkedin',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/linkedin\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'kfintech_mf_disclosure',
        name: 'KFintech MF Portfolio Disclosure',
        provider: 'kfintech',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/@kfintech\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'camsonline_mf_disclosure',
        name: 'CAMS MF Portfolio Disclosure',
        provider: 'cams',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/@camsonline\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'amazon_misc',
        name: 'Amazon Misc Notifications',
        provider: 'amazon',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^(?:payments-update|services|store-news|prime|account-update)@amazon\\.in$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'nsdl_notifications',
        name: 'NSDL Notifications & Newsletters',
        provider: 'nsdl',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^(?:communications|noreply|evoting|enotices)@nsdl\\.(?:co\\.in|com)$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'newsletter_misc',
        name: 'Miscellaneous Newsletters',
        provider: 'misc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^newsletter@(?:economictimesnews|ettech|etretail|ethealthworld|etprime|etbrandequity)\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'amex_marketing',
        name: 'American Express Marketing',
        provider: 'amex',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'americanexpress@email.americanexpress.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'bajaj_finance',
        name: 'Bajaj Finance Notifications',
        provider: 'bajaj',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'info@bajajfinance.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'rize_productivity',
        name: 'Rize Productivity Reports',
        provider: 'rize',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'notification@rize.io' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'tata_neu_marketing',
        name: 'Tata Neu Loan Marketing',
        provider: 'tataneu',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'noreply@tataneuloan.tataneu.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'moneycontrol_alerts',
        name: 'Moneycontrol Alerts',
        provider: 'moneycontrol',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'alerts@mailer.moneycontrol.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'icicisec_marketing',
        name: 'ICICI Securities Marketing',
        provider: 'icicisecurities',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'service@service.icicisecurities.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'failed_payments_stripe',
        name: 'Stripe Failed Payments',
        provider: 'stripe',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^failed-payments/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [
            { name: 'amount', extractor: { type: 'regex', pattern: '(?:\\$|₹|INR)\\s*([\\d,]+\\.\\d{2})' } },
            { name: 'merchant', extractor: { type: 'regex', pattern: 'payment to\\s+(.+?)\\s+was' } },
        ] },
        variants: [],
        domain: 'transaction',
    },

    {
        slug: 'misc_marketing_small',
        name: 'Misc Small Sender Marketing',
        provider: 'misc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^(?:discover@airbnb|info@seabeachhostel|update\\.en@em\\.talabat|info@n\\.myprotein|support@namecheap|noreply@communication\\.porter|billing@whoop|booking@(?:klook|alert\\.gozo)|scapia_info@federalbank|support@speechify|contact@boardgamearena|createwealth@retail\\.equentis|noreply@newsletter\\.zerodha|no-reply@amazonpay|bookings@hostelworld|noreply@update\\.goibibo|newsletter@(?:reply\\.agoda|notifications\\.lumosity)|hello@(?:chess|namecheap|the-captable)|no-reply@youtube|no-reply@kuvera|email@email\\.playstation|support@eightsleep|store\\+|noreply@tm\\.openai|noreply@darwinbox|service@en\\.lenskart|sbi@communications\\.sbi|noreply@redditmail|automated@airbnb|prime@amazon|account-update@amazon)/' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'beehiiv_newsletters',
        name: 'Beehiiv Newsletters',
        provider: 'beehiiv',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/@mail\\.beehiiv\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'substack_newsletters',
        name: 'Substack Newsletters',
        provider: 'substack',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/@substack\\.com$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'apartment_misc',
        name: 'Apartment Society Misc',
        provider: 'apartment',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: 'do-not-reply@rank1infotech.com' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'swiggy_misc',
        name: 'Swiggy Misc Notifications',
        provider: 'swiggy',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/noreply@swiggy\\.in|no-reply@swiggy\\.in/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'cred_misc',
        name: 'CRED Misc Notifications',
        provider: 'cred',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/cred\\.club$/i' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    {
        slug: 'ecommerce_misc',
        name: 'E-commerce Order Tracking',
        provider: 'misc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: { fromAddress: '/^(?:no-reply@mail\\.1mg|info@net\\.shiprocket|listen@thewholetruthfoods|care@quitci|payment-report@payu|no-reply@agoda|esim@gohub|noreply@cult\\.fit|support-noreply@klook|mailers@marketing\\.goindigo|orders@savaari|do-not-reply@dominos|dining@district|noreply@asego|info@tripleplay|contactwwod@myhq|bookings@community\\.myhq|noreply@myhq|notice@e\\.godaddy|no-reply@hudle|billing@(?:apify|replicate)|receipts@replicate|payment-report@payu|notification@jio|tickets@bookmyshow|no-reply@mail\\.1mg|reachus@konfhub|donotreply@vfsglobal|noreply@tdacservices|paynet@billdesk|connor@pilotplans|morning@finshots|receipt@chess|save@tax2win|hi@cursor|contact@waalaxy|hey@mail\\.granola|noreply-purchases@youtube|sm\\.profiles@yourstory|payments-noreply@google|cbsalerts\\.sbi@alerts\\.sbi|reply@txn-email\\.playstation|dining@zomato|buyonline@nivabupa|support@skillboxes)\\./' },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: { preprocessor: 'cheerio_text', fields: [{ name: 'type', extractor: { type: 'regex', pattern: '(.)' } }] },
        variants: [],
        domain: 'marketing',
    },

    // ── CRED Bill Reminders (body, declarative) ──────────────────────────

    {
        slug: 'cred_bill_reminder',
        name: 'CRED Credit Card Bill Reminder',
        provider: 'cred',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'protect@cred.club',
            subject: '/credit card bill is due/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'bank', extractor: { type: 'regex', pattern: '(\\w[\\w\\s]+)\\s*\\.{3,}\\s*xxxx' } },
                { name: 'cardLast4', extractor: { type: 'regex', pattern: 'xxxx\\s*(\\d{4})' } },
                { name: 'dueDate', extractor: { type: 'regex', pattern: 'due by\\s+([A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4})' } },
                { name: 'totalDue', extractor: { type: 'regex', pattern: 'total due\\s*₹([\\d,]+\\.?\\d*)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Razorpay Payment Receipts (body, declarative) ────────────────────

    {
        slug: 'razorpay_payment',
        name: 'Razorpay Payment Receipt',
        provider: 'razorpay',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'no-reply@razorpay.com',
            subject: '/Payment successful|Requesting payment|Refund successful/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'merchant', extractor: { type: 'regex', pattern: 'Payment (?:successful|Link) (?:for|from)\\s+(.+?)(?:\\s+Payment|\\s+has sent|$)' } },
                { name: 'amount', extractor: { type: 'regex', pattern: 'INR\\s+([\\d,]+\\.?\\d*)' } },
                { name: 'receiptId', extractor: { type: 'regex', pattern: 'Receipt:\\s*(\\S+)' } },
                { name: 'type', extractor: { type: 'regex', pattern: '(Payment successful|Refund successful|Requesting payment)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Apartment Maintenance (body, declarative) ────────────────────────

    {
        slug: 'apartment_maintenance_bill',
        name: 'Apartment Maintenance Bill & Payment',
        provider: 'apartment',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'do-not-reply@rank1infotech.com',
            subject: '/Maintenance Bill|Payment Received/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'apartment', extractor: { type: 'regex', pattern: 'apartment (?:#|No\\.?)\\s*([\\w-]+)' } },
                { name: 'amount', extractor: { type: 'regex', pattern: 'Rs\\.?\\s*([\\d,]+\\.?\\d*)' } },
                { name: 'quarter', extractor: { type: 'regex', pattern: 'Quarter-(\\d),\\s*FY\\s*([\\d-]+)' } },
                { name: 'dueDate', extractor: { type: 'regex', pattern: '[Dd]ue [Dd]ate:\\s*([\\d-]+\\w*-?\\d*)' } },
                { name: 'receiptDate', extractor: { type: 'regex', pattern: 'Date of Receipt:\\s*([\\d-]+\\w*-?\\d*)' } },
                { name: 'type', extractor: { type: 'regex', pattern: '(Maintenance Bill|Payment Received|Payment Acknowledgement)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── BillDesk HDFC Bill Pay (body, declarative) ───────────────────────

    {
        slug: 'billdesk_hdfc',
        name: 'HDFC BillDesk Bill Payment',
        provider: 'billdesk',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'hdfcbankbillpay@billdesk.in',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'billerName', extractor: { type: 'regex', pattern: 'Biller Name:\\s*(.+?)(?:CA Number|SmartPay|$)' } },
                { name: 'amount', extractor: { type: 'regex', pattern: '(?:Bill Amount|Payment Amount)[^\\d]*Rs\\.?\\)?\\s*:?\\s*([\\d,]+\\.?\\d*)' } },
                { name: 'transactionId', extractor: { type: 'regex', pattern: 'Transaction (?:Reference No|ID):\\s*(\\S+)' } },
                { name: 'paymentDate', extractor: { type: 'regex', pattern: 'Payment Date:\\s*([\\d-]+\\w*-?\\d*)' } },
                { name: 'scheduledDate', extractor: { type: 'regex', pattern: 'Scheduled Date:\\s*([\\d-]+\\w*-?\\d*)' } },
                { name: 'cardLast4', extractor: { type: 'regex', pattern: 'Card Number:\\s*(\\d{4})' } },
                { name: 'type', extractor: { type: 'regex', pattern: '(Bill Scheduled|bill payment has been processed)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Domino's Orders (body, declarative) ──────────────────────────────

    {
        slug: 'dominos_order',
        name: "Domino's Pizza Order",
        provider: 'dominos',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'do-not-reply@dominos.co.in',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'orderId', extractor: { type: 'regex', pattern: 'Order No\\.\\s*([\\d|\\-:\\s]+)' } },
                { name: 'orderTotal', extractor: { type: 'regex', pattern: 'Order TotalRs\\.([\\d,]+\\.?\\d*)' } },
                { name: 'paymentMode', extractor: { type: 'regex', pattern: 'Payment Mode(.+?)Order Type' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Dividend Intimations (body, declarative) ─────────────────────────

    {
        slug: 'dividend_apollo',
        name: 'Apollo Hospitals Dividend Intimation',
        provider: 'apollo',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'clientservice@integratedregistry.in',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'company', extractor: { type: 'regex', pattern: '^([A-Z][A-Z\\s]+LIMITED)' } },
                { name: 'dividendType', extractor: { type: 'regex', pattern: 'payment of (\\w+ dividend)' } },
                { name: 'financialYear', extractor: { type: 'regex', pattern: 'financial year\\s*(\\d{4}-\\d{2,4})' } },
                { name: 'grossAmount', extractor: { type: 'regex', pattern: 'Gross Dividend Amount[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'tds', extractor: { type: 'regex', pattern: 'TDS[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'netAmount', extractor: { type: 'regex', pattern: 'Net Dividend Amount[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'shares', extractor: { type: 'regex', pattern: 'No\\.? of (?:Equity )?Shares[^\\d]*(\\d+)' } },
                { name: 'perShare', extractor: { type: 'regex', pattern: 'per (?:equity )?share[^\\d]*(\\d[\\d,.]+)' } },
            ],
        },
        variants: [],
        domain: 'investment',
    },

    {
        slug: 'dividend_polycab',
        name: 'Polycab Dividend Intimation',
        provider: 'polycab',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'kfpl.cs.poly@kfintech.com',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'company', extractor: { type: 'regex', pattern: '^([A-Z][A-Z\\s]+LIMITED)' } },
                { name: 'financialYear', extractor: { type: 'regex', pattern: 'Dividend\\s*(\\d{4}-\\d{2,4})' } },
                { name: 'grossAmount', extractor: { type: 'regex', pattern: 'Gross Amount[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'tds', extractor: { type: 'regex', pattern: 'TDS[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'netAmount', extractor: { type: 'regex', pattern: 'Net Amount[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'shares', extractor: { type: 'regex', pattern: 'No\\.? of Shares[^\\d]*(\\d+)' } },
            ],
        },
        variants: [],
        domain: 'investment',
    },

    {
        slug: 'dividend_trent',
        name: 'Trent Dividend Intimation',
        provider: 'trent',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/trentltd\\.dividend@/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'company', extractor: { type: 'regex', pattern: '^(Trent Limited)' } },
                { name: 'financialYear', extractor: { type: 'regex', pattern: 'Financial Year ended\\s*(\\d.+?\\d{4})' } },
                { name: 'dividendPerShare', extractor: { type: 'regex', pattern: 'Rs\\.?\\s*([\\d.]+)\\s*(?:per|/-\\s*per)' } },
                { name: 'grossAmount', extractor: { type: 'regex', pattern: 'Gross.*?Amount[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'tds', extractor: { type: 'regex', pattern: 'TDS[^\\d]*(\\d[\\d,.]+)' } },
                { name: 'netAmount', extractor: { type: 'regex', pattern: 'Net.*?Amount[^\\d]*(\\d[\\d,.]+)' } },
            ],
        },
        variants: [],
        domain: 'investment',
    },

    // ── Zomato Refunds (body, declarative) ───────────────────────────────

    {
        slug: 'zomato_refund',
        name: 'Zomato Refund',
        provider: 'zomato',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@zomato.com',
            subject: '/Refund (?:processed|initiated)/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'orderId', extractor: { type: 'regex', pattern: 'order\\s*#\\s*(\\d+)' } },
                { name: 'refundAmount', extractor: { type: 'regex', pattern: '₹\\s*([\\d,]+\\.?\\d*)' } },
                { name: 'type', extractor: { type: 'regex', pattern: '(Refund processed|Refund initiated)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Amazon Order Confirmations (body, declarative) ───────────────────

    {
        slug: 'amazon_order',
        name: 'Amazon Order Confirmation',
        provider: 'amazon',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'auto-confirm@amazon.in',
        },
        source: 'body_text',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'none',
            fields: [
                { name: 'orderId', extractor: { type: 'regex', pattern: 'Order #(\\d{3}-\\d{7}-\\d{7})' } },
                { name: 'orderTotal', extractor: { type: 'regex', pattern: 'Order Total:\\s*(?:INR|Rs\\.?)\\s*([\\d,]+\\.?\\d*)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Amazon Shipment Tracking (body, declarative) ─────────────────────

    {
        slug: 'amazon_shipment',
        name: 'Amazon Shipment Notification',
        provider: 'amazon',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'shipment-tracking@amazon.in',
        },
        source: 'body_text',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'none',
            fields: [
                { name: 'orderId', extractor: { type: 'regex', pattern: 'Order #(\\d{3}-\\d{7}-\\d{7})' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Amazon Delivery Updates (body, declarative) ──────────────────────

    {
        slug: 'amazon_delivery',
        name: 'Amazon Delivery Update',
        provider: 'amazon',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'order-update@amazon.in',
        },
        source: 'body_text',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'none',
            fields: [
                { name: 'orderId', extractor: { type: 'regex', pattern: 'orderId=(\\d{3}-\\d{7}-\\d{7})' } },
                { name: 'status', extractor: { type: 'regex', pattern: '(delivered|cancelled|Delivery attempted)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── HDFC SmartStatement Notification (body, declarative) ─────────────

    {
        slug: 'hdfc_smart_statement',
        name: 'HDFC Bank SmartStatement Notification',
        provider: 'hdfc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'hdfcbanksmartstatement@hdfcbank.net',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'accountLast4', extractor: { type: 'regex', pattern: '\\*{3}(\\d{4})' } },
                { name: 'period', extractor: { type: 'regex', pattern: 'period\\s+(.+?)\\s*$' } },
            ],
        },
        variants: [],
        domain: 'statement',
    },

    // ── Amex Statement Notification (body, declarative) ──────────────────

    {
        slug: 'amex_statement_notification',
        name: 'American Express Statement Notification',
        provider: 'amex',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'onlinestatements@welcome.americanexpress.com',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'type', extractor: { type: 'regex', pattern: '(Online Card statement)' } },
            ],
        },
        variants: [],
        domain: 'statement',
    },

    // ── ITR Intimation (body, declarative) ───────────────────────────────

    {
        slug: 'itr_intimation',
        name: 'Income Tax Return Intimation',
        provider: 'incometax',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/cpc\\.incometax\\.gov\\.in$/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'pan', extractor: { type: 'regex', pattern: 'PAN\\s*:?\\s*([A-Z]{5}\\d{4}[A-Z])' } },
                { name: 'assessmentYear', extractor: { type: 'regex', pattern: 'A\\.?Y\\.?\\s*:?\\s*(\\d{4}-\\d{2,4})' } },
                { name: 'ackNo', extractor: { type: 'regex', pattern: 'Ack\\.?\\s*No\\.?\\s*:?\\s*(\\d+)' } },
                { name: 'status', extractor: { type: 'regex', pattern: '(no payment due|has been successfully submitted)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── SBI Interest Certificate (PDF) ───────────────────────────────────

    {
        slug: 'sbi_interest_cert',
        name: 'SBI Interest Certificate',
        provider: 'sbi',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'cbssbi.info@alerts.sbi.co.in',
            subject: '/INTEREST CERTIFICATE/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf', 'application/octet-stream'],
            passwordStrategy: ['{phone:last5}{dob:DDMMYY}'],
        },
        strategy: 'code',
        codeModule: 'sbi-interest-cert',
        variants: [],
        domain: 'statement',
    },

    // ── NSE Funds/Securities Balance (PDF) ───────────────────────────────

    {
        slug: 'nse_funds_balance',
        name: 'NSE Funds & Securities Balance',
        provider: 'nse',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'nse_alerts@nse.co.in',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{dob:DDMMYYYY}', '{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'nse-funds-balance',
        variants: [],
        domain: 'investment',
    },

    // ── IndiGo Tax Invoice (PDF) ─────────────────────────────────────────

    {
        slug: 'indigo_tax_invoice',
        name: 'IndiGo Tax Invoice',
        provider: 'indigo',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '6egstinvoice@goindigo.in',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
        },
        strategy: 'code',
        codeModule: 'indigo-tax-invoice',
        variants: [],
        domain: 'transaction',
    },

    // ── NSE Trade Confirmations (PDF) ────────────────────────────────────

    {
        slug: 'nse_trade_confirmation',
        name: 'NSE Trade Confirmation',
        provider: 'nse',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'nse-direct@nse.co.in',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{dob:DDMMYYYY}', '{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'nse-trade-confirmation',
        variants: [],
        domain: 'investment',
    },

    // ── ICICI Bank Demat Statement (PDF) ─────────────────────────────────

    {
        slug: 'icici_demat_statement',
        name: 'ICICI Bank Demat Statement',
        provider: 'icicibank',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'customercare@icicibank.com',
            subject: '/Demat Account/i',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf'],
            passwordStrategy: ['{pan}', '{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'icici-demat',
        variants: [],
        domain: 'investment',
    },

    // ── Stripe Receipts (PDF) ────────────────────────────────────────────

    {
        slug: 'stripe_receipt',
        name: 'Stripe Payment Receipt',
        provider: 'stripe',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: '/^invoice\\+statements.*@stripe\\.com$/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'merchant', extractor: { type: 'regex', pattern: 'receipt from\\s+(.+?)\\s+#' } },
                { name: 'receiptNo', extractor: { type: 'regex', pattern: '#([\\d-]+)' } },
                { name: 'amount', extractor: { type: 'regex', pattern: '(?:Amount paid|Total)\\s*(?:₹|\\$|INR)?\\s*([\\d,]+\\.\\d{2})' } },
                { name: 'date', extractor: { type: 'regex', pattern: 'Date paid\\s+([\\w\\s,]+\\d{4})' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Anthropic Receipts ───────────────────────────────────────────────

    {
        slug: 'anthropic_receipt',
        name: 'Anthropic Payment Receipt',
        provider: 'anthropic',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'invoice+statements@mail.anthropic.com',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'receiptNo', extractor: { type: 'regex', pattern: '#([\\d-]+)' } },
                { name: 'amount', extractor: { type: 'regex', pattern: '(?:Amount paid|Total)\\s*(?:₹|\\$|INR)?\\s*([\\d,]+\\.\\d{2})' } },
                { name: 'date', extractor: { type: 'regex', pattern: 'Date paid\\s+([\\w\\s,]+\\d{4})' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── HDFC SmartEMI Loan (PDF) ─────────────────────────────────────────

    {
        slug: 'hdfc_smart_emi',
        name: 'HDFC SmartEMI Loan Amortization',
        provider: 'hdfc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'termloans.creditcard@hdfcbank.net',
        },
        source: 'pdf',
        attachment: {
            pickBy: 'mimeType',
            mimeTypes: ['application/pdf', 'application/octet-stream'],
            passwordStrategy: ['{name:first4}{dob:DDMM}'],
        },
        strategy: 'code',
        codeModule: 'hdfc-smart-emi',
        variants: [],
        domain: 'transaction',
    },

    // ── Zomato Dineout (body, declarative) ───────────────────────────────

    {
        slug: 'zomato_dineout',
        name: 'Zomato Dineout Table Booking',
        provider: 'zomato',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'dining@zomato.com',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'restaurant', extractor: { type: 'regex', pattern: 'Table booking at\\s+(.+?)\\s+for' } },
                { name: 'time', extractor: { type: 'regex', pattern: 'for\\s+(\\d{1,2}:\\d{2}\\s*[AP]M)' } },
                { name: 'date', extractor: { type: 'regex', pattern: '(\\d{1,2}\\s+\\w+\\s+\\d{4})' } },
                { name: 'guests', extractor: { type: 'regex', pattern: '(\\d+)\\s+guest' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── Swiggy Delivery Confirmations (body, declarative) ────────────────

    {
        slug: 'swiggy_delivery',
        name: 'Swiggy Order Delivery Confirmation',
        provider: 'swiggy',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'noreply@swiggy.in',
            subject: '/order was successfully delivered|Payment Failed/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'orderId', extractor: { type: 'regex', pattern: '[Oo]rder (?:id|No):?\\s*(\\d+)' } },
                { name: 'restaurant', extractor: { type: 'regex', pattern: 'Restaurant\\s+(.+?)\\s+(?:Your Order|Order Items)' } },
                { name: 'totalBill', extractor: { type: 'regex', pattern: 'Total Bill\\s*₹([\\d,]+\\.?\\d*)' } },
                { name: 'itemBill', extractor: { type: 'regex', pattern: 'Item Bill\\s*₹([\\d,]+\\.?\\d*)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },

    // ── HDFC Bank Alerts (non-transaction) ───────────────────────────────

    {
        slug: 'hdfc_alert_misc',
        name: 'HDFC Bank Miscellaneous Alert',
        provider: 'hdfc',
        version: 1,
        active: true,
        activeForUserIds: [],
        match: {
            fromAddress: 'alerts@hdfcbank.net',
            subject: '/validate your email|Transaction Declined|Registration successful|Verify Your Recent|Transaction reversal/i',
        },
        source: 'body_html',
        strategy: 'declarative',
        declarativeRules: {
            preprocessor: 'cheerio_text',
            fields: [
                { name: 'type', extractor: { type: 'regex', pattern: '(validate your email|Transaction Declined|Registration successful|Verify Your Recent|Transaction reversal)' } },
            ],
        },
        variants: [],
        domain: 'transaction',
    },
];
