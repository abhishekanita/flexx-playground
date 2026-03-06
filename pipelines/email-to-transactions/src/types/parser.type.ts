import type { UUID, INR, ISODateTime, ISODate } from './financial.type';

// =============================================================================
// PARSER CONFIG
// =============================================================================
//
// The complete, declarative specification for how to handle one class of email.
// One config per "email type" — e.g. one for HDFC debit alerts,
// one for CAMS SIP confirmations, one for Zerodha contract notes, etc.
//
// Stored in MongoDB so it can be updated without redeployment.
// Versioned so we know which version processed each email.

export interface ParserConfig {
    _id: string; // MongoDB ObjectId
    parser_id: string; // human-readable: 'hdfc_bank_debit_alert'
    version: number; // incremented on every update
    is_active: boolean;
    description: string;

    // Who created/last updated this config
    created_by: 'manual' | 'ai_generated';
    reviewed_by_human: boolean; // AI-generated parsers start as false
    created_at: ISODateTime;
    updated_at: ISODateTime;

    // ── STAGE 1: FILTER ───────────────────────────────────────────────
    // All conditions are ANDed. Email must pass ALL of them to match.
    filter: EmailFilter;

    // ── STAGE 2: PRE-PROCESS ──────────────────────────────────────────
    // Optional transformations on body_text before extraction runs
    preprocess?: PreprocessConfig;

    // ── STAGE 3: EXTRACT ──────────────────────────────────────────────
    // Ordered list of field extraction rules
    fields: FieldExtractor[];

    // ── STAGE 4: VALIDATE ─────────────────────────────────────────────
    // Post-extraction checks before we accept the parsed result
    validation: ValidationConfig;

    // ── STAGE 5: TRANSFORM ────────────────────────────────────────────
    // Type coercions and computed fields
    transforms: TransformConfig[];

    // ── STAGE 6: MAP ──────────────────────────────────────────────────
    // How extracted fields map to the unified Postgres schema
    output: OutputMapping;

    // ── HEALTH METRICS (maintained by the runtime) ────────────────────
    stats: ParserStats;
}

// =============================================================================
// STAGE 1 — FILTER
// =============================================================================

export interface EmailFilter {
    // Sender rules — at least one must match
    sender: SenderFilter;

    // Subject rules (optional — some parsers only filter by sender)
    subject?: SubjectFilter;

    // Body rules (optional — checked after sender/subject for perf)
    body?: BodyFilter;

    // Attachment rules
    attachments?: AttachmentFilter;

    // Exclude conditions — if any match, the email is skipped
    // e.g. exclude OTP emails that happen to come from the same sender
    exclude?: ExcludeFilter;
}

export interface SenderFilter {
    // Match by exact domain (most reliable)
    domains?: string[]; // ['hdfcbank.net']

    // Or by exact address (for senders with multiple domains)
    addresses?: string[]; // ['noreply@zerodha.com', 'contract@zerodha.com']

    // Or by regex (rare, for catch-all parsers)
    pattern?: string; // regex applied to from_address
}

export interface SubjectFilter {
    // ALL of these must appear in the subject (case-insensitive, literal strings)
    contains_all?: string[]; // ['debited', 'HDFC']

    // At least ONE must appear
    contains_any?: string[]; // ['Credit Card', 'Debit Card']

    // Subject must match this regex
    pattern?: string; // '^(Transaction Alert|Txn Alert)'

    // Subject must NOT contain these
    excludes?: string[]; // ['OTP', 'password reset']
}

export interface BodyFilter {
    // Keywords that must all appear in body_text
    contains_all?: string[];

    // At least one of these must appear
    contains_any?: string[];

    // Regex applied to body_text
    pattern?: string;

    // Which part of the body to search
    search_in?: 'text' | 'html' | 'both';
}

export interface AttachmentFilter {
    requires_pdf?: boolean;
    pdf_name_pattern?: string; // regex on filename: 'ContractNote'
    min_attachments?: number;
}

export interface ExcludeFilter {
    subject_contains?: string[]; // ['OTP', 'Login Alert', 'Password']
    body_contains?: string[]; // ['forgot password', 'verify your account']
    body_pattern?: string;
}

