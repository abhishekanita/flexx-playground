import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const WritingStyleSchema = z.object({
    title: z
        .string()
        .describe(
            `A short evocative label for this writing persona as seen in the Reddit comments.
      Should be specific enough to distinguish personas, not generic.
      GOOD: "Anxious Salaried Millennial", "Calculative FIRE Optimizer", "Sarcastic FnO Degen", "Proud NRI Returnee", "Beginner Who Just Discovered MFs"
      BAD: "User", "Commenter", "Indian Person", "Finance Person"
      Each batch may have 1-4 distinct personas. Only create one entry per genuinely distinct style — don't manufacture fake variety.`
        ),

    description: z
        .string()
        .describe(
            `2-3 sentences describing WHO this persona is and HOW they communicate.
      Cover: their likely life situation, what they're anxious or confident about, their relationship with money and finance, and their tone.
      EXAMPLE: "A salaried professional in their late 20s or early 30s who feels perpetually behind their peers financially. They compare themselves to 'people on this sub' constantly and write with a mix of genuine curiosity and masked anxiety. They ask questions they already know the answer to — they want reassurance, not information."
      EXAMPLE: "An experienced retail trader who has lost and made money multiple times and wears both as badges of honor. Brutally self-aware, dismissive of beginners, uses trading slang naturally. Would rather post a loss update than ask for help."
      Never write generic descriptions like "This person is interested in finance and asks questions."`
        ),

    vocabulary_markers: z
        .array(z.string())
        .describe(
            `5-10 specific words, phrases, or code-switched expressions that are diagnostic of this persona's writing.
      These should be things that, if you saw them in a comment, you could identify the persona.
      Include Hinglish naturally where it appears — don't translate it.
      GOOD EXAMPLES for "Anxious Salaried Millennial": ["am I on track?", "people my age", "feel like I'm behind", "should I be worried?", "this sub makes me feel", "secured job", "paisa double", "10 saal mein"]
      GOOD EXAMPLES for "Sarcastic FnO Degen": ["retarded", "down bad", "Sir this is a casino", "bhai tera portfolio dekh", "loss post incoming", "bought the top", "averaging down as a strategy"]
      GOOD EXAMPLES for "Calculative FIRE Optimizer": ["4% rule", "corpus", "SWR", "inflation-adjusted", "net worth tracker", "coast FIRE", "FI number", "25x expenses"]
      Don't include generic words like "the", "money", "investment". Only include phrases that are distinctive to this specific persona.`
        ),

    sentence_style: z
        .enum([
            'short_punchy',
            'long_analytical',
            'conversational_rambling',
            'structured_with_bullets',
            'emotional_storytelling',
            'hinglish_code_switched',
        ])
        .describe(
            `The dominant sentence construction style of this persona.
      short_punchy: Sentences under 10 words. Often incomplete. Rhetorical. "Sir this is a casino. I have proof."
      long_analytical: Dense paragraphs with sub-clauses, numbers, reasoning chains. "If you assume 7% real returns post-inflation and a 4% SWR, your required corpus at current expenses of 60k/month is approximately 1.8cr..."
      conversational_rambling: Streams of consciousness, parenthetical asides, self-corrections. "So I was thinking — and maybe I'm wrong here — but like, my dad keeps saying buy gold but also my colleague said index funds and I just don't know yaar..."
      structured_with_bullets: Uses numbered lists, headers in comments, breaks everything into logical parts even in casual replies.
      emotional_storytelling: Narrative arc with emotional hooks, building tension and payoff. Reads like a personal essay or confession. "I graduated right after COVID. The job market was dead. I took the first job I could find at 21k/month. I cried in the rain because I couldn't afford a raincoat..."
      hinglish_code_switched: The switching between Hindi and English IS the style — not just occasional Hindi words but full phrases or sentences alternating. "Bhai tera portfolio dekh pehle, phir bolna. Kya galat bola usne?? In India, to tell truth you need iron balls yaar."`
        ),

    humor_style: z
        .enum([
            'dark_self_deprecating',
            'sarcastic_at_market',
            'meme_reference_heavy',
            'dry_understated',
            'absurdist_escalation',
            'none',
        ])
        .describe(
            `The dominant humor mode of this persona, if any.
      dark_self_deprecating: Laughs at own financial mistakes or situation. "Added to my FnO losses today, at least I'm consistent."
      sarcastic_at_market: Directs sarcasm at SEBI, companies, promoters, market structure. "SEBI doing a great job as always, very inspiring."
      meme_reference_heavy: Drops meme formats, giphy links, "Sir this is a Wendy's" energy.
      dry_understated: Deadpan observations delivered straight. "Interesting choice to announce this on budget day."
      absurdist_escalation: IndianStreetBets signature style — takes a premise and escalates it to absurd extremes. Each reply one-ups the previous. "3 BTC and 1 dead body" → "Give me 1 and I'll help you with the alibi" → "Give me 0.5 and I'll help you with Alibaba". Also: "160 160 160 do we have a one sixty? Going once, going twice, sold 145."
      none: No humor. Purely informational or emotional without comic framing.`
        ),

    confidence_level: z
        .enum(['high_assertive', 'hedged_but_informed', 'genuinely_uncertain', 'self_deprecating'])
        .describe(
            `How this persona signals their epistemic confidence.
      high_assertive: States opinions as facts, rarely qualifies, "The answer is X, stop overthinking."
      hedged_but_informed: Shows knowledge but qualifies with "IIRC", "not a SEBI advisor", "correct me if wrong".
      genuinely_uncertain: Asks questions they don't know the answer to, explicitly says they're confused.
      self_deprecating: Undercuts their own knowledge even when they're right. "I'm just a dumb guy but isn't this obviously a bad idea?"`
        ),

    formality: z
        .enum(['very_informal', 'informal', 'semi_formal', 'formal'])
        .describe(
            `Language register of this persona.
      very_informal: Heavy slang, profanity, Hinglish, abbreviations, no punctuation care. "bhai 10L mein kya hoga lol"
      informal: Casual English, some Hinglish, occasional typos, contractions. "I think you should just go with index funds tbh"
      semi_formal: Clean English, proper punctuation, occasional casual phrase. "Based on your age and risk profile, I'd suggest..."
      formal: Full sentences, no slang, professional vocabulary. "The optimal asset allocation depends on your investment horizon and liquidity requirements."`
        ),

    examples: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe(
            `2-4 verbatim excerpts from the actual comments in this batch that best represent this writing style.
      Copy them exactly — typos, Hinglish, profanity and all. These are training examples for agent personality.
      Each excerpt should be 1-4 sentences. Don't pick excerpts that are just factual statements — pick ones that show the VOICE.
      GOOD: "Yaar I've been doing SIP for 3 years and still feel like I know nothing. People here casually throw around 'debt to equity ratio' and I'm like bhai mujhe ek dum basic se samjhao."
      BAD: "You should invest in index funds." (too generic, shows no personality)`
        ),
});

