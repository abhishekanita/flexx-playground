// Parser config types — mirrors the YAML config structure

export type ExtractionMethod = 'template' | 'llm' | 'pdf-template' | 'pdf-llm';
export type ContentType = 'html' | 'pdf';
export type TransformType = 'currency' | 'string' | 'date' | 'number' | 'boolean';

export type DeduplicationStrategy = 'external_id' | 'amount_date_merchant' | 'statement_line';

export interface TemplateFieldRule {
    selector: string;
    regex?: string;
    transform: TransformType;
    required?: boolean;
    attribute?: string; // e.g. 'href' to extract from an attribute instead of text
}

export interface TemplateLineItemFields {
    [fieldName: string]: {
        selector: string;
        regex?: string;
        transform?: TransformType;
    };
}

export interface TemplateLineItems {
    containerSelector: string;
    itemSelector: string;
    fields: TemplateLineItemFields;
}

export interface TemplateExtraction {
    rules: Record<string, TemplateFieldRule>;
    lineItems?: TemplateLineItems;
}

export interface LlmExtraction {
    model: string;
    preprocessHtml: boolean; // HTML→Markdown to save tokens
    systemPrompt: string;
    outputSchema: Record<string, any>; // JSON schema, converted to Zod at runtime
}

export interface PdfTemplateExtraction {
    passwordEnvVar?: string;
    transactionRegex: string;
    dateFormat: string;
    descriptionParser: string; // name of a built-in description parser (e.g. 'sbi-upi', 'kotak-upi')
    columns: Record<string, { position: number; regex?: string }>;
}

export interface ParserConfigMatch {
    senderDomains: string[];
    subjectPattern?: string;
    subjectExcludePattern?: string;
    contentType: ContentType;
    validFrom?: string; // ISO date
    validUntil?: string; // ISO date
}

export interface ParserConfigClassification {
    category: string;
    subcategory: string;
    senderKey: string;
    senderDisplayName?: string;
}

export interface ParserConfigExtraction {
    method: ExtractionMethod;
    template?: TemplateExtraction;
    llm?: LlmExtraction;
    pdfTemplate?: PdfTemplateExtraction;
}

export interface DeduplicationConfig {
    strategy: DeduplicationStrategy;
    matchFields: string[];
    tolerances?: {
        amountPercent?: number;
        dateDays?: number;
    };
    fallback?: DeduplicationConfig;
}

export interface ParserConfigOutput {
    targetCollection: 'transactions' | 'invoices' | 'official_statements';
    mapping: Record<string, string>; // extracted field → target field
    enrichmentFields?: string[];
    deduplication: DeduplicationConfig;
}

export interface ParserConfig {
    configId: string; // e.g. "swiggy/food-delivery"
    version: number;
    isActive: boolean;
    match: ParserConfigMatch;
    classification: ParserConfigClassification;
    extraction: ParserConfigExtraction;
    output: ParserConfigOutput;
}

// Search query config
export interface SearchQuery {
    id: string;
    query: string;
    description: string;
    category: string;
    maxResults?: number;
    enabled: boolean;
}

export interface SearchQueriesConfig {
    queries: SearchQuery[];
}

// Category config
export interface CategoryRule {
    senderDomains: string[];
    subjectPattern?: string;
    subjectExcludePattern?: string;
    category: string;
    subcategory: string;
    senderKey: string;
    senderDisplayName: string;
}

export interface CategoriesConfig {
    categories: CategoryRule[];
}

// Merchant alias config
export interface MerchantAliasesConfig {
    aliases: Record<string, string>; // raw merchant name → normalized name
}