// =============================================================================
// STAGE 2 — PRE-PROCESS
// =============================================================================

export interface PreprocessConfig {
    // Strip HTML if body_text still has tags (some parsers prefer to work on HTML)
    strip_html?: boolean;

    // Collapse whitespace (multiple spaces/newlines → single space)
    normalize_whitespace?: boolean;

    // Replace common encoding artifacts before regex runs
    replace?: Array<{ find: string; replace: string; is_regex?: boolean }>;

    // For PDF attachments — which attachment to extract text from
    pdf_extraction?: PDFExtractionConfig;
}

export interface PDFExtractionConfig {
    // Which attachment (by index or filename pattern)
    attachment_index?: number; // 0 = first attachment
    filename_pattern?: string; // regex: 'ContractNote'

    // Password strategy — tried in order until one works
    password_strategies: PasswordStrategy[];

    // After extraction, which field to store the text in
    // (will be available as 'pdf_text' in extractors)
    output_field: 'pdf_text' | 'body_text'; // overwrite body_text or separate field
}

export type PasswordStrategy =
    | { type: 'pan_uppercase' } // ABCDE1234F
    | { type: 'dob_ddmmyyyy' } // 01031985
    | { type: 'dob_ddmmyy' } // 010385
    | { type: 'account_last6' } // last 6 digits of account
    | { type: 'account_last4' }
    | { type: 'client_id_uppercase' } // broker client ID
    | { type: 'static'; value: string }; // fixed password (rare)

// =============================================================================
// STAGE 3 — EXTRACT
// =============================================================================
//
// Each FieldExtractor extracts one logical field from the email body.
// The extraction result is stored in ParsedEmailData.raw_extracted[field_name].

export interface FieldExtractor {
    // Name of the field being extracted
    field_name: string; // 'amount' | 'account_last4' | 'merchant'

    // Where to look
    source: ExtractionSource;

    // How to extract
    method: ExtractionMethod;

    // Whether this field must be found for the parse to succeed
    required: boolean;

    // If extraction fails and field is not required, use this
    default_value?: string | number | boolean | null;

    // Multiple patterns to try in order (first match wins)
    // Used when different email formats from same sender need the same field
    fallback_patterns?: string[];
}

export type ExtractionSource =
    | 'body_text' // the stripped plaintext body (default)
    | 'body_html' // the raw HTML
    | 'pdf_text' // extracted PDF text (if pdf_extraction configured)
    | 'subject' // email subject line
    | 'from_address' // sender address
    | 'received_at'; // email received timestamp

export type ExtractionMethod = RegexExtraction | PositionalExtraction | ConstantExtraction | DerivedExtraction;

export interface RegexExtraction {
    type: 'regex';
    pattern: string; // JS regex string (without slashes)
    flags?: string; // 'i' | 'g' | 'gi'
    capture_group: number | string; // group index or named group: 1 | 'amount'
    // If pattern matches multiple times, which occurrence to use
    match_index?: number; // 0 = first (default), -1 = last
}

export interface PositionalExtraction {
    type: 'positional';
    // Find the anchor text, then grab N chars after it
    anchor: string; // 'Available Balance:'
    offset_chars: number; // skip N chars after anchor
    length_chars: number; // take N chars
    trim?: boolean;
}

export interface ConstantExtraction {
    type: 'constant';
    value: string | number | boolean;
    // A constant field — the parser itself knows the value
    // e.g. { field: 'bank', method: { type: 'constant', value: 'HDFC' } }
}

export interface DerivedExtraction {
    type: 'derived';
    // Compute from already-extracted fields using a template
    // Supports: ${field_name} substitution
    template: string; // '${year}-${month}-${day}'
    from_fields: string[]; // fields that must be extracted first
}

// =============================================================================
// STAGE 4 — VALIDATE
// =============================================================================

export interface ValidationConfig {
    // Minimum confidence to accept a parse (ratio of required fields found)
    min_confidence: number; // 0–1, typically 0.8

    // Field-level validation rules
    field_rules?: FieldValidationRule[];

    // Cross-field validation
    cross_field_rules?: CrossFieldRule[];
}