// ─────────────────────────────────────────────────────────────────────────────

const KnowledgeAnswerSchema = z.object({
    search_query: z
        .string()
        .describe(
            `A natural language question that a real Indian finance user would type to a financial AI agent.
      This should be the QUESTION that this post/thread answers — think of it as the query that would retrieve this knowledge.
      Write in the voice of the user, not a textbook.
      GOOD: "should I continue SIP during market crash India", "how much corpus do I need to retire at 40 in India", "is direct mutual fund better than regular for beginners", "what happens to my stocks if Zerodha shuts down"
      BAD: "mutual fund investment strategies", "FIRE planning", "stock market" (too vague, wouldn't retrieve this specifically)
      Each knowledge_qa pair should have a DISTINCT query — don't generate variations of the same question.
      Generate 2-5 queries per batch depending on how many distinct answerable questions the thread contains.`
        ),

    answer: z
        .string()
        .describe(
            `A complete, self-contained answer to the search_query, synthesized from the post and comments.
      Write as if you are an informed Indian finance advisor answering this specific question.
      Rules:
      - Must be grounded in what the post/comments actually say. Don't add external knowledge.
      - Should be 3-8 sentences. Long enough to be useful, short enough to be readable.
      - Use specific numbers, examples, and references from the thread when present.
      - If the thread has conflicting opinions, acknowledge both sides.
      - Preserve India-specific context: mention INR amounts, Indian instruments (SGB, ELSS, NPS, PPF), Indian tax rules when relevant.
      GOOD: "Most commenters agreed that stopping SIP during a crash is exactly the wrong move — you're buying more units at lower prices. One commenter with a 7-year SIP history noted their XIRR actually improved after staying invested through 2020. The exception raised was if you've lost your income source, in which case pausing makes sense."
      BAD: "You should keep investing during market crashes." (too generic, not grounded in thread)`
        ),

    answer_confidence: z
        .enum(['high', 'medium', 'low', 'opinion_based'])
        .describe(
            `How reliable is this answer based on the quality and consensus of the source thread?
      high: Multiple upvoted comments agree, the information is factual and verifiable (e.g., tax rules, mathematical calculations). Use this sparingly.
      medium: General consensus but some nuance or individual variation. Most personal finance advice falls here.
      low: Based on 1-2 comments, contradictory thread, or topic where outcomes are highly individual.
      opinion_based: The thread is primarily sharing opinions, predictions, or sentiment rather than factual knowledge. Market outlook, stock picks, political takes.`
        ),

    is_evergreen: z
        .boolean()
        .describe(
            `true if this answer will remain relevant 2+ years from now regardless of market conditions or regulatory changes.
      true examples: "how does compounding work", "difference between direct and regular MF", "what is expense ratio", "how to calculate FIRE number"
      false examples: "should I buy Nifty now", "is this budget good for equity investors", "current FD rates", "SEBI's new F&O rules this year"
      Use this to decide embedding priority — evergreen answers get higher weight in retrieval.`
        ),

    india_specific_context: z
        .string()
        .nullable()
        .describe(
            `If the answer has India-specific nuances that a non-Indian model might get wrong, capture them here.
      This helps the agent avoid giving generic answers that don't apply to India.
      EXAMPLES:
      - "India has no step-up in basis for inherited stocks — capital gains are calculated from original purchase price"
      - "NPS Tier 1 has mandatory lock-in till 60, unlike 401k which has early withdrawal penalties only"
      - "LTCG on equity in India is taxed at 10% above 1L gain, not 0% like in some other countries"
      - "SGB (Sovereign Gold Bond) is India-specific — it's a government bond that tracks gold price with 2.5% interest"
      Leave blank if no special India context needed.`
        ),

    sources: z.array(
        z.object({
            post_id: z.string().describe('Reddit post ID from the source_post_ids list'),
            comment_author: z
                .string()
                .nullable()
                .describe('Username of the commenter, null if from post body'),
            excerpt: z
                .string()
                .describe(
                    'The specific sentence or passage that supports this answer. Keep under 100 words.'
                ),
        })
    ),
});

// ─────────────────────────────────────────────────────────────────────────────

