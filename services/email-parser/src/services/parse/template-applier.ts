import * as cheerio from 'cheerio';
import type { TemplateExtraction, TemplateFieldRule, TransformType } from '@/types/parser.types';

export interface TemplateApplyResult {
    extractedData: Record<string, any>;
    lineItems: Record<string, any>[];
    fieldsExtracted: number;
    fieldsFailed: number;
    errors: string[];
}

export class TemplateApplier {
    /**
     * Apply CSS-selector-based template rules to HTML content.
     * Ported from experiment-template-gen.ts applyTemplate().
     */
    apply(html: string, template: TemplateExtraction): TemplateApplyResult {
        const $ = cheerio.load(html);
        const result: TemplateApplyResult = {
            extractedData: {},
            lineItems: [],
            fieldsExtracted: 0,
            fieldsFailed: 0,
            errors: [],
        };

        // Extract each field using its rule
        for (const [fieldName, rule] of Object.entries(template.rules)) {
            try {
                const value = this.extractField($, rule);

                if (value !== null && value !== undefined) {
                    result.extractedData[fieldName] = value;
                    result.fieldsExtracted++;
                } else if (rule.required) {
                    result.fieldsFailed++;
                    result.errors.push(`Required field "${fieldName}" not found`);
                } else {
                    result.fieldsFailed++;
                }
            } catch (err: any) {
                result.fieldsFailed++;
                result.errors.push(`Field "${fieldName}": ${err.message}`);
            }
        }

        // Extract line items
        if (template.lineItems) {
            try {
                const container = $(template.lineItems.containerSelector);
                container.find(template.lineItems.itemSelector).each((_, el) => {
                    const item: Record<string, any> = {};
                    let hasData = false;

                    for (const [fieldName, fieldRule] of Object.entries(template.lineItems!.fields)) {
                        try {
                            let text = $(el).find(fieldRule.selector).text().trim();

                            if (fieldRule.regex) {
                                const match = text.match(new RegExp(fieldRule.regex));
                                if (match) text = match[1] || match[0];
                            }

                            if (text) {
                                item[fieldName] = this.applyTransform(text, fieldRule.transform || 'string');
                                hasData = true;
                            }
                        } catch {}
                    }

                    if (hasData) result.lineItems.push(item);
                });
            } catch (err: any) {
                result.errors.push(`Line items: ${err.message}`);
            }
        }

        return result;
    }

    private extractField($: cheerio.CheerioAPI, rule: TemplateFieldRule): any {
        const elements = $(rule.selector);
        if (elements.length === 0) return null;

        let text: string;
        if (rule.attribute) {
            text = elements.first().attr(rule.attribute) || '';
        } else {
            text = elements.first().text().trim();
        }

        if (rule.regex) {
            const match = text.match(new RegExp(rule.regex));
            if (match) {
                text = match[1] || match[0];
            } else {
                return null;
            }
        }

        if (!text) return null;

        return this.applyTransform(text, rule.transform);
    }

    private applyTransform(text: string, transform: TransformType): any {
        switch (transform) {
            case 'currency':
                return parseFloat(text.replace(/[₹,\s]/g, ''));
            case 'number':
                return parseInt(text.replace(/,/g, ''), 10);
            case 'boolean':
                return ['true', 'yes', '1'].includes(text.toLowerCase());
            case 'date':
                return text; // Keep as string, let the output mapping handle conversion
            default:
                return text;
        }
    }
}

export const templateApplier = new TemplateApplier();
