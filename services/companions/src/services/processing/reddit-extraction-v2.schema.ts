import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// V2: Lean schema — same output shape as v1, minimal .describe() text.
// Goal: reduce input tokens ~60-70% by relying on the model's existing knowledge.
// ─────────────────────────────────────────────────────────────────────────────

const WritingStyleSchema = z.object({
    title: z.string().describe('Short evocative label for this writing persona, e.g. "Anxious Salaried Millennial"'),
    description: z.string().describe('2-3 sentences: who this persona is, their tone, relationship with money.'),
    vocabulary_markers: z
        .array(z.string())
        .describe('5-10 diagnostic words/phrases for this persona. Include Hinglish naturally.'),
    sentence_style: z.enum([
        'short_punchy',
        'long_analytical',
        'conversational_rambling',
        'structured_with_bullets',
        'emotional_storytelling',
        'hinglish_code_switched',
    ]),
    humor_style: z.enum([
        'dark_self_deprecating',
        'sarcastic_at_market',
        'meme_reference_heavy',
        'dry_understated',
        'absurdist_escalation',
        'none',
    ]),
    confidence_level: z.enum(['high_assertive', 'hedged_but_informed', 'genuinely_uncertain', 'self_deprecating']),
    formality: z.enum(['very_informal', 'informal', 'semi_formal', 'formal']),
    examples: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe('2-4 verbatim comment excerpts showing this voice. Copy exactly — typos, Hinglish and all.'),
});

const KnowledgeAnswerSchema = z.object({
    search_query: z
        .string()
        .describe('Natural language question an Indian finance user would ask that this thread answers.'),
    answer: z
        .string()
        .describe('3-8 sentence answer grounded in the post/comments. Use INR, India-specific instruments. Self-contained.'),
    answer_confidence: z.enum(['high', 'medium', 'low', 'opinion_based']),
    is_evergreen: z.boolean().describe('true if relevant 2+ years from now regardless of market/regulatory changes.'),
    india_specific_context: z
        .string()
        .nullable()
        .describe('India-specific nuance a non-Indian model might miss. null if not needed.'),
    sources: z.array(
        z.object({
            post_id: z.string().describe('Reddit post ID from source_post_ids.'),
            comment_author: z.string().nullable().describe('Commenter username, null if from post body.'),
            excerpt: z.string().describe('Supporting passage, under 100 words.'),
        })
    ),
});

const WisdomInsightSchema = z.object({
    insight: z.string().describe('A crisp, memorable, actionable statement — not a summary.'),
    wisdom_type: z.enum([
        'rule_of_thumb',
        'common_mistake',
        'contrarian_take',
        'social_cultural_norm',
        'data_point_or_benchmark',
        'agent_behavior_guidance',
        'cautionary_tale',
        'systemic_critique',
        'survival_heuristic',
    ]),
    applicable_to: z.string().describe('Specific audience, e.g. "Salaried Indians 28-38 doing SIPs"'),
    upvote_weighted: z.boolean().describe('true if from 50+ upvote comment or strong thread consensus.'),
});

