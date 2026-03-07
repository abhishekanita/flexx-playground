import * as cheerio from 'cheerio';
import { DeclarativeRules, FieldRule, FieldExtractor, FieldType } from '@/types/pipelines/parser-config.type';

export class DeclarativeEngine {
    constructor() {}

    public runParser(content: string, rules: DeclarativeRules) {
        const { text, $ } = this.preprocess(content, rules.preprocessor);

        // Step 2: Extract scalar fields
        const result: Record<string, unknown> = {};
        for (const field of rules.fields || []) {
            result[field.name] = this.extractField(field, text, $);
        }

        // Step 3: Extract array fields
        for (const arrayField of rules.arrays || []) {
            result[arrayField.name] = this.extractArray(arrayField, text, $);
        }

        return result;
    }

    private preprocess(content: string, preprocessor: string): { text: string; $: cheerio.CheerioAPI | null } {
        switch (preprocessor) {
            case 'cheerio_text': {
                const $ = cheerio.load(content);
                const text = $.root().text().replace(/\s+/g, ' ').trim();
                return { text, $ };
            }
            case 'raw_html': {
                const $ = cheerio.load(content);
                return { text: content, $ };
            }
            case 'pdf_text':
                return { text: content, $: null };
            default:
                return { text: content, $: null };
        }
    }

    private extractField(field: FieldRule, text: string, $: cheerio.CheerioAPI | null): unknown {
        for (const extractor of field.extractors) {
            const raw = this.runExtractor(extractor, text, $);
            if (raw !== null && raw !== undefined && raw !== '') {
                return this.coerce(raw, field.type);
            }
        }
        // Return type-appropriate default
        return this.getDefault(field.type);
    }

    private extractArray(field: FieldRule, text: string, $: cheerio.CheerioAPI | null): unknown[] {
        for (const extractor of field.extractors) {
            if (extractor.type === 'regex_repeat') {
                const items = this.runRepeatExtractor(extractor, text);
                if (items.length > 0) return items;
            }
        }
        return [];
    }

    private runExtractor(ext: FieldExtractor, text: string, $: cheerio.CheerioAPI | null): string | null {
        switch (ext.type) {
            case 'regex': {
                if (!ext.pattern) return null;
                try {
                    const regex = new RegExp(ext.pattern, ext.flags || '');
                    const match = text.match(regex);
                    if (!match) return null;
                    return match[ext.group ?? 1] ?? match[0];
                } catch {
                    return null;
                }
            }
            case 'cheerio': {
                if (!$ || !ext.selector) return null;
                const el = $(ext.selector);
                if (el.length === 0) return null;
                if (ext.attribute === 'text' || !ext.attribute) return el.first().text().trim();
                return el.first().attr(ext.attribute) || null;
            }
            default:
                return null;
        }
    }

    private runRepeatExtractor(ext: FieldExtractor, text: string): Record<string, unknown>[] {
        if (!ext.pattern || !ext.fields) return [];

        try {
            const regex = new RegExp(ext.pattern, ext.flags || 'g');
            const items: Record<string, unknown>[] = [];

            let match;
            while ((match = regex.exec(text)) !== null) {
                const item: Record<string, unknown> = {};
                for (let i = 0; i < ext.fields.length; i++) {
                    const [name, type] = ext.fields[i].split(':');
                    const raw = match[i + 1] || '';
                    item[name] = this.coerce(raw, (type || 'string') as FieldType);
                }
                items.push(item);
            }
            return items;
        } catch {
            return [];
        }
    }

    private coerce(value: string, type: FieldType): unknown {
        switch (type) {
            case 'amount':
                return parseFloat(value.replace(/[₹,\s]/g, '')) || 0;
            case 'int':
                return parseInt(value.replace(/[,\s]/g, '')) || 0;
            case 'float':
                return parseFloat(value.replace(/[,\s]/g, '')) || 0;
            case 'boolean':
                return /true|yes|1/i.test(value);
            case 'date':
            case 'string':
            default:
                return value.trim();
        }
    }

    private getDefault(type: FieldType): unknown {
        switch (type) {
            case 'amount':
            case 'int':
            case 'float':
                return 0;
            case 'boolean':
                return false;
            case 'string':
            case 'date':
            default:
                return '';
        }
    }
}