export interface FieldValidationRule {
    field_name: string;
    // The extracted string value must match this pattern
    must_match?: string; // regex: '^\d{12}$' for UPI RRN
    // Numeric bounds (after transform)
    min_value?: number;
    max_value?: number;
    // Valid values (for enum-like fields)
    allowed_values?: string[];
}

export interface CrossFieldRule {
    // e.g. if tx_type is 'credit', amount must be > 0
    // e.g. if channel is 'UPI', upi_ref must be present
    description: string;
    condition_field: string;
    condition_value: string;
    required_field: string;
}

// =============================================================================
// STAGE 5 — TRANSFORM
// =============================================================================
//
// Applied to raw_extracted values to produce typed, normalised values
// in ParsedEmailData.normalised

export type TransformConfig = AmountTransform | DateTransform | StringTransform | LookupTransform | SplitTransform;

export interface AmountTransform {
    type: 'amount';
    field_name: string;
    // Remove commas, currency symbols before parsing
    strip_chars?: string; // '₹,Rs. INR' — strip these before parseFloat
    // Indian amounts may have lakh-comma (1,00,000) — handle this
    handle_indian_notation: boolean;
    output_type: 'float';
}

export interface DateTransform {
    type: 'date';
    field_name: string;
    // Input formats to try in order (moment.js / dayjs format strings)
    input_formats: string[]; // ['DD-MMM-YY', 'DD/MM/YYYY', 'YYYY-MM-DD HH:mm:ss']
    output_format: 'iso_date' | 'iso_datetime';
    timezone?: string; // 'Asia/Kolkata' (default)
}

export interface StringTransform {
    type: 'string';
    field_name: string;
    operations: StringOperation[];
}

export type StringOperation =
    | { op: 'trim' }
    | { op: 'uppercase' }
    | { op: 'lowercase' }
    | { op: 'replace'; find: string; replace: string; is_regex?: boolean }
    | { op: 'truncate'; max_length: number }
    | { op: 'extract_digits' }; // strip all non-digit chars

export interface LookupTransform {
    type: 'lookup';
    field_name: string;
    // Map raw extracted values to canonical values
    // e.g. { 'debited': 'debit', 'Debit': 'debit', 'DR': 'debit' }
    map: Record<string, string>;
    case_insensitive: boolean;
    fallback?: string; // if no match found
}

export interface SplitTransform {
    type: 'split';
    field_name: string;
    // Split a multi-value capture into an array
    // e.g. "Chicken Biryani|Raita|Coke" → ['Chicken Biryani', 'Raita', 'Coke']
    delimiter: string;
    output_field: string; // target field name in normalised
    trim_items?: boolean;
}

// =============================================================================
// STAGE 6 — OUTPUT MAPPING
// =============================================================================
//
// Maps normalised extracted fields → unified Postgres schema fields

export interface OutputMapping {
    // Which domain does this email feed into
    domain: 'transaction' | 'investment' | 'loan' | 'insurance';

    // Which table within that domain
    target_table: string; // 'transactions' | 'investment_transactions' | 'loans'

    // The actual field mappings: { postgres_field: extracted_field_name }
    field_map: Record<string, string | ConstantValue>;

    // Fields to use for matching/dedup against existing Postgres records
    // (determines whether to INSERT or UPDATE/ENRICH)
    match_keys: MatchKey[];

    // If a match is found, which fields should be updated vs left alone
    enrich_fields?: string[]; // subset of field_map keys

    // Should we also create a CrossDomainLink?
    cross_domain_link?: CrossDomainLinkConfig;
}

export interface ConstantValue {
    constant: string | number | boolean;
}

// Priority order of match keys (tried in order until a match is found)
export interface MatchKey {
    priority: number; // 1 = try first
    fields: string[]; // postgres fields to match on
    // e.g. { priority: 1, fields: ['upi_ref'] }
    // e.g. { priority: 2, fields: ['amount', 'tx_date_hour', 'account_last4'] }
    time_window_minutes?: number; // for date-based matching: ± N minutes
}

