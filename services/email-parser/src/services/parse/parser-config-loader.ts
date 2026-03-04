import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { ParserConfig } from '@/schema/parser-config.schema';
import type {
    ParserConfig as IParserConfigType,
    SearchQueriesConfig,
    CategoriesConfig,
    MerchantAliasesConfig,
    CategoryRule,
    SearchQuery,
} from '@/types/parser.types';

const CONFIGS_DIR = path.resolve(__dirname, '../../parser-configs');

// --- Zod validation schemas ---

const TemplateFieldRuleSchema = z.object({
    selector: z.string(),
    regex: z.string().optional(),
    transform: z.enum(['currency', 'string', 'date', 'number', 'boolean']),
    required: z.boolean().optional(),
    attribute: z.string().optional(),
});

const TemplateLineItemsSchema = z.object({
    containerSelector: z.string(),
    itemSelector: z.string(),
    fields: z.record(
        z.object({
            selector: z.string(),
            regex: z.string().optional(),
            transform: z.enum(['currency', 'string', 'date', 'number', 'boolean']).optional(),
        })
    ),
});

const TemplateExtractionSchema = z.object({
    rules: z.record(TemplateFieldRuleSchema),
    lineItems: TemplateLineItemsSchema.optional(),
});

const LlmExtractionSchema = z.object({
    model: z.string(),
    preprocessHtml: z.boolean(),
    systemPrompt: z.string(),
    outputSchema: z.record(z.any()),
});

const PdfTemplateExtractionSchema = z.object({
    passwordEnvVar: z.string().optional(),
    transactionRegex: z.string(),
    dateFormat: z.string(),
    descriptionParser: z.string(),
    columns: z.record(z.object({ position: z.number(), regex: z.string().optional() })),
});

const DeduplicationSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        strategy: z.enum(['external_id', 'amount_date_merchant', 'statement_line']),
        matchFields: z.array(z.string()),
        tolerances: z
            .object({
                amountPercent: z.number().optional(),
                dateDays: z.number().optional(),
            })
            .optional(),
        fallback: DeduplicationSchema.optional(),
    })
);

const ParserConfigSchema = z.object({
    configId: z.string(),
    version: z.number(),
    match: z.object({
        senderDomains: z.array(z.string()),
        subjectPattern: z.string().optional(),
        subjectExcludePattern: z.string().optional(),
        contentType: z.enum(['html', 'pdf']),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
    }),
    classification: z.object({
        category: z.string(),
        subcategory: z.string(),
        senderKey: z.string(),
        senderDisplayName: z.string().optional(),
    }),
    extraction: z.object({
        method: z.enum(['template', 'llm', 'pdf-template', 'pdf-llm']),
        template: TemplateExtractionSchema.optional(),
        llm: LlmExtractionSchema.optional(),
        pdfTemplate: PdfTemplateExtractionSchema.optional(),
    }),
    output: z.object({
        targetCollection: z.enum(['transactions', 'invoices', 'official_statements']),
        mapping: z.record(z.string()),
        enrichmentFields: z.array(z.string()).optional(),
        deduplication: DeduplicationSchema,
    }),
});

const SearchQueriesSchema = z.object({
    queries: z.array(
        z.object({
            id: z.string(),
            query: z.string(),
            description: z.string(),
            category: z.string(),
            maxResults: z.number().optional(),
            enabled: z.boolean(),
        })
    ),
});

const CategoriesSchema = z.object({
    categories: z.array(
        z.object({
            senderDomains: z.array(z.string()),
            subjectPattern: z.string().optional(),
            subjectExcludePattern: z.string().optional(),
            category: z.string(),
            subcategory: z.string(),
            senderKey: z.string(),
            senderDisplayName: z.string(),
        })
    ),
});

const MerchantAliasesSchema = z.object({
    aliases: z.record(z.string()),
});

// --- ParserConfigLoader ---

export class ParserConfigLoader {
    private parserConfigs: Map<string, IParserConfigType[]> = new Map(); // configId → versions
    private searchQueries: SearchQuery[] = [];
    private categoryRules: CategoryRule[] = [];
    private merchantAliases: Map<string, string> = new Map();
    private loaded = false;

    /**
     * Load all YAML configs from disk, validate, and cache in memory.
     */
    async loadFromDisk(): Promise<{ parserConfigs: number; searchQueries: number; categoryRules: number; merchantAliases: number }> {
        this.parserConfigs.clear();
        this.searchQueries = [];
        this.categoryRules = [];
        this.merchantAliases.clear();

        // Load global configs
        this.loadSearchQueries();
        this.loadCategories();
        this.loadMerchantAliases();

        // Load parser configs from html/ and pdf/ subdirectories
        const configCount = this.loadParserConfigDir('html') + this.loadParserConfigDir('pdf');

        this.loaded = true;

        const stats = {
            parserConfigs: configCount,
            searchQueries: this.searchQueries.length,
            categoryRules: this.categoryRules.length,
            merchantAliases: this.merchantAliases.size,
        };

        logger.info(`[ParserConfigLoader] Loaded: ${configCount} parser configs, ${stats.searchQueries} search queries, ${stats.categoryRules} category rules, ${stats.merchantAliases} merchant aliases`);

        return stats;
    }

