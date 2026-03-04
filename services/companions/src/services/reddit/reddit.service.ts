import fs from 'fs';
import path from 'path';
import { RedditProcessedModel, KnowledgeSearchModel } from '@/schema';
import { createExportSession, saveJSON } from '@/utils/data-export';

interface ExportFilters {
    subreddit?: string;
    primaryCategory?: string;
    minRelevanceScore?: number;
    contentQuality?: string;
    sentiment?: string;
    incomeBracket?: string;
    ageGroup?: string;
    experienceLevel?: string;
    fromDate?: Date;
    toDate?: Date;
}

type ExportFormat = 'json' | 'csv';

function toCsvRow(values: (string | number | boolean | undefined | null)[]): string {
    return values
        .map((v) => {
            if (v == null) return '';
            const str = String(v);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        })
        .join(',');
}

function buildFilterQuery(filters: ExportFilters) {
    const query: Record<string, any> = {};
    if (filters.subreddit) query.subreddits = filters.subreddit;
    if (filters.primaryCategory) query.primaryCategory = filters.primaryCategory;
    if (filters.minRelevanceScore) query.relevanceScore = { $gte: filters.minRelevanceScore };
    if (filters.contentQuality) query.contentQuality = filters.contentQuality;
    if (filters.sentiment) query.sentiment = filters.sentiment;
    if (filters.incomeBracket) query.incomeBracket = filters.incomeBracket;
    if (filters.ageGroup) query.ageGroup = filters.ageGroup;
    if (filters.experienceLevel) query.experienceLevel = filters.experienceLevel;
    if (filters.fromDate || filters.toDate) {
        query.processedAt = {};
        if (filters.fromDate) query.processedAt.$gte = filters.fromDate;
        if (filters.toDate) query.processedAt.$lte = filters.toDate;
    }
    return query;
}

class RedditService {
    /**
     * Export RedditProcessed documents to JSON or CSV file.
     */
    async exportProcessed(format: ExportFormat = 'json', filters: ExportFilters = {}): Promise<string> {
        const query = buildFilterQuery(filters);
        const docs = await RedditProcessedModel.find(query).lean();
        const sessionDir = createExportSession('reddit-processed');

        if (format === 'csv') {
            const headers = [
                'sourcePostIds', 'subreddits', 'primaryCategory', 'secondaryCategories',
                'relevanceScore', 'contentQuality', 'summary', 'keyQuotes', 'sentiment',
                'languageMix', 'incomeBracket', 'ageGroup', 'experienceLevel', 'processedAt',
            ];
            const rows = docs.map((d) =>
                toCsvRow([
                    d.sourcePostIds?.join(';'), d.subreddits?.join(';'), d.primaryCategory,
                    d.secondaryCategories?.join(';'), d.relevanceScore, d.contentQuality,
                    d.summary, d.keyQuotes?.join(';'), d.sentiment, d.languageMix,
                    d.incomeBracket, d.ageGroup, d.experienceLevel, d.processedAt?.toISOString(),
                ])
            );
            const csv = [toCsvRow(headers), ...rows].join('\n');
            const filePath = path.join(sessionDir, 'reddit-processed.csv');
            fs.writeFileSync(filePath, csv, 'utf-8');
            return filePath;
        }

        return saveJSON(sessionDir, 'reddit-processed', docs);
    }