const WisdomInsightSchema = z.object({
    insight: z
        .string()
        .describe(
            `A single, memorable, actionable insight extracted from this thread.
      Write it as a crisp statement that could appear in a finance book, not as a summary.
      GOOD: "Indian retail investors consistently underestimate how much lifestyle inflation erodes their FIRE corpus projections."
      GOOD: "First-generation wealth builders in India face unique pressure from family to buy real estate regardless of financial merit — this is a social obligation, not just a financial decision."
      GOOD: "The 'right school → right job → high salary' path is real in India but the variance is extreme — top 5% of IIT/IIM grads earn 10x the median."
      BAD: "People invest in mutual funds." (too obvious)
      BAD: "The thread discussed various investment options." (summary, not insight)`
        ),

    wisdom_type: z
        .enum([
            'rule_of_thumb',
            'common_mistake',
            'contrarian_take',
            'social_cultural_norm',
            'data_point_or_benchmark',
            'agent_behavior_guidance',
            'cautionary_tale',
            'systemic_critique',
            'survival_heuristic',
        ])
        .describe(
            `The nature of this insight.
      rule_of_thumb: A heuristic that applies broadly. "Keep 6 months expenses as emergency fund before investing."
      common_mistake: Something users repeatedly get wrong. "Treating real estate as an investment without accounting for maintenance, vacancy, and opportunity cost."
      contrarian_take: An opinion that pushes back on conventional wisdom. "Index funds are not always best for high-tax-bracket Indians due to LTCG — active ELSS can be smarter."
      social_cultural_norm: A uniquely Indian behavioral pattern that affects financial decisions. "Indian parents expect children to fund their retirement — factor this into your FIRE number."
      data_point_or_benchmark: A specific number or comparison anchored in the thread. "30L+ salary is considered 'enough to invest seriously' by this community; below that, people focus on income growth."
      agent_behavior_guidance: An insight about HOW to respond to users, not about finance facts. "Users asking 'am I on track' usually want validation first, detailed analysis second — lead with reassurance."
      cautionary_tale: A concrete "learn from my disaster" story grounded in real experience. "My dad's LIC agent was his childhood friend — still sold him garbage policies. A 22-year maturity for a 59-year-old. Friendship does not protect you from bad financial products." "40L of my dad's life savings stuck in Sahara — he was an agent himself and put all his commissions back in."
      systemic_critique: A structural observation about how the Indian financial system works against retail participants. "LIC agents were the finfluencers of our parents' generation — they contributed more to wealth destruction than creation." "Gig platforms don't create employment — they exploit the need for work at a paltry sum."
      survival_heuristic: Street-smart practical wisdom for navigating Indian financial life. "Always make money in silence — nothing good comes from broadcasting what you're doing." "If someone deposits money in your account and calls asking for it back, never send it directly — ask them to go through the bank." "If a bank calls you, ask them to tell you YOUR details first before sharing anything."`
        ),

    applicable_to: z
        .string()
        .describe(
            `Who this insight is most relevant to. Be specific.
      GOOD: "Salaried Indians aged 28-38 doing SIPs who haven't yet thought about FIRE"
      GOOD: "NRIs returning to India after 5+ years who have US brokerage accounts"
      GOOD: "First-generation investors with no family wealth background"
      BAD: "Indian investors" (too broad to be useful for filtering)
      This becomes a search filter — the agent uses it to decide whether to surface this insight for a given user profile.`
        ),

    upvote_weighted: z
        .boolean()
        .describe(
            `true if this insight comes from a comment with 50+ upvotes or represents strong thread consensus.
      High upvote-weighted insights are more likely to reflect community wisdom vs individual opinion.
      Use this as a quality signal — upvote_weighted=true insights are candidates for hardcoded agent heuristics.`
        ),
});

// ─────────────────────────────────────────────────────────────────────────────