const UseCaseSchema = z.object({
    title: z.string().describe('Verb-first, max 8 words, user perspective. e.g. "Decide between renting and buying"'),
    problem_statement: z.string().describe('1-2 sentences: the underlying problem including emotional subtext.'),
    frequency_signal: z.enum(['one_off_specific', 'recurring_pattern', 'evergreen_common']),
    emotional_context: z.enum([
        'anxious_seeking_validation',
        'excited_about_milestone',
        'confused_and_overwhelmed',
        'frustrated_with_system',
        'boastful_sharing_success',
        'grief_or_financial_loss',
        'neutral_informational',
        'nostalgic_reflective',
        'outraged_at_injustice',
        'humorous_memeing',
        'empathetic_solidarity',
    ]),
    suggested_agent_response_style: z
        .string()
        .describe('1-2 sentences on how an AI agent should respond given the emotional context.'),
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY ENUM
// ─────────────────────────────────────────────────────────────────────────────

export const REDDIT_CATEGORIES = [
    'portfolio_review',
    'fire_planning',
    'tax_and_compliance',
    'instrument_comparison',
    'stock_picks_and_trading',
    'wealth_benchmarking',
    'real_estate_vs_equity',
    'nri_and_returning_indian',
    'business_and_entrepreneurship',
    'market_sentiment_and_news',
    'beginner_education',
    'personal_finance_fundamentals',
    'career_and_income_growth',
    'insurance_and_protection',
    'scam_and_fraud_awareness',
    'government_policy_and_regulation',
    'gig_economy_and_labor',
    'family_and_intergenerational_finance',
    'lifestyle_inflation_and_spending',
    'corruption_and_black_money',
    'crypto_and_alternative_assets',
    'other',
] as const;

export type RedditCategory = (typeof REDDIT_CATEGORIES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// MASTER SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const ProcessedRedditSchemaV2 = z.object({
    source_post_ids: z.array(z.string()).describe('Reddit post IDs from this batch. Copy from input.'),
    processed_at: z.string().describe('ISO 8601 timestamp.'),
    subreddits: z.array(z.string()).describe('Subreddit names without r/ prefix.'),

    primary_category: z.enum(REDDIT_CATEGORIES).describe('Single most dominant topic of this batch.'),
    secondary_categories: z
        .array(z.enum(REDDIT_CATEGORIES))
        .describe('1-3 additional categories with substantive discussion.'),
    relevance_score: z
        .number()
        .min(0)
        .max(10)
        .describe('0-10: how valuable for an Indian finance AI agent. Most posts are 4-6. Reserve 8+ for exceptional.'),
    content_quality: z.enum(['high', 'medium_actionable', 'medium_sentiment', 'low', 'noise']),

    use_cases: z.array(UseCaseSchema).min(1).max(5).describe('1-5 distinct user problems in this batch.'),
    knowledge_qa: z
        .array(KnowledgeAnswerSchema)
        .describe('2-6 question-answer pairs. Each independently useful. Quality over quantity.'),
    retrieved_wisdom: z.array(WisdomInsightSchema).min(1).max(5).describe('1-5 insights worth preserving.'),
    writing_styles: z.array(WritingStyleSchema).min(1).max(4).describe('1-4 distinct writing personas from comments.'),

    search_metadata: z.object({
        topics: z.array(z.string()).describe('5-15 specific topics. e.g. "LTCG tax on equity India", not "investments".'),
        entities_mentioned: z
            .array(z.string())
            .describe('Named entities: brokers, AMCs, funds, indices, regulators, people.'),
        financial_instruments: z
            .array(z.string())
            .describe('Specific instruments: "ELSS", "SGB", "direct growth flexi cap fund", not "mutual fund".'),
        time_horizon: z.enum([
            'short_term_under_1yr',
            'medium_term_1_to_5yr',
            'long_term_5_to_15yr',
            'very_long_term_15yr_plus',
            'mixed',
            'not_applicable',
        ]),
        user_profile_signals: z.object({
            income_bracket: z.enum([
                'under_10L',
                '10L_to_30L',
                '30L_to_100L',
                'above_100L',
                'business_owner',
                'gig_or_irregular_income',
                'unknown',
            ]),
            age_group: z.enum(['under_25', '25_to_35', '35_to_45', '45_to_55', 'above_55', 'unknown']),
            experience_level: z.enum([
                'complete_beginner',
                'some_knowledge',
                'intermediate',
                'advanced',
                'expert',
            ]),
            location_context: z.enum([
                'india_metro',
                'india_tier2_tier3',
                'nri_currently_abroad',
                'returning_nri',
                'mixed_unclear',
            ]),
        }),
        sentiment: z.enum(['bullish', 'bearish', 'neutral', 'mixed', 'non_market', 'cynical_disillusioned']),
        language_mix: z.enum(['english_only', 'hinglish_moderate', 'hinglish_heavy', 'hindi_dominant']),
    }),

    summary: z.string().describe('3-5 sentence summary for human reviewers.'),
    key_quotes: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe('1-5 verbatim quotes that are sharp, insightful, or representative.'),
});

export type ProcessedRedditExtractionV2 = z.infer<typeof ProcessedRedditSchemaV2>;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — V2 LEAN
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT_V2 = `You are extracting structured knowledge from Indian personal finance Reddit posts for an AI agent serving Indian retail investors.

CRITICAL RULES:
- Ground all answers in the actual post/comments. Do NOT add external knowledge to answers.
- Use INR (₹), lakhs, crores. Never default to US finance assumptions.
- Preserve Hinglish verbatim in writing_style examples.
- Quality over quantity: 2 sharp QA pairs > 6 vague ones.
- Read emotional subtext: "should I stop SIP?" during a crash = anxiety, not analysis.
- For noise/empty posts: content_quality="noise", relevance_score=1, still generate 1 minimal QA.
- Do NOT extract: pure politics, motivational posts without finance substance, personal attacks, image-only posts.

INDIA FINANCE CONTEXT (use for accurate tagging, not for answer content):
- LTCG equity: 12.5% above ₹1.25L (Budget 2024). STCG equity: 20%.
- Debt funds: taxed at slab rate (no LTCG benefit post March 2023).
- 80C: ₹1.5L limit. NPS 80CCD(1B): additional ₹50k.
- Key instruments: SIP, Direct vs Regular MF, ELSS, PPF (EEE), NPS, EPF, SGB, arbitrage funds.
- FIRE: 25-33x expenses. Indian SWR typically 3-3.5% (not 4%).
- Common platforms: Zerodha, Groww, Kuvera, Coin, Smallcase.
- Cultural: real estate obsession, gold for weddings, family financial obligations, FnO gambling (89% lose per SEBI).`;

// ─────────────────────────────────────────────────────────────────────────────
// BATCH FORMATTER (shared with v1)
// ─────────────────────────────────────────────────────────────────────────────

export { type BatchPost, formatBatchForPrompt } from './reddit-extraction.schema';
