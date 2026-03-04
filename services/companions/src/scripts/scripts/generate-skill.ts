import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { RedditProcessedModel, KnowledgeSearchModel, YouTubeVideoModel, KnowledgeBaseModel } from '@/schema';
import { EmbeddingService } from '@/services/processing/embedding.service';
import Parallel from 'parallel-web';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_ID = 'gpt-5-mini';

const openai = createOpenAI({
    apiKey: config.openai.apiKey,
});

const embeddingService = new EmbeddingService();

const parallel = new Parallel({
    apiKey: config.parallel.apiKey,
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: GENERATE SEARCH QUERIES FROM USER PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SearchQuerySchema = z.object({
    skillName: z.string().describe('Kebab-case name for the skill file, e.g. "mutual-funds", "tax-season", "nri-investing". Max 3 words.'),
    semanticSearchQueries: z
        .array(z.string())
        .min(3)
        .max(8)
        .describe(
            'Natural language queries to embed and search against knowledge-search collection. Each should be a distinct question a user would ask about this topic. e.g. "How to pick the best ELSS fund?", "Should I stop SIP during a crash?"'
        ),
    redditFilters: z.object({
        primaryCategories: z
            .array(z.string())
            .describe(
                'Reddit category enums to match. Options: portfolio_review, fire_planning, tax_and_compliance, instrument_comparison, stock_picks_and_trading, wealth_benchmarking, real_estate_vs_equity, nri_and_returning_indian, business_and_entrepreneurship, market_sentiment_and_news, beginner_education, personal_finance_fundamentals, career_and_income_growth, insurance_and_protection, scam_and_fraud_awareness, government_policy_and_regulation, gig_economy_and_labor, family_and_intergenerational_finance, lifestyle_inflation_and_spending, corruption_and_black_money, crypto_and_alternative_assets, other'
            ),
        keywordRegexParts: z
            .array(z.string())
            .min(5)
            .max(30)
            .describe(
                'Regex-safe keywords/phrases to search across summary, keyQuotes, extraction fields. Include variations, abbreviations, Hinglish terms. e.g. ["mutual fund", "SIP", "index fund", "lump.?sum", "direct.?plan", "NAV", "expense ratio"]'
            ),
    }),
    youtubeFilters: z.object({
        titleKeywords: z
            .array(z.string())
            .min(5)
            .max(20)
            .describe(
                'Keywords/phrases to regex-match against YouTube video titles. Include Hinglish. e.g. ["mutual fund", "SIP", "index fund", "best fund", "NAV"]'
            ),
        tagKeywords: z
            .array(z.string())
            .min(3)
            .max(15)
            .describe('Tags to match in YouTube video tags array (case-insensitive exact match)'),
    }),
    knowledgeBaseFilters: z.object({
        topics: z
            .array(z.string())
            .describe(
                'Topic enums to match. Options: savings, investments, insurance, loans, tax-planning, mutual-funds, stocks, real-estate, retirement, budgeting, credit, banking, crypto, gold, government-schemes, financial-planning, trading, other'
            ),
        financialProductKeywords: z
            .array(z.string())
            .min(3)
            .max(15)
            .describe('Financial product names to regex-match against financialProducts field'),
    }),
});

type SearchQueries = z.infer<typeof SearchQuerySchema>;

async function generateSearchQueries(userPrompt: string): Promise<SearchQueries> {
    const { object } = await generateObject({
        model: openai(MODEL_ID),
        schema: SearchQuerySchema,
        system: `You are a search query generator for an Indian personal finance knowledge base.
Given a user's description of a skill they want to create, generate comprehensive search queries to find all relevant data across three MongoDB collections:

1. **reddit-processed**: Contains processed Reddit posts from Indian finance subreddits (r/IndiaInvestments, r/personalfinanceindia, etc.). Has fields: summary, keyQuotes, primaryCategory, extraction.retrieved_wisdom, extraction.knowledge_qa, extraction.use_cases, extraction.search_metadata.topics/entities/instruments.

2. **youtube-videos**: Contains scraped YouTube videos from Indian finance creators (CA Rachana Ranade, Warikoo, Pranjal Kamra, etc.). Has fields: title, tags, description, channelName.

3. **knowledge-search**: Contains flattened Q&A pairs with embeddings from Reddit. Has fields: searchQuery, answer, topics, financialInstruments, entitiesMentioned, primaryCategory, embedding.

4. **knowledge-base**: Contains processed YouTube entries. Has fields: title, summary, keyInsights, topic, subTopics, financialProducts, embedding.

IMPORTANT for keywordRegexParts: Use SIMPLE keywords only. No regex special characters (no \\b, no \\d, no lookaheads, no backreferences). Only use: literal words, dots for optional chars (like .? between words), and pipe-safe terms. Examples of GOOD keywords: "mutual fund", "SIP", "index fund", "direct.?plan". Examples of BAD keywords: "\\bNRI\\b", "D\\.D\\.T\\b?", "broker.*NRI|NRI.*broker".

IMPORTANT for primaryCategories: Be VERY selective. Only pick categories that are DIRECTLY and specifically about the topic. Do NOT pick broad categories like "instrument_comparison", "portfolio_review", "beginner_education", "personal_finance_fundamentals" unless the skill is specifically about those topics. For a topic like "gold investing", pick at most 1-2 very specific categories. When in doubt, use FEWER categories — the keyword search will catch relevant docs from other categories.

Be exhaustive with keywords — include abbreviations, Hinglish terms, alternate spellings, and related sub-topics. Keywords are the primary retrieval mechanism, so be thorough here.`,
        prompt: userPrompt,
    });
    return object;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: EXECUTE SEARCHES
// ─────────────────────────────────────────────────────────────────────────────

interface SearchResults {
    reddit: {
        totalDocs: number;
        wisdom: any[];
        useCases: any[];
        knowledgeQA: any[];
        keyQuotes: string[];
        summaries: string[];
    };
    youtube: {
        totalVideos: number;
        videos: any[];
    };
    knowledgeSearch: {
        totalDocs: number;
        qaPairs: any[];
    };
    knowledgeBase: {
        totalDocs: number;
        entries: any[];
    };
    deepResearch: {
        content: string;
        citations: { url: string; title?: string | null }[];
    } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2A: PARALLEL DEEP RESEARCH (with local task cache)
// ─────────────────────────────────────────────────────────────────────────────

const TASK_CACHE_PATH = path.join(__dirname, '..', '..', '..', '.parallel-task-cache.json');

interface TaskCacheEntry {
    runId: string;
    status: string;
    promptHash: string;
    createdAt: string;
    skillName: string;
}

function getPromptHash(prompt: string): string {
    return crypto.createHash('sha256').update(prompt.trim().toLowerCase()).digest('hex').substring(0, 16);
}

function loadTaskCache(): Record<string, TaskCacheEntry> {
    try {
        if (fs.existsSync(TASK_CACHE_PATH)) {
            return JSON.parse(fs.readFileSync(TASK_CACHE_PATH, 'utf-8'));
        }
    } catch {
        // corrupted cache — start fresh
    }
    return {};
}

function saveTaskCache(cache: Record<string, TaskCacheEntry>): void {
    fs.writeFileSync(TASK_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function fetchTaskResult(runId: string): Promise<SearchResults['deepResearch']> {
    const result = await parallel.taskRun.result(runId);
    const content = result.output.type === 'text' ? result.output.content : JSON.stringify(result.output.content, null, 2);
    const citations: { url: string; title?: string | null }[] = [];

    if (result.output.basis) {
        for (const b of result.output.basis) {
            if (b.citations) {
                for (const c of b.citations) {
                    citations.push({ url: c.url, title: c.title });
                }
            }
        }
    }

    return { content, citations };
}

async function runDeepResearch(userPrompt: string, skillName: string): Promise<SearchResults['deepResearch']> {
    if (!config.parallel.apiKey) {
        console.log('  Skipping deep research (no PARALLEL_API_KEY set)');
        return null;
    }

    const promptHash = getPromptHash(userPrompt);
    const cache = loadTaskCache();

    // Check if we already have a task for this exact prompt
    if (cache[promptHash]) {
        const cached = cache[promptHash];
        console.log(`  Found cached task: ${cached.runId} (hash: ${promptHash})`);

        // Check current status
        const updated = await parallel.taskRun.retrieve(cached.runId);
        console.log(`  Cached task status: ${updated.status}`);

        if (updated.status === 'completed') {
            console.log(`  Using cached completed result — no new task created`);
            const result = await fetchTaskResult(cached.runId);
            console.log(`  Deep research loaded: ${(result!.content.length / 1024).toFixed(0)} KB, ${result!.citations.length} citations`);
            return result;
        }

        if (updated.status === 'queued' || updated.status === 'running') {
            console.log(`  Task still in progress — waiting for completion...`);
            // Fall through to polling loop below with the existing run_id
            return await pollAndFetchResult(cached.runId, cache, promptHash);
        }

        // Failed/cancelled — will create a new task below
        console.log(`  Cached task ${updated.status} — creating a new one`);
    }

    const researchPrompt = `You are researching the topic of "${skillName}" for an Indian personal finance knowledge base. The target audience is Indian retail investors and salaried individuals.

Create an extremely comprehensive research report covering:

1. **Regulatory Framework**: All SEBI, RBI, IRDAI, PFRDA, Income Tax circulars, rules, and regulations relevant to this topic in India. Include specific circular numbers, dates, and key provisions.

2. **Current Rules & Limits**: All current tax rules, exemptions, limits, thresholds, deduction caps (Section 80C, 80D, 80CCD, etc.), TDS rates, LTCG/STCG rates, surcharges — whatever is applicable to this topic.

3. **Product Landscape**: All financial products, instruments, schemes, platforms relevant to this topic in India. Compare features, costs, returns, lock-in periods, liquidity, taxation.

4. **Historical Context**: How regulations, taxation, and products in this space have evolved in India over the last 10 years. Key policy changes and their impact.

5. **Common Pitfalls & Risks**: What goes wrong for Indian retail investors in this area. Hidden charges, tax traps, liquidity issues, fraud patterns.

6. **Expert Consensus**: What do financial planners, SEBI-registered investment advisors, and respected voices in the Indian personal finance community recommend?

7. **India-Specific Nuances**: Cultural factors, behavioral patterns, platform-specific quirks (Zerodha, Groww, Kuvera, MFCentral, CAMS, KFintech), documentation requirements, KYC rules.

8. **Recent Developments (2024-2026)**: Any budget changes, new regulations, new products, or market developments affecting this topic.

9. **Numerical Benchmarks**: Specific numbers — typical returns, expense ratios, fees, tax rates, minimum investment amounts, lock-in periods. Be precise with ₹ amounts.

10. **Comparison Tables**: Where applicable, create comparison tables between competing options (e.g., SGB vs Gold ETF vs Physical Gold, or NPS vs PPF vs ELSS).

The user's specific request: "${userPrompt}"

Be exhaustive. Include specific numbers, dates, circular references. This will be used to train an AI financial assistant for Indian users.`;

    console.log('  Creating Parallel deep research task...');
    const taskRun = await parallel.taskRun.create({
        input: researchPrompt,
        processor: 'ultra',
    });
    console.log(`  Task created: ${taskRun.run_id} (hash: ${promptHash})`);

    // Save to cache immediately so we never re-create for same prompt
    cache[promptHash] = {
        runId: taskRun.run_id,
        status: taskRun.status,
        promptHash,
        createdAt: new Date().toISOString(),
        skillName,
    };
    saveTaskCache(cache);

    return await pollAndFetchResult(taskRun.run_id, cache, promptHash);
}

async function pollAndFetchResult(
    runId: string,
    cache: Record<string, TaskCacheEntry>,
    promptHash: string
): Promise<SearchResults['deepResearch']> {
    console.log('  Waiting for deep research to complete...');
    let lastStatus = '';
    const startTime = Date.now();

    while (true) {
        const updated = await parallel.taskRun.retrieve(runId);
        if (updated.status !== lastStatus) {
            lastStatus = updated.status;
            console.log(`  Research status: ${updated.status} (${Math.round((Date.now() - startTime) / 1000)}s)`);

            // Update cache with latest status
            if (cache[promptHash]) {
                cache[promptHash].status = updated.status;
                saveTaskCache(cache);
            }
        }
        if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'cancelled') {
            break;
        }
        await new Promise(r => setTimeout(r, 5000));
    }

    if (lastStatus !== 'completed') {
        console.log(`  Deep research ${lastStatus} — skipping`);
        return null;
    }

    const result = await fetchTaskResult(runId);
    console.log(`  Deep research complete: ${(result!.content.length / 1024).toFixed(0)} KB, ${result!.citations.length} citations`);
    return result;
}

function sanitizeRegexPart(part: string): string {
    // Remove problematic regex constructs while keeping simple patterns intact
    return part
        .replace(/\\b/g, '') // remove word boundaries
        .replace(/\\d/g, '[0-9]') // replace \d with character class
        .replace(/\(\?[=!<]/g, '') // remove lookaheads/lookbehinds
        .replace(/[{}[\]()^$]/g, m => '\\' + m) // escape special chars
        .trim();
}

function buildSafeRegex(parts: string[]): RegExp {
    const sanitized = parts.map(sanitizeRegexPart).filter(p => p.length > 0);
    try {
        return new RegExp(sanitized.join('|'), 'i');
    } catch {
        // Fallback: escape everything and just do literal matching
        const escaped = parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp(escaped.join('|'), 'i');
    }
}

// Check if a text blob matches any of the topic keywords (used for post-retrieval filtering)
function computeRelevanceScore(text: string, keywords: string[]): number {
    const lower = text.toLowerCase();
    let matches = 0;
    for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase().replace(/\.\?/g, ''))) matches++;
    }
    return matches;
}

async function executeSearches(queries: SearchQueries): Promise<SearchResults> {
    const keywordRegex = buildSafeRegex(queries.redditFilters.keywordRegexParts);
    const ytTitleRegex = buildSafeRegex(queries.youtubeFilters.titleKeywords);
    const kbProductRegex = buildSafeRegex(queries.knowledgeBaseFilters.financialProductKeywords);

    // Lowercase keywords for post-retrieval relevance scoring
    const topicKeywords = queries.redditFilters.keywordRegexParts.map(k => k.toLowerCase().replace(/\.\?/g, '').replace(/\\/g, ''));

    // --- Reddit Processed ---
    // Strategy: Two queries — (1) category + keyword, (2) keyword-only across all fields
    // This ensures category matches are topic-relevant, not just broadly categorized
    console.log('  Searching reddit-processed...');

    // Query A: Docs in relevant categories that ALSO match keywords (targeted)
    const categoryWithKeywordDocs =
        queries.redditFilters.primaryCategories.length > 0
            ? await RedditProcessedModel.find({
                  $and: [
                      { primaryCategory: { $in: queries.redditFilters.primaryCategories } },
                      {
                          $or: [
                              { summary: { $regex: keywordRegex } },
                              { keyQuotes: { $regex: keywordRegex } },
                              { 'extraction.search_metadata.topics': { $regex: keywordRegex } },
                              { 'extraction.search_metadata.financial_instruments': { $regex: keywordRegex } },
                              { 'extraction.retrieved_wisdom.insight': { $regex: keywordRegex } },
                              { 'extraction.use_cases.title': { $regex: keywordRegex } },
                              { 'extraction.use_cases.problem_statement': { $regex: keywordRegex } },
                          ],
                      },
                  ],
              }).lean()
            : [];
    console.log(`    Category+keyword query: ${categoryWithKeywordDocs.length} docs`);

    // Query B: Keyword-only across key text fields (catches docs in other categories)
    const keywordOnlyDocs = await RedditProcessedModel.find({
        $or: [
            { summary: { $regex: keywordRegex } },
            { keyQuotes: { $regex: keywordRegex } },
            { 'extraction.search_metadata.topics': { $regex: keywordRegex } },
            { 'extraction.search_metadata.financial_instruments': { $regex: keywordRegex } },
            { 'extraction.retrieved_wisdom.insight': { $regex: keywordRegex } },
        ],
    }).lean();
    console.log(`    Keyword-only query: ${keywordOnlyDocs.length} docs`);

    // Merge and deduplicate
    const seenRedditIds = new Set<string>();
    const allRedditDocs: any[] = [];
    for (const doc of [...categoryWithKeywordDocs, ...keywordOnlyDocs]) {
        const id = doc._id.toString();
        if (!seenRedditIds.has(id)) {
            seenRedditIds.add(id);
            allRedditDocs.push(doc);
        }
    }
    console.log(`    Merged & deduped: ${allRedditDocs.length} reddit docs`);

    // Extract structured data with per-item relevance filtering
    const wisdom: any[] = [];
    const useCases: any[] = [];
    const knowledgeQA: any[] = [];
    const keyQuotes: string[] = [];
    const summaries: string[] = [];

    for (const doc of allRedditDocs) {
        const ext = doc.extraction || {};

        // Filter individual wisdom items — only keep those that mention topic keywords
        if (ext.retrieved_wisdom) {
            for (const w of ext.retrieved_wisdom) {
                const applicableTo = Array.isArray(w.applicable_to) ? w.applicable_to.join(' ') : w.applicable_to || '';
                const textBlob = `${w.insight || ''} ${applicableTo}`;
                const score = computeRelevanceScore(textBlob, topicKeywords);
                if (score > 0) {
                    wisdom.push({ ...w, topicScore: score, relevanceScore: doc.relevanceScore, category: doc.primaryCategory });
                }
            }
        }

        // Filter use cases
        if (ext.use_cases) {
            for (const uc of ext.use_cases) {
                const textBlob = `${uc.title || ''} ${uc.problem_statement || ''}`;
                const score = computeRelevanceScore(textBlob, topicKeywords);
                if (score > 0) {
                    useCases.push({ ...uc, topicScore: score, relevanceScore: doc.relevanceScore, category: doc.primaryCategory });
                }
            }
        }

        // Filter QA
        if (ext.knowledge_qa) {
            for (const qa of ext.knowledge_qa) {
                const textBlob = `${qa.search_query || ''} ${qa.answer || ''}`;
                const score = computeRelevanceScore(textBlob, topicKeywords);
                if (score > 0) {
                    knowledgeQA.push({ ...qa, topicScore: score, relevanceScore: doc.relevanceScore, category: doc.primaryCategory });
                }
            }
        }

        // Filter quotes — only include if they match keywords
        if (doc.keyQuotes) {
            for (const q of doc.keyQuotes) {
                if (computeRelevanceScore(q, topicKeywords) > 0) keyQuotes.push(q);
            }
        }
        if (doc.summary) summaries.push(doc.summary);
    }

    console.log(
        `    After relevance filtering: ${wisdom.length} wisdom, ${useCases.length} use cases, ${knowledgeQA.length} QA, ${keyQuotes.length} quotes`
    );

    // --- YouTube Videos ---
    console.log('  Searching youtube-videos...');
    const ytTagsLower = queries.youtubeFilters.tagKeywords.map(t => t.toLowerCase());
    const ytDocs = await YouTubeVideoModel.find({
        $or: [{ title: { $regex: ytTitleRegex } }, { tags: { $in: ytTagsLower } }, { description: { $regex: ytTitleRegex } }],
    })
        .select('title channelName viewCount likeCount commentCount duration publishedAt tags description')
        .sort({ viewCount: -1 })
        .limit(200)
        .lean();
    console.log(`    Found ${ytDocs.length} youtube videos`);

    const videos = ytDocs.map(v => ({
        title: v.title,
        channel: v.channelName,
        views: v.viewCount,
        likes: v.likeCount,
        comments: v.commentCount,
        duration: v.duration,
        publishedAt: v.publishedAt,
        description: (v.description || '').substring(0, 300),
    }));

    // --- Knowledge Search (semantic + keyword) ---
    console.log('  Searching knowledge-search (semantic + keyword)...');
    const allSemanticResults: any[] = [];

    // Try vector search first via $vectorSearch aggregation
    let vectorSearchWorked = false;
    for (const query of queries.semanticSearchQueries) {
        try {
            const embedding = await embeddingService.generateEmbedding(query);

            const vectorResults = await KnowledgeSearchModel.aggregate([
                {
                    $vectorSearch: {
                        index: 'vector_index',
                        path: 'embedding',
                        queryVector: embedding,
                        numCandidates: 100,
                        limit: 20,
                    },
                },
                {
                    $project: {
                        embedding: 0,
                        score: { $meta: 'vectorSearchScore' },
                    },
                },
            ]);

            if (vectorResults.length > 0) {
                vectorSearchWorked = true;
                allSemanticResults.push(...vectorResults);
            }
        } catch (err: any) {
            // Vector search not available — will fall back to keyword below
            if (!vectorSearchWorked) {
                console.log(`    Vector search not available (${err.message?.substring(0, 80)}), falling back to keyword`);
            }
            break;
        }
    }

    // Fallback: keyword search if vector search didn't work
    if (!vectorSearchWorked) {
        const keywordResults = await KnowledgeSearchModel.find({
            $or: [
                { searchQuery: { $regex: keywordRegex } },
                { answer: { $regex: keywordRegex } },
                { topics: { $regex: keywordRegex } },
                { financialInstruments: { $regex: keywordRegex } },
            ],
        })
            .select('-embedding')
            .limit(200)
            .lean();
        allSemanticResults.push(...keywordResults);
    }

    // Deduplicate by _id
    const seenIds = new Set<string>();
    const dedupedKS = allSemanticResults.filter(doc => {
        const id = doc._id.toString();
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
    });
    console.log(`    Found ${dedupedKS.length} knowledge-search docs (deduped)`);

    const qaPairs = dedupedKS.map(doc => ({
        question: doc.searchQuery,
        answer: doc.answer,
        confidence: doc.answerConfidence,
        evergreen: doc.isEvergreen,
        indiaContext: doc.indiaSpecificContext,
        category: doc.primaryCategory,
        topics: doc.topics,
        instruments: doc.financialInstruments,
        relevance: doc.relevanceScore,
        vectorScore: doc.score,
    }));

    // --- Knowledge Base (YouTube processed) ---
    console.log('  Searching knowledge-base...');
    const kbDocs = await KnowledgeBaseModel.find({
        $or: [
            { topic: { $in: queries.knowledgeBaseFilters.topics } },
            { financialProducts: { $regex: kbProductRegex } },
            { subTopics: { $regex: kbProductRegex } },
            { summary: { $regex: ytTitleRegex } },
        ],
    })
        .select('-embedding')
        .limit(200)
        .lean();
    console.log(`    Found ${kbDocs.length} knowledge-base docs`);

    const kbEntries = kbDocs.map(doc => ({
        title: doc.title,
        summary: doc.summary,
        insights: doc.keyInsights,
        topic: doc.topic,
        subTopics: doc.subTopics,
        products: doc.financialProducts,
        audience: doc.targetAudience,
        actionability: doc.actionability,
        relevance: doc.relevanceScore,
        sentiment: doc.sentiment,
    }));

    return {
        reddit: { totalDocs: allRedditDocs.length, wisdom, useCases, knowledgeQA, keyQuotes, summaries },
        youtube: { totalVideos: ytDocs.length, videos },
        knowledgeSearch: { totalDocs: dedupedKS.length, qaPairs },
        knowledgeBase: { totalDocs: kbDocs.length, entries: kbEntries },
        deepResearch: null, // populated separately in main()
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: COMPILE SEARCH RESULTS INTO CONTEXT MARKDOWN
// ─────────────────────────────────────────────────────────────────────────────

function compileContext(results: SearchResults, queries: SearchQueries): string {
    const lines: string[] = [];

    lines.push(`# Research Data for Skill: "${queries.skillName}"\n`);

    // --- Stats ---
    lines.push(`## Data Overview`);
    lines.push(`- Reddit processed docs: ${results.reddit.totalDocs}`);
    lines.push(`- Reddit wisdom insights: ${results.reddit.wisdom.length}`);
    lines.push(`- Reddit use cases: ${results.reddit.useCases.length}`);
    lines.push(`- Reddit knowledge QA: ${results.reddit.knowledgeQA.length}`);
    lines.push(`- Reddit key quotes: ${results.reddit.keyQuotes.length}`);
    lines.push(`- YouTube videos: ${results.youtube.totalVideos}`);
    lines.push(`- Knowledge search QA pairs: ${results.knowledgeSearch.totalDocs}`);
    lines.push(`- Knowledge base entries: ${results.knowledgeBase.totalDocs}`);
    lines.push(`- Deep research: ${results.deepResearch ? 'Yes' : 'No'}`);
    lines.push('');

    // --- Deep Research (place first — it's the most authoritative source) ---
    if (results.deepResearch) {
        lines.push(`## Deep Research Report (Web Research)\n`);
        lines.push(results.deepResearch.content);
        lines.push('');
        if (results.deepResearch.citations.length > 0) {
            lines.push(`### Sources & Citations`);
            const seenUrls = new Set<string>();
            for (const c of results.deepResearch.citations) {
                if (!seenUrls.has(c.url)) {
                    seenUrls.add(c.url);
                    lines.push(`- [${c.title || c.url}](${c.url})`);
                }
            }
            lines.push('');
        }
    }

    // --- Wisdom (top 80 by topic relevance, then doc relevance) ---
    const topWisdom = results.reddit.wisdom
        .sort((a, b) => (b.topicScore || 0) - (a.topicScore || 0) || (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 80);
    if (topWisdom.length > 0) {
        lines.push(`## Reddit Wisdom Insights (${topWisdom.length} of ${results.reddit.wisdom.length})\n`);
        const wisdomByType: Record<string, any[]> = {};
        for (const w of topWisdom) {
            const t = w.wisdom_type || 'unknown';
            if (!wisdomByType[t]) wisdomByType[t] = [];
            wisdomByType[t].push(w);
        }
        for (const [type, items] of Object.entries(wisdomByType)) {
            lines.push(`### ${type} (${items.length})`);
            for (const w of items) {
                lines.push(`- [Score:${w.relevanceScore}] ${w.insight}`);
                lines.push(`  - Audience: ${w.applicable_to}`);
                if (w.upvote_weighted) lines.push(`  - Community consensus (upvote-weighted)`);
            }
            lines.push('');
        }
    }

    // --- Use Cases (top 50) ---
    const topUseCases = results.reddit.useCases
        .sort((a, b) => (b.topicScore || 0) - (a.topicScore || 0) || (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 50);
    if (topUseCases.length > 0) {
        lines.push(`## Reddit User Problems / Use Cases (${topUseCases.length} of ${results.reddit.useCases.length})\n`);
        for (const uc of topUseCases) {
            lines.push(`- **${uc.title}**`);
            lines.push(`  - Problem: ${uc.problem_statement}`);
            lines.push(`  - Emotion: ${uc.emotional_context} | Frequency: ${uc.frequency_signal}`);
            lines.push(`  - Agent response style: ${uc.suggested_agent_response_style}`);
        }
        lines.push('');
    }

    // --- Knowledge QA (top 60) ---
    const topQA = results.reddit.knowledgeQA
        .sort((a, b) => (b.topicScore || 0) - (a.topicScore || 0) || (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 60);
    if (topQA.length > 0) {
        lines.push(`## Reddit Knowledge Q&A (${topQA.length} of ${results.reddit.knowledgeQA.length})\n`);
        for (const qa of topQA) {
            lines.push(`### Q: ${qa.search_query}`);
            lines.push(`A: ${qa.answer}`);
            lines.push(`Confidence: ${qa.answer_confidence} | Evergreen: ${qa.is_evergreen ? 'Yes' : 'No'}`);
            if (qa.india_specific_context) lines.push(`India context: ${qa.india_specific_context}`);
            lines.push('');
        }
    }

    // --- Key Quotes (top 50) ---
    if (results.reddit.keyQuotes.length > 0) {
        lines.push(`## Reddit Key Quotes (${Math.min(50, results.reddit.keyQuotes.length)} of ${results.reddit.keyQuotes.length})\n`);
        results.reddit.keyQuotes.slice(0, 50).forEach(q => {
            lines.push(`- "${q}"`);
        });
        lines.push('');
    }

    // --- Knowledge Search QA (top 40) ---
    const topKSQA = results.knowledgeSearch.qaPairs.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 40);
    if (topKSQA.length > 0) {
        lines.push(`## Knowledge Search Q&A (${topKSQA.length} of ${results.knowledgeSearch.totalDocs})\n`);
        for (const qa of topKSQA) {
            lines.push(`### Q: ${qa.question}`);
            lines.push(`A: ${qa.answer}`);
            lines.push(`Confidence: ${qa.confidence} | Evergreen: ${qa.evergreen ? 'Yes' : 'No'}`);
            if (qa.indiaContext) lines.push(`India context: ${qa.indiaContext}`);
            lines.push('');
        }
    }

    // --- YouTube Videos (top 60) ---
    if (results.youtube.videos.length > 0) {
        lines.push(`## YouTube Videos (${results.youtube.videos.length} total, top 60 by views)\n`);
        results.youtube.videos.slice(0, 60).forEach((v, i) => {
            lines.push(`${i + 1}. [${((v.views || 0) / 1e6).toFixed(1)}M views] [${v.channel}] ${v.title}`);
            if (v.description) lines.push(`   ${v.description.substring(0, 150)}...`);
        });
        lines.push('');
    }

    // --- Knowledge Base Entries (top 30) ---
    if (results.knowledgeBase.entries.length > 0) {
        lines.push(`## Knowledge Base Entries from YouTube (${results.knowledgeBase.entries.length})\n`);
        const topKB = results.knowledgeBase.entries.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 30);
        for (const kb of topKB) {
            lines.push(`### ${kb.title}`);
            lines.push(`Summary: ${kb.summary}`);
            if (kb.insights && kb.insights.length > 0) {
                lines.push(`Insights:`);
                kb.insights.forEach((ins: string) => lines.push(`- ${ins}`));
            }
            lines.push(`Topic: ${kb.topic} | Audience: ${kb.audience} | Actionability: ${kb.actionability}`);
            lines.push('');
        }
    }

    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: GENERATE SKILL DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_GENERATION_SYSTEM = `You are an expert Indian personal finance content architect. You create comprehensive skill documents for an AI financial assistant that serves Indian retail investors.

## Your Task
Generate a skill markdown document based on the research data provided. The skill doc will be loaded into an AI agent's context when a user's query matches this topic.

## Output Format
Write a complete markdown document following this structure:

1. **Title & Introduction** — One paragraph explaining what this skill covers and when it activates.

2. **Core Rules / Golden Rules** — 4-8 community-consensus principles. Each with:
   - Clear, actionable statement
   - Supporting data or reasoning
   - A supporting quote from the research data (verbatim when available, in English)

3. **Key Concepts Explained** — Break down the important sub-topics. Use tables, comparisons, decision trees where appropriate.

4. **Common Mistakes** — 5-10 real mistakes users make, drawn from the research data.

5. **Emotional Scenarios & How to Respond** — 4-8 real emotional situations users face (anxiety, confusion, frustration, etc.). For each:
   - The user's emotional state and what they say
   - How the agent should respond (tone + content)
   - A sample response in English

6. **Decision Frameworks** — Step-by-step decision trees for common choices.

7. **Numbers & Benchmarks** — Quick-reference data points (tax rates, limits, typical returns, etc.)

8. **Tone Guidelines** — How the agent should communicate for this topic.

## Data Sources
The research data contains multiple sources. Use ALL of them:
1. **Deep Research Report** — Comprehensive web research with regulatory details, circulars, numbers, comparisons. Use this for accurate facts, tax rates, SEBI rules, product comparisons, and historical context.
2. **Reddit Wisdom** — Real community insights, cultural nuances, behavioral patterns, cautionary tales. Use this for emotional scenarios, common mistakes, street-smart advice, Hinglish quotes.
3. **YouTube Data** — Content creator analysis. Use for understanding what questions people ask and how experts explain things.
4. **Knowledge Base QA** — Structured Q&A pairs. Use for filling knowledge gaps.

When Deep Research and Reddit Wisdom disagree on facts/numbers, prefer Deep Research (it's sourced from official docs). When they disagree on user behavior/sentiment, prefer Reddit (it's real user experience).

## Critical Rules
- Ground everything in the research data. Do NOT add information not present in the data.
- Use ₹, lakhs, crores — never $ or millions.
- Write all content in clear English. Do not include Hinglish — tone and language style are handled by the main system prompt, not the skill file.
- Verbatim quotes from the research should be preserved as-is. If a quote is in Hinglish, translate it to English.
- Be specific with numbers, not vague. "₹1.5L 80C limit" not "tax deduction limit".
- Every section should have actionable takeaways, not just information.
- Use tables for comparisons. Use decision trees for choices.
- Include India-specific context (SEBI regulations, Indian platforms, cultural norms).
- The document should be comprehensive but scannable — headers, bullets, tables.
- Include specific circular/regulation references from the deep research when available.
- Target length: 400-800 lines of markdown (longer due to deep research enrichment).`;

async function generateSkillDoc(userPrompt: string, context: string, skillName: string): Promise<string> {
    const { text } = await generateText({
        model: openai(MODEL_ID),
        system: SKILL_GENERATION_SYSTEM,
        prompt: `## User's Skill Request
${userPrompt}

## Research Data
${context}

---

Generate the complete skill markdown document now. The skill name is "${skillName}".
Write the full document — do not truncate or summarize. Include all sections from the format guide.`,
    });

    return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    const userPrompt = process.argv.slice(2).join(' ');

    if (!userPrompt) {
        console.error('Usage: npx ts-node --files -r tsconfig-paths/register src/scripts/scripts/generate-skill.ts "<prompt>"');
        console.error('');
        console.error('Example:');
        console.error(
            '  "Create a skill about NRI investing in India — cover tax implications, FEMA rules, LRS limits, best platforms, repatriation, NRO vs NRE accounts, capital gains for NRIs, and common mistakes NRIs make"'
        );
        process.exit(1);
    }

    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        console.log('Connected to database\n');

        // Step 1: Generate search queries
        console.log('Step 1: Generating search queries from prompt...');
        const queries = await generateSearchQueries(userPrompt);
        console.log(`  Skill name: ${queries.skillName}`);
        console.log(`  Semantic queries: ${queries.semanticSearchQueries.length}`);
        console.log(`  Reddit categories: ${queries.redditFilters.primaryCategories.join(', ')}`);
        console.log(`  Reddit keywords: ${queries.redditFilters.keywordRegexParts.length} terms`);
        console.log(`  YouTube title keywords: ${queries.youtubeFilters.titleKeywords.length} terms`);
        console.log(`  YouTube tag keywords: ${queries.youtubeFilters.tagKeywords.length} terms`);
        console.log('');

        // Step 2: Execute MongoDB searches + Parallel deep research in parallel
        console.log('Step 2: Executing searches + deep research in parallel...');
        console.log('');
        console.log('[MongoDB Searches]');
        const [results, deepResearch] = await Promise.all([
            executeSearches(queries),
            (async () => {
                console.log('\n[Parallel Deep Research]');
                return runDeepResearch(userPrompt, queries.skillName);
            })(),
        ]);

        // Attach deep research to results
        results.deepResearch = deepResearch;
        console.log('');

        // Step 3: Compile context
        console.log('Step 3: Compiling research context...');
        const context = compileContext(results, queries);
        const contextPath = path.join(process.cwd(), `skill-research-${queries.skillName}.md`);
        fs.writeFileSync(contextPath, context);
        console.log(`  Context written to ${contextPath} (${(context.length / 1024).toFixed(0)} KB)`);
        console.log('');

        // Step 4: Generate skill document
        console.log('Step 4: Generating skill document with AI...');
        const skillDoc = await generateSkillDoc(userPrompt, context, queries.skillName);

        // Write skill file
        const skillPath = path.join(__dirname, '..', '..', 'agents', 'skills', `${queries.skillName}.md`);
        fs.writeFileSync(skillPath, skillDoc);
        console.log(`\nSkill document written to: ${skillPath}`);
        console.log(`Lines: ${skillDoc.split('\n').length}`);
        console.log(`Size: ${(skillDoc.length / 1024).toFixed(1)} KB`);

        // Summary
        console.log('\n=== GENERATION COMPLETE ===');
        console.log(`Skill: ${queries.skillName}`);
        console.log(`Sources used:`);
        console.log(
            `  - ${results.reddit.totalDocs} Reddit posts → ${results.reddit.wisdom.length} wisdom, ${results.reddit.useCases.length} use cases, ${results.reddit.knowledgeQA.length} QA`
        );
        console.log(`  - ${results.youtube.totalVideos} YouTube videos`);
        console.log(`  - ${results.knowledgeSearch.totalDocs} Knowledge search QA pairs`);
        console.log(`  - ${results.knowledgeBase.totalDocs} Knowledge base entries`);
        console.log(
            `  - Deep research: ${
                results.deepResearch
                    ? 'Yes (' +
                      (results.deepResearch.content.length / 1024).toFixed(0) +
                      ' KB, ' +
                      results.deepResearch.citations.length +
                      ' citations)'
                    : 'No'
            }`
        );
        console.log(`\nFile: ${skillPath}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error(`Fatal error: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