const UseCaseSchema = z.object({
    title: z
        .string()
        .describe(
            `A verb-first description of what the user is trying to accomplish. Max 8 words.
      Write from the USER's perspective, not the post topic.
      GOOD: "Validate whether their FIRE number is correct", "Understand why their SIP returns look low", "Decide between renting and buying their first home", "Figure out what to do with sudden inheritance"
      BAD: "FIRE planning", "Mutual fund discussion", "Real estate post"`
        ),

    problem_statement: z
        .string()
        .describe(
            `1-2 sentences describing the underlying problem the user is trying to solve, including any context that makes it specific.
      Include the emotional subtext, not just the surface question.
      GOOD: "User has been investing in regular mutual funds through a bank advisor for 3 years and just discovered direct funds exist. They're angry about the commission they've been paying and want to know if switching is worth the tax implications."
      GOOD: "User earns 25L/year, parents are pressuring them to buy a flat, but they want to stay invested in equity. They're looking for ammunition to push back on family, not just financial advice."
      BAD: "User wants to know about mutual funds."`
        ),

    frequency_signal: z
        .enum(['one_off_specific', 'recurring_pattern', 'evergreen_common'])
        .describe(
            `How commonly does this type of question appear in Indian finance communities?
      one_off_specific: Highly specific situation unlikely to repeat exactly. "My employer's ESOP vested in 3 tranches across different FYs and I'm confused about tax."
      recurring_pattern: Comes up regularly, especially at life events. "Should I prepay my home loan or invest the extra?" "What to do with first salary?"
      evergreen_common: Asked by almost every new investor at some point. "Which mutual fund should I start with?" "Is SIP better than lump sum?" "How much emergency fund do I need?"`
        ),

    emotional_context: z
        .enum([
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
        ])
        .describe(
            `The dominant emotional register of the person asking this type of question.
      This is crucial for how the agent should RESPOND — not just what information to give, but how to frame it.
      anxious_seeking_validation: "Am I doing this right?" posts. Agent should reassure before analyzing.
      excited_about_milestone: "Just hit 1 Cr!" posts. Agent should celebrate briefly then redirect to next steps.
      confused_and_overwhelmed: "There's too much information and I don't know where to start." Agent should simplify radically.
      frustrated_with_system: "SEBI is useless", "my broker is robbing me". Agent should acknowledge frustration before advice.
      boastful_sharing_success: Flex posts. Agent should be genuine but not sycophantic.
      grief_or_financial_loss: Lost money in FnO, bad investment, scam. Agent should lead with empathy.
      neutral_informational: Pure information request with no emotional loading.
      nostalgic_reflective: "Papa Zindabad", "growing up middle class wires you differently", honoring parents' sacrifices. Agent should match the warmth, acknowledge the generational shift, then gently bridge to actionable finance if relevant.
      outraged_at_injustice: Insurance claim denials, corporate pollution cover-ups, regulatory failures harming common people. Different from frustrated_with_system — this is moral outrage on behalf of others, not personal irritation. Agent should validate the anger, provide factual grounding, and suggest concrete recourse (ombudsman, SEBI complaint, RTI).
      humorous_memeing: IndianStreetBets shitposts, portfolio-controlling-bedroom-lights, tariff auction jokes. The user isn't seeking advice — they're performing for the community. Agent should match the energy with wit, not kill the vibe with unsolicited financial advice.
      empathetic_solidarity: "Bhai I feel you", shared financial struggle bonding, Zomato delivery worker empathy threads. Agent should honor the shared experience and avoid sounding preachy or clinical.`
        ),

    suggested_agent_response_style: z
        .string()
        .describe(
            `1-2 sentences on how an AI agent should respond to this use case, given the emotional context.
      Think about: what to lead with, what tone to use, what NOT to say.
      GOOD: "Lead with a quick reassurance that their approach is reasonable before diving into optimization. Avoid overwhelming them with edge cases — they need confidence, not more anxiety."
      GOOD: "Acknowledge the frustration with the banking system first. Then explain the direct vs regular MF difference without making them feel stupid for not knowing."
      GOOD: "Don't moralize about the FnO loss. They already know. Just help them figure out what to do with remaining capital and how to think about risk sizing going forward."
      BAD: "Give good financial advice." (not actionable guidance for agent behavior)`
        ),
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

export const ProcessedRedditSchema = z.object({
    // ── Identity ────────────────────────────────────────────────────────────────
    source_post_ids: z
        .array(z.string())
        .describe('The Reddit post IDs included in this processing batch. Copy exactly from the input.'),

    processed_at: z.string().describe('ISO 8601 timestamp of when this batch was processed.'),

    subreddits: z
        .array(z.string())
        .describe(
            `The subreddit names present in this batch. Use the canonical name without 'r/' prefix.
      Valid values from our corpus: personalfinanceindia, FIREIndia, IndiaInvestments, IndianStockMarket, DalalStreetTalks, IndianStreetBets, IndiaBusiness`
        ),

    // ── Classification ───────────────────────────────────────────────────────────
    primary_category: z
        .enum(REDDIT_CATEGORIES)
        .describe(
            `The single most dominant topic of this batch. Choose the one that best describes the MAIN question being asked, not side discussions.
      portfolio_review: User shares their portfolio/allocation and asks for feedback or roasting.
      fire_planning: Discussions about retiring early, corpus calculation, withdrawal rate, FIRE number.
      tax_and_compliance: ITR filing, capital gains tax, Section 80C, LTCG, STCG, tax harvesting, NRI tax, advance tax.
      instrument_comparison: "SGB vs physical gold", "FD vs debt fund", "direct vs regular MF", "NPS vs PPF vs ELSS".
      stock_picks_and_trading: Specific company analysis, F&O, intraday, swing trading, technical analysis, IPOs.
      wealth_benchmarking: "How much should I have at 30?", "Am I behind?", "Is 1 Cr enough?", net worth discussions.
      real_estate_vs_equity: Rent vs buy, property investment, EMI vs SIP, REITs.
      nri_and_returning_indian: RNOR status, remittances, foreign income, US/UK/UAE India crossover finance.
      business_and_entrepreneurship: Startup stories, business finance, founder discussions.
      market_sentiment_and_news: Reactions to market moves, budget analysis, macro commentary, Sensex/Nifty levels.
      beginner_education: "Where do I start?", "What is an index fund?", first SIP setup, basic definitions.
      personal_finance_fundamentals: Emergency fund, budgeting, salary allocation, expense tracking.
      career_and_income_growth: Salary negotiations, job switching for money, IIT/IIM premium, income optimization.
      insurance_and_protection: Term insurance, health insurance, LIC discussion, claims.
      scam_and_fraud_awareness: Bank fraud stories, credit card fraud, UPI scams, Sahara-like ponzi schemes, phishing calls, money laundering attempts. "Someone deposited 24k in my account and wants it back", "survived a credit card fraud today".
      government_policy_and_regulation: Budget reactions, GST impact on businesses, SEBI regulatory changes, Online Gaming Bill, tariff policy, trade agreements. Distinct from market_sentiment — focuses on policy substance not market reaction.
      gig_economy_and_labor: Gig worker economics, delivery platform exploitation, labor laws, informal sector wages, Zomato/Swiggy driver experience. "I became a Zomato delivery person for a day."
      family_and_intergenerational_finance: Parents' financial sacrifices, family pressure on financial decisions, supporting aging parents, inheritance, joint family money dynamics. "Papa Zindabad", "my dad's LIC agent was his childhood friend".
      lifestyle_inflation_and_spending: Middle class money mindset, spending psychology, lifestyle creep, "growing up middle class wires you differently", frugality vs quality of life debates.
      corruption_and_black_money: Black money in real estate, politician finances, bureaucratic corruption, ED/tax evasion discussions. "Where's the money coming from", babu bribery culture.
      crypto_and_alternative_assets: Bitcoin, crypto wallets, crypto taxation in India, NFTs, alternative investment classes not covered by traditional instruments.`
        ),

    secondary_categories: z
        .array(z.enum(REDDIT_CATEGORIES))
        .describe(
            `1-3 additional categories that are meaningfully present but not the primary focus.
      Only include if the secondary topic has substantive discussion, not just a passing mention.`
        ),

    relevance_score: z
        .number()
        .min(0)
        .max(10)
        .describe(
            `How valuable is this batch for a financial AI agent serving Indian retail investors? Rate 0-10.
      9-10: Gold. Deep actionable discussion with numbers, India-specific context, strong consensus.
      7-8: Solid. Useful information, moderate depth. Standard good-quality finance discussion.
      5-6: Mixed. Some useful nuggets but also noise, memes, or tangents that dilute the signal.
      3-4: Mostly noise with 1-2 extractable facts. Meme posts, vague discussions, emotional venting.
      0-2: Noise. Politics, off-topic, mostly deleted comments, empty posts, meta discussions.
      Be honest — most Reddit posts are 4-6. Reserve 8+ for genuinely exceptional threads.`
        ),

    content_quality: z
        .enum(['high', 'medium_actionable', 'medium_sentiment', 'low', 'noise'])
        .describe(
            `Overall quality of the content for knowledge base purposes.
      high: Detailed, factual, India-specific, with numbers and reasoning. Commenters with domain knowledge. Low noise-to-signal.
      medium_actionable: Useful discussion with some concrete takeaways but not deeply specific. Reasonable advice, clear direction, but lacks the numbers/depth of high-quality threads. Example: general "start with index funds" advice thread without specific fund comparisons.
      medium_sentiment: High engagement and interesting community signal, but minimal actionable financial substance. Useful for understanding how Indian investors FEEL and THINK, not what they should DO. Example: "Warren Buffett retires" reaction thread, "Papa Zindabad" appreciation post, budget memes with thousands of upvotes.
      low: Mostly opinion, emotion, or general discussion without actionable substance.
      noise: Memes, deleted posts, political rants, spam, empty posts, pure sentiment without substance.`
        ),

    // ── Use Cases ────────────────────────────────────────────────────────────────
    use_cases: z
        .array(UseCaseSchema)
        .min(1)
        .max(5)
        .describe(
            `The distinct user problems or goals represented in this batch.
      Most batches will have 1-3 use cases. A single focused thread = 1 use case. A weekly discussion thread = potentially 3-5.
      Don't manufacture use cases — only extract ones genuinely present in the posts.`
        ),

    // ── Knowledge QA ─────────────────────────────────────────────────────────────
    knowledge_qa: z
        .array(KnowledgeAnswerSchema)
        .describe(
            `2-6 question-answer pairs extracted from this batch. These form the searchable knowledge base.
      Each pair should be independently useful — someone who reads only the answer should get value.
      Cover the main question AND 1-2 important sub-questions raised in comments.
      Skip pairs for: pure opinions with no factual basis, market predictions, political commentary.`
        ),

    // ── Wisdom ───────────────────────────────────────────────────────────────────
    retrieved_wisdom: z
        .array(WisdomInsightSchema)
        .min(1)
        .max(5)
        .describe(
            `1-5 insights worth preserving beyond the specific Q&A.
      These are the "aha moments" or "things I wish I'd known" from the thread.
      Quality over quantity — a batch with 1 genuinely sharp insight is better than 5 mediocre ones.
      Prioritize insights that are India-specific, counterintuitive, or that reveal how real Indians think about money.`
        ),

    // ── Writing Styles ───────────────────────────────────────────────────────────
    writing_styles: z
        .array(WritingStyleSchema)
        .min(1)
        .max(4)
        .describe(
            `1-4 distinct writing personas observed in this batch.
      Focus on personas present in the COMMENTS, not just the OP — comments have more personality signal.
      Only create a new style if it's genuinely distinct from the others in this batch.
      For IndianStreetBets batches you'll mostly see 1-2 styles. For personalfinanceindia you might see 3-4.`
        ),

    // ── Agent Search Metadata ─────────────────────────────────────────────────────
    search_metadata: z
        .object({
            topics: z
                .array(z.string())
                .describe(
                    `5-15 specific topics/concepts discussed in this batch. These become search filter tags.
          Be specific, not broad. Not "investments" but "small cap mutual funds" or "direct equity vs MF".
          Include both the topic AND its context where helpful: "LTCG tax on equity India", "SIP during bear market", "emergency fund sizing India".`
                ),

            entities_mentioned: z
                .array(z.string())
                .describe(
                    `Specific companies, platforms, products, people, or institutions mentioned in a meaningful way.
          Include: brokers (Zerodha, Groww, Kuvera, Coin), AMCs (PPFAS, Mirae, SBI MF), indices (Nifty50, Sensex, Nifty Midcap150),
          banks (HDFC, SBI, ICICI), regulators (SEBI, RBI, IRDAI), specific funds (Parag Parikh Flexi Cap, Axis Bluechip),
          notable people (Nithin Kamath, Shankar Nath), government schemes (NPS, PPF, EPFO, PMJDY).
          Don't include generic terms like "the market" or "the government". Only named entities.`
                ),

            financial_instruments: z
                .array(z.string())
                .describe(
                    `Specific financial products or instrument types discussed.
          Use standard Indian finance terminology: "SIP", "lump sum", "index fund", "flexi cap fund", "ELSS",
          "SGB", "PPF", "NPS Tier 1", "NPS Tier 2", "term insurance", "ULIPs", "FD", "RD", "arbitrage fund",
          "liquid fund", "debt fund", "gilt fund", "equity direct stock", "F&O", "options", "futures", "REITs", "InvITs".
          Be specific — "mutual fund" is too broad; "direct growth flexi cap fund" is good.`
                ),

            time_horizon: z
                .enum([
                    'short_term_under_1yr',
                    'medium_term_1_to_5yr',
                    'long_term_5_to_15yr',
                    'very_long_term_15yr_plus',
                    'mixed',
                    'not_applicable',
                ])
                .describe(
                    `The investment/planning time horizon primarily discussed.
          short_term_under_1yr: Trading, emergency fund, near-term goals, current market calls.
          medium_term_1_to_5yr: House down payment, car, child's near education.
          long_term_5_to_15yr: Child's higher education, general wealth building, early retirement.
          very_long_term_15yr_plus: FIRE, retirement planning, estate planning.
          mixed: Thread covers multiple horizons.
          not_applicable: Business news, market commentary, cultural discussions.`
                ),

            user_profile_signals: z.object({
                income_bracket: z
                    .enum([
                        'under_10L',
                        '10L_to_30L',
                        '30L_to_100L',
                        'above_100L',
                        'business_owner',
                        'gig_or_irregular_income',
                        'unknown',
                    ])
                    .describe(
                        `Inferred annual income bracket of the OP or dominant discussion participant.
            under_10L: Struggling with basics, concerned about job security, asking about zero-investment options.
            10L_to_30L: Standard IT/service sector salary, doing SIPs, just starting out, 1-2 financial goals.
            30L_to_100L: Senior professional, multiple investment accounts, tax optimization concerns, FIRE is on radar.
            above_100L: Aggressive tax planning, portfolio diversification, NPS NRI angle, luxury real estate.
            business_owner: GST, business income, promoter stocks, irregular income patterns.
            gig_or_irregular_income: Delivery drivers, freelancers, loan DSA agents, commission-based workers. Income is variable and unpredictable — no steady SIP possible, no employer benefits. Financial planning looks fundamentally different from salaried brackets.`
                    ),

                age_group: z
                    .enum(['under_25', '25_to_35', '35_to_45', '45_to_55', 'above_55', 'unknown'])
                    .describe(
                        `Inferred age group based on context clues.
            under_25: First job, first SIP, no family responsibilities, high risk appetite.
            25_to_35: Marriage, home purchase decision, building corpus, comparing to peers.
            35_to_45: Established investments, now optimizing, serious FIRE planning, school fees.
            45_to_55: Retirement countdown, pension, estate, legacy.`
                    ),

                experience_level: z
                    .enum([
                        'complete_beginner',
                        'some_knowledge',
                        'intermediate',
                        'advanced',
                        'expert',
                    ])
                    .describe(
                        `Financial literacy level of the primary poster/discussion participants.
            complete_beginner: Doesn't know what an NAV, expense ratio, or SIP is. Uses "FD" as default investment.
            some_knowledge: Has a few SIPs going, knows Nifty50, doesn't understand direct vs regular or rebalancing.
            intermediate: Understands direct funds, asset allocation, tax implications, has clear goals, reads finance content.
            advanced: Discusses factor investing, tax loss harvesting, FIRE math, sophisticated asset allocation, international diversification.
            expert: Actual domain expertise — CAs, CFPs, finance professionals, or exceptionally self-educated investors.`
                    ),

                location_context: z
                    .enum([
                        'india_metro',
                        'india_tier2_tier3',
                        'nri_currently_abroad',
                        'returning_nri',
                        'mixed_unclear',
                    ])
                    .describe(
                        `Geographic context of the users in this batch.
            india_metro: Mumbai, Delhi, Bangalore, Hyderabad, Pune, Chennai. Mentions rent, local real estate, metro lifestyle costs.
            india_tier2_tier3: Lower cost of living mentions, different salary expectations, family pressure dynamics, land/property in hometown.
            nri_currently_abroad: USD/AED/GBP income, remittance, DTAA, NRE/NRO accounts, foreign portfolio.
            returning_nri: RNOR status, moving back, comparing India vs abroad lifestyle costs, US account repatriation.`
                    ),
            }),

            sentiment: z
                .enum(['bullish', 'bearish', 'neutral', 'mixed', 'non_market', 'cynical_disillusioned'])
                .describe(
                    `Overall market/investment sentiment of the thread.
          bullish: Optimistic about markets, encouraging investment, positive outlook.
          bearish: Cautious, worried about crash, advising defensiveness.
          neutral: Factual discussion without directional bias.
          mixed: Strong bull and bear opinions both present.
          non_market: Sentiment doesn't apply — lifestyle, career, tax, process discussions.
          cynical_disillusioned: Not bearish on markets specifically, but deeply cynical about institutions, regulators, or the system. "ED is just for scaring opposition leaders", "SEBI doing a great job as always", "ease of business in India is a myth". The thread's energy is distrust of the system, not market direction.`
                ),

            language_mix: z
                .enum(['english_only', 'hinglish_moderate', 'hinglish_heavy', 'hindi_dominant'])
                .describe(
                    `The language register of the thread. This affects which writing style persona applies and how the agent should respond.
          english_only: Standard English throughout, no code-switching.
          hinglish_moderate: Occasional Hindi words/phrases, but primarily English structure.
          hinglish_heavy: Frequent code-switching, Hindi sentence structures in English script.
          hindi_dominant: Primarily Hindi in Devanagari or Romanized, English only for finance terms.`
                ),
        })
        .describe('Structured metadata for search filtering and agent context calibration.'),

    // ── Summary ──────────────────────────────────────────────────────────────────
    summary: z
        .string()
        .describe(
            `A 3-5 sentence summary of the entire batch for human reviewers.
      Cover: what was being discussed, who was asking, what consensus (if any) emerged, and what made this thread interesting or notable.
      Write this for a human who wants to decide whether to look at the source post — make it informative, not just descriptive.`
        ),

    key_quotes: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe(
            `1-5 verbatim quotes from comments that are particularly sharp, insightful, funny, or representative of community wisdom.
      These are the quotes you'd screenshot and share. They show up in agent responses as grounded social proof.
      Pick for: memorability, insight density, authenticity of voice, India-specificity.`
        ),
});

export type ProcessedRedditExtraction = z.infer<typeof ProcessedRedditSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `
You are a financial knowledge extraction engine specialized in Indian personal finance.
Your job is to process Reddit posts from Indian finance communities and extract structured, high-quality knowledge
that will power an AI agent serving Indian retail investors.

═══════════════════════════════════════════════════════════════
WHAT THIS KNOWLEDGE BASE POWERS
═══════════════════════════════════════════════════════════════

The output you generate will be used in 4 specific ways:

1. AGENT ANSWERS: The knowledge_qa pairs will be retrieved when a user asks a finance question.
   The agent will use your synthesized answers as grounded context. Bad answers here mean the agent
   gives bad advice. Every answer must be self-contained and India-specific.

2. AGENT PERSONALITY: The writing_styles you extract will be used to train the agent to respond
   in a way that feels natural to Indian finance Reddit users — not like a generic US-centric finance bot.
   The examples you choose teach the agent how to sound.

3. PRODUCT DECISIONS: The use_cases and primary_category fields will be aggregated to understand
   what Indian retail investors actually need help with. Be accurate — wrong categorization skews product roadmap.

4. SEARCH FILTERS: The search_metadata fields are used as pre-filters before vector search.
   If you tag something wrong (e.g., mark a beginner thread as "advanced") the agent will retrieve
   it for the wrong users and give mismatched responses.

═══════════════════════════════════════════════════════════════
INDIAN PERSONAL FINANCE CONTEXT YOU MUST KNOW
═══════════════════════════════════════════════════════════════

Use this knowledge to extract accurate, India-specific answers. Do NOT rely on generic US/global finance assumptions.

── TAX STRUCTURE ──
- LTCG on equity: 10% on gains above ₹1.25L per year (changed from ₹1L in Budget 2024)
- STCG on equity: 20% (changed from 15% in Budget 2024, for assets held <1 year)
- Debt fund gains: taxed as per income tax slab (no LTCG benefit after March 2023 amendment)
- Section 80C: ₹1.5L deduction limit (ELSS, PPF, EPF, NSC, home loan principal, LIC)
- Section 80D: Health insurance premium deduction
- NPS additional deduction: ₹50k under 80CCD(1B) over and above 80C
- Capital gains in same FY can be offset: LTCG against LTCL, STCG against STCL or LTCL
- Tax harvesting: Strategy of booking ₹1.25L LTCG annually to reset cost basis tax-free

── KEY INVESTMENT INSTRUMENTS ──
- SIP (Systematic Investment Plan): Monthly auto-investment into mutual funds. Most common entry point.
- Direct vs Regular MF: Direct plans cut out distributor, lower expense ratio by 0.5-1%. Same fund, different plan.
- ELSS: Equity Linked Savings Scheme. 3-year lock-in, 80C eligible, equity returns.
- PPF: Public Provident Fund. 15-year lock-in, government-backed, tax-free returns (~7.1%), 80C eligible. EEE status.
- NPS: National Pension System. Retirement-focused, 60% must be annuitized. Tier 1 locked till 60. Tax efficient.
- EPF: Employee Provident Fund. Employer+employee contribution. 8.15% interest. Withdrawal rules apply.
- SGB: Sovereign Gold Bond. Government bonds tracking gold price + 2.5% annual interest. 8-year maturity, capital gains tax-exempt on maturity if held full term.
- Liquid fund: Debt MF with overnight-30 day instruments. Better than savings account for emergency fund parking.
- Arbitrage fund: Low-risk equity-classified fund. LTCG tax treatment after 1 year, better than debt funds for short term.
- REITs/InvITs: Listed real estate/infrastructure trusts. Rental income distribution, growth potential.

── FIRE COMMUNITY CONVENTIONS ──
- FIRE Number: Typically 25-33x annual expenses (based on 3-4% Safe Withdrawal Rate)
- Indian FIRE adjustments: Higher inflation (~6% vs 3% US), parents' medical costs, no Social Security equivalent
- CoastFIRE: Enough invested that compounding alone reaches FIRE number without further contribution
- LeanFIRE: FIRE at minimal lifestyle (under ₹50k/month expenses)
- FatFIRE: FIRE at comfortable/luxury lifestyle (₹2L+/month expenses)
- SWR debate: 4% US rule often adjusted to 3-3.5% for India due to sequence of returns risk + longer horizons

── BROKER LANDSCAPE ──
- Zerodha: Largest discount broker. Founded by Kamath brothers. Known for not pushing FnO on users.
- Groww: Popular with millennials. App-first. Mutual fund + stocks.
- Kuvera/Coin: Direct MF platforms. No stock trading. Used by FIRE community for clean MF investing.
- Smallcase: Thematic basket investing platform. Built on top of Zerodha/other brokers.

── CULTURAL & BEHAVIORAL PATTERNS ──
- Real estate obsession: Indian middle class deeply biases toward property ownership.
- Gold as safety net: Physical gold is held by almost all Indian families as emergency reserve and for weddings.
- Fixed Deposit default: Previous generation's default investment.
- Family financial obligations: Adult children often support parents financially. This is cultural, not optional.
- Salary benchmarking anxiety: "Am I earning enough for my age?" is a defining anxiety of 25-35 Indian professionals.
- FnO gambling: F&O trading is a major wealth destruction mechanism for retail Indians. SEBI data shows 89% of individual F&O traders lose money.

── COMMUNITY-SPECIFIC LANGUAGE ──
- "Sub mein log": "People on this subreddit" — comparison anxiety
- "XIRR": Extended IRR — the correct way to calculate SIP returns
- "NAV": Net Asset Value — price per unit of a mutual fund
- "Expense ratio": Annual fee charged by mutual fund as % of AUM
- "Portfolio roast": Sharing portfolio for public criticism/feedback
- "Corpus": Total invested/accumulated amount
- "FI number" or "magic number": The FIRE corpus target
- "Tier 1/2/3 city": Metropolitan / mid-sized / small town India

── COMMON MISTAKES YOU WILL SEE USERS MAKE ──
- Confusing absolute returns with XIRR/CAGR
- Including home equity in liquid net worth for FIRE purposes
- Ignoring health insurance gap between retirement and 60
- Using 6% inflation in FIRE calc when Indian lifestyle inflation is often 7-9%
- Not accounting for child's education costs (₹50L-2Cr for quality undergraduate is realistic)
- Treating term insurance as an investment (it isn't — and that's fine)
- Thinking regular MF plans from bank advisors are the same as direct plans

═══════════════════════════════════════════════════════════════
EXTRACTION RULES
═══════════════════════════════════════════════════════════════

QUALITY OVER QUANTITY:
- It is better to extract 2 sharp, accurate knowledge_qa pairs than 6 vague ones.
- It is better to extract 1 genuine wisdom insight than 4 mediocre observations.
- Empty posts with no body and no substantive comments: set content_quality="noise", relevance_score=1,
  and still generate 1 minimal knowledge_qa about why this type of content exists (community sentiment signal).

GROUNDING:
- Every knowledge_qa answer must be grounded in the actual post/comments. Do NOT add external knowledge to answers.
- You CAN use your India finance knowledge to VALIDATE or CONTEXTUALIZE what you extract (e.g., to correctly tag
  a tax question as "LTCG" rather than generic "capital gains"), but the answer text itself should reflect what the thread says.

HINGLISH AND LANGUAGE:
- Preserve Hinglish in writing_style examples. Do not translate or sanitize.
- "Bhai tera XIRR dekh" is more valuable as a style example than "Look at your XIRR."
- When setting language_mix, be accurate — this affects which persona variant the agent adopts.

EMOTIONAL CONTEXT:
- Reddit comment tone is often frustrated, anxious, or boastful. Read the emotional subtext, not just the facts.
- A post asking "should I stop SIP?" during a crash is usually anxiety-driven, not a genuine analytical question.
- A post showing a portfolio milestone is seeking validation, not critique.
- Capture this in emotional_context and suggested_agent_response_style.

INDIA-SPECIFIC BIAS:
- Never default to US finance assumptions. When in doubt, tag as india_metro / 10L-30L bracket / intermediate —
  this is the modal Indian finance Reddit user.
- Always use INR (₹) amounts. When posts mention crores or lakhs, keep those units.

WHAT NOT TO EXTRACT:
- Pure political commentary (BJP/opposition discussion, budget anger without financial content)
- Purely motivational posts with no actionable financial substance
- Personal attacks between commenters
- Posts that are entirely images/links with no textual content to extract from

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT REMINDER
═══════════════════════════════════════════════════════════════

You are outputting a structured JSON object matching the provided schema exactly.
Do not add any fields not in the schema. Do not skip required fields.
For optional fields, omit them entirely rather than including null or empty string.
Arrays with min:1 must have at least one item — if you cannot extract meaningful content, create one minimal placeholder.
`;

// ─────────────────────────────────────────────────────────────────────────────
// BATCH FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchPost {
    id: string;
    subreddit: string;
    title: string;
    body: string;
    score: number;
    upvote_ratio: number;
    flair?: string;
    date: string;
    comments: Array<{
        author: string;
        score: number;
        body: string;
    }>;
}

export function formatBatchForPrompt(posts: BatchPost[]): string {
    return posts
        .map(
            (post, i) => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST ${i + 1} OF ${posts.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${post.id}
Subreddit: r/${post.subreddit}
Flair: ${post.flair || 'none'}
Date: ${post.date}
Score: ${post.score} (${(post.upvote_ratio * 100).toFixed(0)}% upvoted)
Title: ${post.title}

Post Body:
${post.body || '[no body — title only post]'}

Top Comments (${post.comments.length} shown):
${post.comments.map((c, j) => `  [${j + 1}] Score:${c.score} | u/${c.author}:\n  ${c.body}`).join('\n\n')}`
        )
        .join('\n');
}