    /**
     * Sync all loaded parser configs to MongoDB (upsert by configId + version).
     */
    async syncToDatabase(): Promise<{ upserted: number; unchanged: number }> {
        if (!this.loaded) await this.loadFromDisk();

        let upserted = 0;
        let unchanged = 0;

        for (const [, versions] of this.parserConfigs) {
            for (const config of versions) {
                const result = await ParserConfig.findOneAndUpdate(
                    { configId: config.configId, version: config.version },
                    {
                        $set: {
                            isActive: config.isActive,
                            match: {
                                ...config.match,
                                validFrom: config.match.validFrom ? new Date(config.match.validFrom) : undefined,
                                validUntil: config.match.validUntil ? new Date(config.match.validUntil) : undefined,
                            },
                            classification: config.classification,
                            extraction: config.extraction,
                            output: config.output,
                        },
                    },
                    { upsert: true, new: true, rawResult: true }
                );

                if (result.lastErrorObject?.updatedExisting) {
                    unchanged++;
                } else {
                    upserted++;
                }
            }
        }

        logger.info(`[ParserConfigLoader] Synced to DB: ${upserted} upserted, ${unchanged} unchanged`);
        return { upserted, unchanged };
    }

    /**
     * Get the best matching parser config for a given email.
     */
    getParserConfig(senderDomain: string, subject: string, emailDate?: Date): IParserConfigType | null {
        for (const [, versions] of this.parserConfigs) {
            // Sort by version descending to prefer latest
            const sorted = [...versions].sort((a, b) => b.version - a.version);

            for (const config of sorted) {
                if (!config.isActive) continue;

                // Check sender domain
                if (!config.match.senderDomains.some((d) => senderDomain.endsWith(d))) continue;

                // Check subject pattern
                if (config.match.subjectPattern) {
                    const regex = new RegExp(config.match.subjectPattern, 'i');
                    if (!regex.test(subject)) continue;
                }

                // Check exclude pattern
                if (config.match.subjectExcludePattern) {
                    const regex = new RegExp(config.match.subjectExcludePattern, 'i');
                    if (regex.test(subject)) continue;
                }

                // Check date validity
                if (emailDate) {
                    if (config.match.validFrom && emailDate < new Date(config.match.validFrom)) continue;
                    if (config.match.validUntil && emailDate > new Date(config.match.validUntil)) continue;
                }

                return config;
            }
        }

        return null;
    }

    /**
     * Classify an email using category rules (fallback when no parser config matches).
     */
    classifyEmail(senderDomain: string, subject: string): CategoryRule | null {
        for (const rule of this.categoryRules) {
            if (!rule.senderDomains.some((d) => senderDomain.endsWith(d))) continue;

            if (rule.subjectPattern) {
                const regex = new RegExp(rule.subjectPattern, 'i');
                if (!regex.test(subject)) continue;
            }

            if (rule.subjectExcludePattern) {
                const regex = new RegExp(rule.subjectExcludePattern, 'i');
                if (regex.test(subject)) continue;
            }

            return rule;
        }

        return null;
    }

    /**
     * Resolve a raw merchant name to a normalized display name.
     */
    resolveMerchant(rawName: string): string {
        const upper = rawName.toUpperCase().trim();
        return this.merchantAliases.get(upper) || rawName;
    }

    getSearchQueries(): SearchQuery[] {
        return this.searchQueries.filter((q) => q.enabled);
    }

    getCategoryRules(): CategoryRule[] {
        return this.categoryRules;
    }

    getAllParserConfigs(): IParserConfigType[] {
        const all: IParserConfigType[] = [];
        for (const versions of this.parserConfigs.values()) {
            all.push(...versions);
        }
        return all;
    }

    getMerchantAliases(): Map<string, string> {
        return new Map(this.merchantAliases);
    }

    // --- Private loading methods ---

    private loadSearchQueries(): void {
        const filePath = path.join(CONFIGS_DIR, '_search-queries.yaml');
        if (!fs.existsSync(filePath)) {
            logger.warn('[ParserConfigLoader] _search-queries.yaml not found');
            return;
        }

        const raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
        const parsed = SearchQueriesSchema.parse(raw);
        this.searchQueries = parsed.queries as SearchQuery[];
    }

    private loadCategories(): void {
        const filePath = path.join(CONFIGS_DIR, '_categories.yaml');
        if (!fs.existsSync(filePath)) {
            logger.warn('[ParserConfigLoader] _categories.yaml not found');
            return;
        }

        const raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
        const parsed = CategoriesSchema.parse(raw);
        this.categoryRules = parsed.categories as CategoryRule[];
    }

    private loadMerchantAliases(): void {
        const filePath = path.join(CONFIGS_DIR, '_merchant-aliases.yaml');
        if (!fs.existsSync(filePath)) {
            logger.warn('[ParserConfigLoader] _merchant-aliases.yaml not found');
            return;
        }

        const raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
        const parsed = MerchantAliasesSchema.parse(raw);

        for (const [key, value] of Object.entries(parsed.aliases)) {
            this.merchantAliases.set(key.toUpperCase().trim(), value);
        }
    }

    private loadParserConfigDir(subdir: string): number {
        const dir = path.join(CONFIGS_DIR, subdir);
        if (!fs.existsSync(dir)) return 0;

        let count = 0;
        const walk = (currentDir: string) => {
            for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    walk(path.join(currentDir, entry.name));
                } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
                    try {
                        const filePath = path.join(currentDir, entry.name);
                        const raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
                        const config = ParserConfigSchema.parse(raw);

                        const parsed = {
                            ...config,
                            isActive: true,
                        } as IParserConfigType;

                        const existing = this.parserConfigs.get(config.configId) || [];
                        existing.push(parsed);
                        this.parserConfigs.set(config.configId, existing);
                        count++;
                    } catch (err: any) {
                        logger.error(`[ParserConfigLoader] Failed to load ${entry.name}: ${err.message}`);
                    }
                }
            }
        };

        walk(dir);
        return count;
    }
}

export const parserConfigLoader = new ParserConfigLoader();
