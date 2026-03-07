import { ISODateTime } from '../financial-data/financial.type';

// =============================================================================
// PARSER CONFIG — Database-driven parser registry
// =============================================================================

export type ParserSource = 'pdf' | 'body_html' | 'body_text' | 'xlsx';
export type ParserStrategy = 'declarative' | 'code';

// ── Matching rules ──────────────────────────────────────────────────────────

export interface ParserMatchRules {
    fromAddress: string; // exact string or regex string like "/pattern/i"
    subject?: string;
}

// ── Attachment handling ─────────────────────────────────────────────────────

export interface ParserAttachmentConfig {
    pickBy: 'mimeType' | 'filename';
    mimeTypes?: string[]; // ["application/pdf"]
    filenamePattern?: string; // regex string: "/\\.xlsx$/i"
    passwordStrategy?: string[];
}

// ── Declarative extraction ──────────────────────────────────────────────────

export type FieldType = 'string' | 'amount' | 'int' | 'float' | 'date' | 'boolean';

export interface FieldExtractor {
    type: 'regex' | 'regex_repeat' | 'cheerio' | 'xpath';

    // regex / regex_repeat
    pattern?: string;
    flags?: string; // "i", "gi", etc.
    group?: number; // capture group index (default 1)

    // regex_repeat: maps capture groups to named fields
    fields?: string[]; // ["quantity:int", "name:string", "price:amount"]

    // cheerio
    selector?: string; // CSS selector
    attribute?: string; // "text" | "href" | attr name
}

export interface FieldRule {
    name: string;
    type: FieldType;
    required: boolean;
    extractors: FieldExtractor[]; // tried in order, first match wins
}

export interface ValidationRule {
    type: 'field_present' | 'math_check' | 'min_items';
    fields?: string[];
    expr?: string; // "itemTotal + taxes - discount == orderTotal"
    tolerance?: number;
    arrayField?: string;
    minCount?: number;
}

export interface DeclarativeRules {
    preprocessor: 'cheerio_text' | 'raw_html' | 'pdf_text' | 'xlsx_json';
    fields: FieldRule[];
    arrays?: FieldRule[]; // repeated patterns (items, transactions)
    validation?: ValidationRule[];
}

// ── Variant (email template evolution) ──────────────────────────────────────

export interface ParserVariant {
    id: string; // "v2024_template"
    matchCondition: {
        receivedBefore?: string; // ISO date
        receivedAfter?: string;
        subjectContains?: string;
        bodyContains?: string;
    };
    strategy: ParserStrategy;
    declarativeRules?: DeclarativeRules;
    codeModule?: string; // registered module name for strategy=code
}

// ── Reliability stats ───────────────────────────────────────────────────────

export interface FieldStat {
    found: number;
    missing: number;
}

export interface VersionHistoryEntry {
    version: number;
    activatedAt: ISODateTime;
    deactivatedAt?: ISODateTime;
    successRate: number;
    totalAttempts: number;
}

export interface ParserStats {
    totalAttempts: number;
    successCount: number;
    failCount: number;
    emptyResultCount: number; // parsed but returned mostly empty fields
    lastSuccess?: ISODateTime;
    lastFailure?: ISODateTime;
    successRate: number;
    avgConfidence: number; // average fieldsFound/totalFields
    fieldStats: Record<string, FieldStat>;
    versionHistory: VersionHistoryEntry[];
}

// ── Main config ─────────────────────────────────────────────────────────────

export interface ParserConfig {
    _id?: string;

    // Identity
    slug: string; // unique slug: "swiggy_food_delivery"
    name: string;
    provider: string; // group key: "swiggy", "uber", "kotak"
    version: number;

    // Activation
    active: boolean;
    activeForUserIds: string[]; // empty = all users

    // Matching
    match: ParserMatchRules;

    // Source
    source: ParserSource;

    // Attachment handling (for pdf/xlsx sources)
    attachment?: ParserAttachmentConfig;

    // Parsing — default strategy (used when no variant matches)
    strategy: ParserStrategy;
    declarativeRules?: DeclarativeRules;
    codeModule?: string; // for strategy=code: "kotak-statement"

    // Template variants (email evolution)
    variants: ParserVariant[];

    // Reliability
    stats?: ParserStats;

    // Output domain
    domain: 'transaction' | 'investment' | 'loan' | 'insurance' | 'account' | 'statement';

    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
}
