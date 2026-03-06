import { ISODateTime, UUID } from './financial.type';

export enum EmailProcessingStatus {
    Fetched = 'fetched', // saved from Gmail, not yet matched to a parser
    Matched = 'matched', // a parser config matched this email
    Parsing = 'parsing', // parser is actively running
    Parsed = 'parsed', // extraction succeeded, structured data ready
    ParseFailed = 'parse_failed', // parser matched but extraction failed
    Inserted = 'inserted', // data written to unified Postgres DB
    InsertFailed = 'insert_failed', // parsed OK but DB write failed
    Skipped = 'skipped', // matched a parser, parser said "skip this one"
    Unmatched = 'unmatched', // no parser config matched — needs new parser
    Duplicate = 'duplicate', // already processed an identical email
}

export interface RawEmailAttachment {
    filename: string;
    mimeType: string; // 'application/pdf' | 'image/png'
    gmailAttachmentId: string;
    downloaded: false;
    // sizeBytes: number;
    // gmailUrl: string;
    // internalUrl: string;
    // passwordHint?: string; // 'pan' | 'dob_ddmmyyyy' | 'account_last6'
    // extractedText?: string; // populated after PDF parsing
}

export interface RawEmail {
    _id: string; // MongoDB ObjectId
    userId: string;

    // Gmail metadata
    gmailMessageId: string; // Gmail's unique message ID
    gmailThreadId: string;
    gmailLabels: string[];

    // Email headers
    fromAddress: string; // 'alerts@hdfcbank.net'
    fromName?: string; // 'HDFC Bank'
    toAddress: string;
    subject: string;
    receivedAt: ISODateTime; // Date header from email
    fetchedAt: ISODateTime; // when we pulled it from Gmail

    // Body
    bodyHtml?: string; // raw HTML
    bodyText: string; // HTML stripped to plaintext (our working surface)
    bodyTextLength: number;
    // Attachments
    attachments: RawEmailAttachment[];
    hasAttachments: boolean;
    hasPdf: boolean;
    hasEncryptedPdf: boolean;
    hasExcel: boolean;
    hasEncryptedExcel: boolean;

    // ── Processing state ──────────────────────────────────────────────
    status: EmailProcessingStatus;
    statusUpdatedAt: ISODateTime;

    // Which parser config was matched (null if unmatched)
    marchedParserId?: string; // → ParserConfig._id
    matchedParserVersion?: number; // snapshot of parser version at time of use

    // Extraction output (populated after parsing)
    parsedData?: ParsedEmailData;

    // DB insertion result (populated after insert attempt)
    insertionResult?: InsertionResult;

    // Retry tracking
    parseAttempts: number;
    lastParseError?: string;
    insertAttempts: number;
    lastInsertError?: string;

    // Dedup
    contenthash: string; // sha256(from + subject + body_text) — dedup key
}

// What the parser extracts — all fields, all domains
export interface ParsedEmailData {
    domain: 'transaction' | 'investment' | 'loan' | 'insurance' | 'account';
    rawExtracted: Record<string, string>; // every regex capture group, as-is
    normalised: Record<string, unknown>; // after type coercion + transformations
    confidence: number; // 0–1, computed from field coverage
    missingFields: string[]; // required fields that weren't found
    warnings: string[]; // non-fatal issues during extraction
    parserVersion: number;
    parsedAt: ISODateTime;
}

// Result of writing to unified Postgres
export interface InsertionResult {
    success: boolean;
    action: 'created' | 'enriched' | 'skipped_duplicate' | 'failed';
    targetTable: string; // 'transactions' | 'investment_transactions' | etc.
    targetId?: UUID; // the Postgres row that was created/updated
    cross_domain_link_id?: UUID; // if a CrossDomainLink was created
    error?: string;
    insertedAt: ISODateTime;
}