export interface CrossDomainLinkConfig {
    link_type: string; // 'loan_emi' | 'sip_debit' | 'insurance_premium'
    // The transaction field that identifies the related domain entity
    // e.g. match loan by 'loan_account' field
    domain_match_field: string;
    domain_match_on: string; // postgres field on the domain table
}

// =============================================================================
// PARSER HEALTH & OBSERVABILITY
// =============================================================================

export interface ParserStats {
    // Lifetime counters (maintained by runtime)
    total_matched: number;
    total_parsed: number;
    total_parse_failed: number;
    total_inserted: number;
    total_insert_failed: number;
    total_skipped: number;

    // Recent window (last 7 days)
    recent_matched: number;
    recent_parsed: number;
    recent_failed: number;

    // Rates (computed)
    parse_success_rate: number; // 0–1
    insert_success_rate: number; // 0–1

    // Per-field capture rates (which fields are actually being found)
    field_capture_rates: Record<string, number>; // { 'amount': 0.99, 'balance': 0.71 }

    // Last activity
    last_matched_at?: ISODateTime;
    last_failed_at?: ISODateTime;
    last_failure_reason?: string;

    // Common failure patterns (top 3 error messages)
    top_errors: Array<{ message: string; count: number }>;
}

// Snapshot of one parse run — stored per email for debugging
export interface ParseRunLog {
    _id: string;
    raw_email_id: string; // → RawEmail._id
    parser_id: string;
    parser_version: number;
    started_at: ISODateTime;
    completed_at: ISODateTime;
    duration_ms: number;

    // Per-stage outcomes
    filter_matched: boolean;
    preprocess_applied: string[]; // list of preprocess steps that ran
    pdf_decrypted?: boolean;
    pdf_password_strategy?: string;

    // Per-field extraction results
    field_results: FieldResult[];

    // Validation outcome
    validation_passed: boolean;
    validation_errors: string[];

    // Final outcome
    confidence: number;
    status: 'success' | 'partial' | 'failed';
    error?: string;
}

export interface FieldResult {
    field_name: string;
    source: string;
    pattern_used?: string; // which regex matched (or 'fallback_0', etc.)
    raw_value?: string; // what was captured
    normalised_value?: unknown; // after transform
    success: boolean;
    error?: string;
}

// =============================================================================
// UNMATCHED EMAIL ANALYSIS
// =============================================================================
//
// Periodically, we scan RawEmails with status=unmatched and group them
// to find candidates for new parser configs.

export interface UnmatchedEmailGroup {
    _id: string;
    // Grouping key: the canonical sender domain + subject pattern
    sender_domain: string; // 'hdfcbank.net'
    subject_pattern: string; // computed: top-level subject normalised
    sample_subject: string; // actual subject from one email

    count: number; // how many emails in this group
    oldest_at: ISODateTime;
    newest_at: ISODateTime;
    sample_email_ids: string[]; // up to 5 example RawEmail._ids

    // Whether we've already queued AI to generate a parser for this
    ai_generation_status: 'pending' | 'queued' | 'generated' | 'reviewed' | 'deployed';
    generated_parser_id?: string;
}

// What we send to the AI when asking it to generate a new parser config
export interface AIParserGenerationRequest {
    group: UnmatchedEmailGroup;
    sample_emails: Array<{
        subject: string;
        from_address: string;
        body_text: string; // truncated to 2000 chars
        received_at: ISODateTime;
    }>;
    // Existing parser configs as examples for the AI to follow
    example_parsers: ParserConfig[];
    target_schema_hint: 'transaction' | 'investment' | 'loan' | 'insurance' | 'unknown';
}
// =============================================================================
// EXAMPLE: HDFC Bank Debit Alert Parser Config
// Shows exactly how a real parser config looks when populated
// =============================================================================

