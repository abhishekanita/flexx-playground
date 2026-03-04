import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import TurndownService from 'turndown';
import type { LlmExtraction } from '@/types/parser.types';
import { calculateCost, type TokenUsage } from '@/utils/ai-cost';

const turndown = new TurndownService();

export interface LlmExtractionResult {
    extractedData: Record<string, any>;
    usage: { promptTokens: number; completionTokens: number };
    costUSD: number;
    durationMs: number;
}

export class LlmExtractor {
    /**
     * Extract structured data from HTML email using LLM.
     * Optionally preprocesses HTML → markdown to save tokens (~70% reduction).
     * Ported from experiment-template-gen.ts directExtract().
     */
    async extract(
        html: string,
        llmConfig: LlmExtraction,
        context: { senderKey: string; subject: string; emailDate: string }
    ): Promise<LlmExtractionResult> {
        let content: string;

        if (llmConfig.preprocessHtml) {
            try {
                content = turndown.turndown(html);
            } catch {
                content = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            }
            // Cap at 20K chars to keep costs reasonable
            if (content.length > 20000) content = content.substring(0, 20000);
        } else {
            content = html.substring(0, 100000);
        }

        const zodSchema = this.jsonSchemaToZod(llmConfig.outputSchema);

        const start = Date.now();
        const result = await generateObject({
            model: openai(llmConfig.model),
            schema: zodSchema,
            system: llmConfig.systemPrompt,
            prompt: `Extract financial data from this email.\nSender: ${context.senderKey}\nSubject: ${context.subject}\nDate: ${context.emailDate}\n\n${content}`,
        });

        const durationMs = Date.now() - start;
        const usage = result.usage as any;
        const tokenUsage: TokenUsage = {
            inputTokens: usage.promptTokens || 0,
            outputTokens: usage.completionTokens || 0,
            cachedInputTokens: 0,
            cacheWriteTokens: 0,
        };
        const costUSD = calculateCost(llmConfig.model, tokenUsage).totalCost;

        return {
            extractedData: result.object as Record<string, any>,
            usage: {
                promptTokens: usage.promptTokens || 0,
                completionTokens: usage.completionTokens || 0,
            },
            costUSD,
            durationMs,
        };
    }

    /**
     * Convert a simple JSON schema definition to a Zod schema.
     * Supports: string, number, boolean, array, object.
     * Uses .nullable() instead of .optional() per plan spec.
     */
    private jsonSchemaToZod(schema: Record<string, any>): z.ZodObject<any> {
        const shape: Record<string, z.ZodTypeAny> = {};

        for (const [key, def] of Object.entries(schema)) {
            const fieldDef = typeof def === 'string' ? { type: def } : def;

            let zodType: z.ZodTypeAny;

            switch (fieldDef.type) {
                case 'string':
                    zodType = z.string().nullable();
                    break;
                case 'number':
                    zodType = z.number().nullable();
                    break;
                case 'boolean':
                    zodType = z.boolean().nullable();
                    break;
                case 'date':
                    zodType = z.string().nullable(); // Dates as ISO strings
                    break;
                case 'array':
                    if (fieldDef.items) {
                        const itemSchema = this.jsonSchemaToZod(fieldDef.items);
                        zodType = z.array(itemSchema).nullable();
                    } else {
                        zodType = z.array(z.any()).nullable();
                    }
                    break;
                case 'object':
                    if (fieldDef.properties) {
                        zodType = this.jsonSchemaToZod(fieldDef.properties).nullable();
                    } else {
                        zodType = z.record(z.any()).nullable();
                    }
                    break;
                default:
                    zodType = z.any().nullable();
            }

            if (fieldDef.description) {
                zodType = zodType.describe(fieldDef.description);
            }

            shape[key] = zodType;
        }

        return z.object(shape);
    }
}

export const llmExtractor = new LlmExtractor();
