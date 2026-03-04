import OpenAI from 'openai';
import { config } from '@/config';

export class EmbeddingService {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({ apiKey: config.openai.apiKey });
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Truncate text to avoid token limits (text-embedding-3-small has 8191 token limit)
        const truncated = text.substring(0, 25000);

        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: truncated,
        });

        return response.data[0].embedding;
    }
}