export const hdfcBankDebitAlert: ParserConfig = {
    _id: 'abc123',
    parser_id: 'hdfc_bank_debit_alert_v2',
    version: 2,
    is_active: true,
    description: 'HDFC Bank account debit alerts and credit card spend alerts',
    created_by: 'manual',
    reviewed_by_human: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',

    // ── FILTER ──────────────────────────────────────────────────────────────────
    filter: {
        sender: {
            domains: ['hdfcbank.net'],
        },
        subject: {
            contains_any: ['Transaction Alert', 'Txn Alert', 'Credit Card', 'Account Update'],
            excludes: ['OTP', 'Password', 'Login', 'Statement'],
        },
        body: {
            contains_any: ['debited', 'credited', 'spent'],
        },
        exclude: {
            subject_contains: ['password reset', 'OTP for', 'verify your'],
        },
    },

    // ── PRE-PROCESS ─────────────────────────────────────────────────────────────
    preprocess: {
        strip_html: true,
        normalize_whitespace: true,
        replace: [
            // HDFC sometimes sends 'Rs.' with a non-breaking space
            { find: 'Rs\u00a0', replace: 'Rs. ', is_regex: false },
        ],
    },

    // ── EXTRACT ─────────────────────────────────────────────────────────────────
    fields: [
        {
            field_name: 'amount',
            source: 'body_text',
            required: true,
            method: {
                type: 'regex',
                pattern: '(?:INR|Rs\\.?)\\s*([\\d,]+\\.?\\d{0,2})',
                flags: 'i',
                capture_group: 1,
                match_index: 0,
            },
            fallback_patterns: ['(?:₹)\\s*([\\d,]+\\.?\\d{0,2})'],
        },
        {
            field_name: 'tx_type_raw',
            source: 'body_text',
            required: true,
            method: {
                type: 'regex',
                pattern: '\\b(debited|credited|spent|withdrawn)\\b',
                flags: 'i',
                capture_group: 1,
            },
        },
        {
            field_name: 'account_last4',
            source: 'body_text',
            required: true,
            method: {
                type: 'regex',
                pattern: '(?:A\\/[Cc]|Card|account)\\s*(?:no\\.?\\s*)?[X*]+(\\d{4})',
                flags: 'i',
                capture_group: 1,
            },
        },
        {
            field_name: 'upi_ref',
            source: 'body_text',
            required: false,
            method: {
                type: 'regex',
                pattern: '(?:UPI\\s*(?:Ref|transaction reference)\\s*(?:No\\.?)?\\s*[:\\s]*)(\\d{12})',
                flags: 'i',
                capture_group: 1,
            },
        },
        {
            field_name: 'balance_after',
            source: 'body_text',
            required: false,
            method: {
                type: 'regex',
                pattern: '(?:Avl?\\.?\\s*Bal|Available\\s*Bal(?:ance)?)\\s*[:\\s]*(?:INR|Rs\\.?|₹)?\\s*([\\d,]+\\.?\\d*)',
                flags: 'i',
                capture_group: 1,
            },
        },
        {
            field_name: 'tx_date_raw',
            source: 'body_text',
            required: true,
            method: {
                type: 'regex',
                pattern: '(\\d{1,2}[-\\/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\\d{2})[-\\/]\\d{2,4})',
                flags: 'i',
                capture_group: 1,
            },
            fallback_patterns: ['(\\d{2}-\\d{2}-\\d{4})', '(\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2})'],
        },
        {
            field_name: 'payee',
            source: 'body_text',
            required: false,
            method: {
                type: 'regex',
                pattern: "(?:to|at)\\s+([A-Z][A-Z0-9@.\\s&'-]{2,40}?)(?:\\s+on\\s+\\d|\\.|\\n)",
                flags: 'i',
                capture_group: 1,
            },
        },
        {
            // HDFC credit card: "HDFC Bank RuPay Credit Card" — extract card type
            field_name: 'card_network',
            source: 'body_text',
            required: false,
            method: {
                type: 'regex',
                pattern: 'HDFC Bank (\\w+) (?:Credit|Debit) Card',
                flags: 'i',
                capture_group: 1,
            },
        },
        {
            // Constant — we know the bank from the parser itself
            field_name: 'bank',
            source: 'body_text',
            required: true,
            method: { type: 'constant', value: 'HDFC Bank' },
        },
        {
            field_name: 'channel',
            source: 'body_text',
            required: false,
            method: {
                type: 'regex',
                pattern: '\\b(UPI|NEFT|IMPS|RTGS|ATM|POS|NACH|NetBanking)\\b',
                flags: 'i',
                capture_group: 1,
            },
            default_value: 'UNKNOWN',
        },
    ],

    // ── VALIDATE ────────────────────────────────────────────────────────────────
    validation: {
        min_confidence: 0.8,
        field_rules: [
            {
                field_name: 'upi_ref',
                must_match: '^\\d{12}$',
            },
            {
                field_name: 'account_last4',
                must_match: '^\\d{4}$',
            },
        ],
        cross_field_rules: [
            {
                description: 'UPI transactions must have upi_ref if channel is UPI',
                condition_field: 'channel',
                condition_value: 'UPI',
                required_field: 'upi_ref',
            },
        ],
    },

    // ── TRANSFORM ───────────────────────────────────────────────────────────────
    transforms: [
        {
            type: 'amount',
            field_name: 'amount',
            strip_chars: '₹,Rs. INR',
            handle_indian_notation: true,
            output_type: 'float',
        },
        {
            type: 'amount',
            field_name: 'balance_after',
            strip_chars: '₹,Rs. INR',
            handle_indian_notation: true,
            output_type: 'float',
        },
        {
            type: 'date',
            field_name: 'tx_date_raw',
            input_formats: ['DD-MMM-YY', 'DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD HH:mm:ss'],
            output_format: 'iso_datetime',
            timezone: 'Asia/Kolkata',
        },
        {
            type: 'lookup',
            field_name: 'tx_type_raw',
            map: {
                debited: 'debit',
                debit: 'debit',
                spent: 'debit',
                withdrawn: 'debit',
                credited: 'credit',
                credit: 'credit',
                received: 'credit',
            },
            case_insensitive: true,
            fallback: 'debit',
        },
        {
            type: 'lookup',
            field_name: 'channel',
            map: {
                upi: 'UPI',
                neft: 'NEFT',
                imps: 'IMPS',
                rtgs: 'RTGS',
                atm: 'ATM',
                pos: 'POS',
                nach: 'NACH',
                netbanking: 'NET_BANKING',
            },
            case_insensitive: true,
            fallback: 'UNKNOWN',
        },
    ],

    // ── OUTPUT MAPPING ──────────────────────────────────────────────────────────
    output: {
        domain: 'transaction',
        target_table: 'transactions',
        field_map: {
            amount: 'amount',
            type: 'tx_type_raw', // after lookup transform → 'debit'|'credit'
            channel: 'channel',
            tx_date: 'tx_date_raw', // after date transform → ISO datetime
            account_last4: 'account_last4',
            balance_after: 'balance_after',
            upi_ref: 'upi_ref',
            raw_narration: 'payee',
            merchant_name: 'payee',
            bank: 'bank', // constant
            category: { constant: 'unknown' }, // will be enriched later
        },
        match_keys: [
            { priority: 1, fields: ['upi_ref'] },
            { priority: 2, fields: ['amount', 'account_last4', 'tx_date'], time_window_minutes: 30 },
        ],
        enrich_fields: ['balance_after', 'raw_narration', 'merchant_name'],
    },

    // ── STATS (runtime-maintained) ──────────────────────────────────────────────
    stats: {
        total_matched: 14823,
        total_parsed: 14691,
        total_parse_failed: 132,
        total_inserted: 14620,
        total_insert_failed: 71,
        total_skipped: 0,
        recent_matched: 312,
        recent_parsed: 309,
        recent_failed: 3,
        parse_success_rate: 0.991,
        insert_success_rate: 0.995,
        field_capture_rates: {
            amount: 0.999,
            tx_type_raw: 0.999,
            account_last4: 0.997,
            upi_ref: 0.783, // not all HDFC alerts include UPI ref
            balance_after: 0.921,
            tx_date_raw: 0.999,
            payee: 0.834,
        },
        last_matched_at: '2026-03-06T09:14:22Z',
        last_failed_at: '2026-03-05T22:01:11Z',
        last_failure_reason: 'Date parse failed: unexpected format "Mar 6, 2026 9:00 AM IST"',
        top_errors: [
            { message: 'Date parse failed: unexpected format', count: 89 },
            { message: 'amount: no regex match found', count: 31 },
            { message: 'Confidence below threshold: 0.76', count: 12 },
        ],
    },
};