    /**
     * Export KnowledgeSearch documents to JSON or CSV file.
     */
    async exportKnowledgeSearch(format: ExportFormat = 'json', filters: ExportFilters = {}): Promise<string> {
        const query = buildFilterQuery(filters);
        const docs = await KnowledgeSearchModel.find(query).lean();
        const sessionDir = createExportSession('knowledge-search');

        if (format === 'csv') {
            const headers = [
                'searchQuery', 'answer', 'answerConfidence', 'isEvergreen',
                'indiaSpecificContext', 'primaryCategory', 'topics', 'financialInstruments',
                'entitiesMentioned', 'sentiment', 'timeHorizon', 'incomeBracket',
                'ageGroup', 'experienceLevel', 'relevanceScore', 'contentQuality', 'createdAt',
            ];
            const rows = docs.map((d) =>
                toCsvRow([
                    d.searchQuery, d.answer, d.answerConfidence, d.isEvergreen,
                    d.indiaSpecificContext, d.primaryCategory, d.topics?.join(';'),
                    d.financialInstruments?.join(';'), d.entitiesMentioned?.join(';'),
                    d.sentiment, d.timeHorizon, d.incomeBracket, d.ageGroup,
                    d.experienceLevel, d.relevanceScore, d.contentQuality,
                    d.createdAt?.toISOString(),
                ])
            );
            const csv = [toCsvRow(headers), ...rows].join('\n');
            const filePath = path.join(sessionDir, 'knowledge-search.csv');
            fs.writeFileSync(filePath, csv, 'utf-8');
            return filePath;
        }

        return saveJSON(sessionDir, 'knowledge-search', docs);
    }

    /**
     * Export both RedditProcessed and KnowledgeSearch to a single session folder.
     */
    async exportAll(format: ExportFormat = 'json', filters: ExportFilters = {}): Promise<string> {
        const query = buildFilterQuery(filters);
        const [processed, knowledge] = await Promise.all([
            RedditProcessedModel.find(query).lean(),
            KnowledgeSearchModel.find(query).lean(),
        ]);

        const sessionDir = createExportSession('reddit-export');

        if (format === 'csv') {
            // processed csv
            const pHeaders = [
                'sourcePostIds', 'subreddits', 'primaryCategory', 'secondaryCategories',
                'relevanceScore', 'contentQuality', 'summary', 'keyQuotes', 'sentiment',
                'languageMix', 'incomeBracket', 'ageGroup', 'experienceLevel', 'processedAt',
            ];
            const pRows = processed.map((d) =>
                toCsvRow([
                    d.sourcePostIds?.join(';'), d.subreddits?.join(';'), d.primaryCategory,
                    d.secondaryCategories?.join(';'), d.relevanceScore, d.contentQuality,
                    d.summary, d.keyQuotes?.join(';'), d.sentiment, d.languageMix,
                    d.incomeBracket, d.ageGroup, d.experienceLevel, d.processedAt?.toISOString(),
                ])
            );
            fs.writeFileSync(
                path.join(sessionDir, 'reddit-processed.csv'),
                [toCsvRow(pHeaders), ...pRows].join('\n'),
                'utf-8'
            );

            // knowledge csv
            const kHeaders = [
                'searchQuery', 'answer', 'answerConfidence', 'isEvergreen',
                'indiaSpecificContext', 'primaryCategory', 'topics', 'financialInstruments',
                'entitiesMentioned', 'sentiment', 'timeHorizon', 'incomeBracket',
                'ageGroup', 'experienceLevel', 'relevanceScore', 'contentQuality', 'createdAt',
            ];
            const kRows = knowledge.map((d) =>
                toCsvRow([
                    d.searchQuery, d.answer, d.answerConfidence, d.isEvergreen,
                    d.indiaSpecificContext, d.primaryCategory, d.topics?.join(';'),
                    d.financialInstruments?.join(';'), d.entitiesMentioned?.join(';'),
                    d.sentiment, d.timeHorizon, d.incomeBracket, d.ageGroup,
                    d.experienceLevel, d.relevanceScore, d.contentQuality,
                    d.createdAt?.toISOString(),
                ])
            );
            fs.writeFileSync(
                path.join(sessionDir, 'knowledge-search.csv'),
                [toCsvRow(kHeaders), ...kRows].join('\n'),
                'utf-8'
            );
        } else {
            saveJSON(sessionDir, 'reddit-processed', processed);
            saveJSON(sessionDir, 'knowledge-search', knowledge);
        }

        return sessionDir;
    }
}

export default new RedditService();
