# Reddit Corpus Analysis — Insights & Agent Design Implications

> Analysis of 699 processed Reddit posts yielding 2,276 QA pairs with vector embeddings from Indian finance communities. This document captures the patterns, distributions, and strategic insights that drive our agent system design.

---

## 1. Corpus Overview

**Source**: r/IndiaInvestments (primary), r/personalfinanceindia
**Posts processed**: 699
**QA pairs generated**: 2,276 (with embeddings for RAG retrieval)
**Embedding model**: text-embedding-3-small (1536 dimensions)
**Processing**: AI-extracted use cases, emotional contexts, response styles, and structured metadata

---

## 2. Distribution Analysis

### 2.1 Primary Category Distribution

| Category | Approx Share | Notes |
|----------|-------------|-------|
| beginner_education | 18% | Highest volume — first-time investor questions, SIP basics, emergency fund |
| market_sentiment_and_news | 15% | Reactions to crashes, budget announcements, SEBI actions |
| personal_finance_fundamentals | 14% | Rent vs buy, emergency fund sizing, salary allocation |
| instrument_comparison | 12% | Index vs active, gold vs equity, SGB vs ETF, FD vs debt fund |
| government_policy_and_regulation | 10% | Budget reactions, tax law changes, SGB policy shift, SEBI orders |
| scam_and_fraud_awareness | 8% | OTP phishing, fake UPI, loan app harassment, broker fraud |
| insurance_and_protection | 7% | Term vs ULIP, health insurance claims, mis-selling experiences |
| stock_picks_and_trading | 6% | Individual stocks, portfolio allocation, F&O warnings |
| tax_and_compliance | 5% | ITR filing, 80C optimization, AIS discrepancies, HUF |
| family_and_intergenerational_finance | 3% | Estate planning, widows tracing assets, joint family finance |
| business_and_entrepreneurship | 2% | Platform/broker discussions, fintech reviews |

**Key insight**: beginner_education dominance is misleading — these users are NOT true beginners. They have "some_knowledge" or "intermediate" experience. They know what SIP means. They're confused about *which* SIP, not *what* SIP is. Prompts should not over-explain basics.

### 2.2 Sentiment Distribution

| Sentiment | Share | Agent Implication |
|-----------|-------|-------------------|
| neutral | 38% | Straightforward answers, no emotional handling needed |
| mixed | 24% | Acknowledge complexity, give clear framework |
| cynical_disillusioned | 26% | Acknowledge frustration FIRST, then practical options |
| non_market | 12% | Not market-related sentiment (family, career, etc.) |

**The cynicism is structural**: Users aren't cynical about investing — they're cynical about the *system* (SEBI capture, government rule changes, broker bad faith, media manipulation). Our agents must never sound like the institutions these users distrust.

### 2.3 Emotional Context Distribution (from use cases)

| Emotional Context | Count | % of Use Cases |
|-------------------|-------|----------------|
| confused_and_overwhelmed | ~30% | Knows enough to doubt, not enough to decide |
| anxious_seeking_validation | ~26% | Already decided, needs reassurance |
| frustrated_with_system | ~15% | Angry at institutions, needs acknowledgment |
| neutral_informational | ~12% | Just wants facts |
| outraged_at_injustice | ~8% | Specific grievance (broker fraud, policy change) |
| excited_about_milestone | ~5% | Positive — first SIP, goal reached, salary bump |
| grief_or_financial_loss | ~4% | Serious loss — scam victim, death in family, major loss |

**Design implication**: 56% of interactions need emotional handling before information delivery. The validate-first response structure is non-negotiable.

### 2.4 Experience Level Distribution

| Level | Share |
|-------|-------|
| some_knowledge | 35% |
| intermediate | 33% |
| beginner | 20% |
| advanced | 12% |

**68% are "some_knowledge" or "intermediate"** — they know the vocabulary. Don't define SIP, CAGR, FOIR. Do help them apply concepts to their specific situation.

### 2.5 Writing Style & Language

| Language Mix | Share |
|-------------|-------|
| english_only | 62% |
| hinglish_moderate | 25% |
| hinglish_heavy | 10% |
| hindi_only | 3% |

**Corpus skew**: Reddit = English-forward. Our C3/C4/C5 users will be heavier Hinglish. Agent prompts compensate by defaulting to Hinglish-moderate even when data is English-only.

### 2.6 Income Bracket Distribution

| Bracket | Share |
|---------|-------|
| 10L_to_30L | 40% |
| 30L_plus | 22% |
| unknown | 20% |
| 5L_to_10L | 12% |
| under_5L | 6% |

**C1/C2 dominated**: 62% are ₹10L+ income. This is the IndiaInvestments demographic. C3/C4/C5 representation is weak — our prompts must compensate for this gap.

---

## 3. Agent-Specific Insights

### 3.1 Arjun (General Advisor)

**Most relevant categories**: beginner_education, personal_finance_fundamentals, salary-day scenarios
**Key corpus patterns**:
- Users ask "holistic" questions spanning multiple domains — Arjun needs routing intelligence
- Emergency fund questions are the most common "beginner" question from non-beginners
- Salary allocation questions spike around month-start in the corpus
- Cross-domain questions are frequent: "SIP karun ya loan prepay?" requires Arjun to coordinate between Coach Raj and Vikram territory

**Corpus voice calibration**: Natural Hinglish, direct, specific numbers. "₹20K save kiya — solid" matches the voice users use when they're being real about money.

### 3.2 Vikram (Loan Expert)

**Most relevant categories**: personal_finance_fundamentals (loan subset), government_policy_and_regulation (rate changes)
**Key corpus patterns**:
- SIP vs prepayment is the single most debated topic in the corpus
- NBFC predatory lending stories appear with strong negative sentiment
- Home loan decisions are high-anxiety (large numbers, long commitment)
- Users want exact math, not general guidance — "₹38K savings" not "significant savings"

**Corpus voice calibration**: More serious than other agents. Precise numbers. Users discussing debt use less humor and more anxiety.

### 3.3 Ace (Stock Advisor)

**Most relevant categories**: stock_picks_and_trading, market_sentiment_and_news, instrument_comparison
**Key corpus patterns**:
- Strong anti-tip culture in the community. "Stock tips" get immediately challenged.
- Portfolio allocation discussions always start with "what % smallcap?" — concentration risk is the community's top concern
- During market crashes, community consensus is overwhelmingly "kuch mat karo" (do nothing)
- SEBI and media distrust is highest in stock-related discussions
- F&O discussions consistently end with "90% log paisa kho dete hain"

**Corpus voice calibration**: High energy but data-backed. The corpus shows users respect confident takes WITH reasoning, not just opinions.

### 3.4 Siddharth (Insurance Expert)

**Most relevant categories**: insurance_and_protection, family_and_intergenerational_finance
**Key corpus patterns**:
- Endowment/ULIP mis-sell is THE dominant insurance topic — nearly everyone has one
- "Term insurance vs endowment" is treated as settled debate in the community (term wins, always)
- Health insurance fine print horror stories (room rent caps, sub-limits) are high-engagement
- Claim settlement experiences drive brand loyalty more than premiums
- LIC emotional attachment is real — "papa ne bola LIC le" is a recurring pattern

**Corpus voice calibration**: Calm, patient, mathematical. Users want IRR calculations, not opinions. "Numbers dekh" is the community's standard for insurance analysis.

### 3.5 Samir (Credit Health)

**Most relevant categories**: credit (subset of personal_finance_fundamentals), scam_and_fraud_awareness (identity theft)
**Key corpus patterns**:
- Credit score myths are rampant — "checking score hurts it", "closing old cards improves it"
- Users don't understand utilization ratio impact — biggest quick-win education opportunity
- CIBIL dispute processes are confusing — step-by-step guidance is high-value
- Credit score anxiety peaks before loan applications

**Corpus voice calibration**: Clinical, precise. The community respects data-driven prescriptions with timelines. "45 din mein recover hoga" builds trust.

### 3.6 Coach Raj (MF/SIP Coach)

**Most relevant categories**: beginner_education (SIP subset), instrument_comparison (fund selection), market_sentiment_and_news (panic management)
**Key corpus patterns**:
- Fund overlap is the most underappreciated problem — users with 5+ funds having 70% overlap
- "Direct vs regular" is settled in the community (direct wins) but many users are still on regular
- During market crashes, "SIP band karoon?" questions spike — this is Coach Raj's highest-value moment
- Rupee cost averaging explanations resonate strongly when given with specific numbers
- "1 index + 1 flexicap" simplicity rule has strong community backing

**Corpus voice calibration**: Warm, encouraging, celebratory of consistency. "3 saal se SIP kar raha hai — respect yaar" matches community norms where consistency is praised.

---

## 4. Key Findings

### 4.1 Cynicism Handling is a Core Competency

26% of posts carry cynical sentiment. This isn't about the market — it's about:
- SEBI perceived as captured by industry (mutual fund reclassification, SGB policy)
- Government changing rules retroactively (SGB taxation, indexation removal)
- Brokers operating in bad faith (Zerodha account tampering case in corpus)
- Media manipulation (CNBC tip front-running allegations)
- Corporate governance failures (Adani, Byju's as corpus references)

**Agent response**: Never defend institutions. Acknowledge the valid frustration first. "Haan yaar, SGB wala unka apna goal post shift tha. Frustrating hai." Then pivot to practical: "Ab options kya hain?"

### 4.2 Community Consensus as Persuasion Mechanism

Multiple response styles in the corpus recommend citing "community-backed consensus." The user doesn't trust any single authority — but trusts what most informed people agree on.

**In practice**: "Reddit pe aur investment communities mein generally yahi maante hain..." outperforms "I recommend..." Agents should use phrases like:
- "Zyaadatar log is situation mein yahi karte hain..."
- "Community mein ye pretty much settled debate hai..."
- "Bahut logon ka experience hai ki..."

### 4.3 Scam Awareness as Trust-Builder

Scam-related posts (~8% of corpus) have highest engagement and clearest response patterns:
- User is scared and needs immediate help
- Clear, numbered action steps build instant trust
- No integration or data access needed — pure knowledge
- Users share these interactions, driving word-of-mouth

**Strategic value**: Scam awareness is a zero-friction, high-trust entry point. Build it first, deploy it prominently.

### 4.4 The Real-Options Trap

A cluster of cynical posts reveals users who feel trapped between bad options:
- Real estate = mafia-controlled, illiquid, unregulated
- FDs = barely beats inflation
- Government schemes = rules change retroactively
- Stock market = feels rigged at times
- International investing = capital controls, TCS, TDS complexity

Agents that pretend good options are obvious will feel disconnected. The realistic framing: "Options limited hain, main jaanta hoon. But in teenon mein ye sabse kam bura hai. Reason sunta hai?"

### 4.5 Emotional State Determines Response Strategy

Not what they ask — HOW they feel when asking determines the right response:

| Emotional State | Wrong Response | Right Response |
|----------------|----------------|----------------|
| confused_and_overwhelmed | "Here are 5 things to consider..." | "Ek cheez pe focus karte hain..." |
| anxious_seeking_validation | "Actually, you should consider..." | "Tu sahi soch raha hai. Ab teri specific situation dekh..." |
| frustrated_with_system | "The system actually works well because..." | "Haan yaar, genuinely annoying hai. Ab practical side..." |
| grief_or_financial_loss | "Investing would help you recover..." | "Bahut mushkil situation hai. Pahle ek kaam karte hain..." |

---

## 5. Gap Analysis

### 5.1 Cohort Gaps

| Cohort | Coverage | Issue |
|--------|----------|-------|
| C1 (₹30L+, urban) | Strong | Well-represented in IndiaInvestments |
| C2 (₹10-30L, semi-urban) | Strong | Primary Reddit demographic |
| C3 (₹4-10L, Tier 2-3) | Weak | Underrepresented — needs YouTube/WhatsApp data |
| C4 (Debt-heavy) | Very Weak | Shame prevents posting — very few debt crisis stories |
| C5 (Irregular earner) | Almost None | Freelancers/gig workers barely present |

**Mitigation**: Agent prompts for C3/C4/C5 are designed from first principles + product team knowledge rather than corpus data. Supplement with YouTube Hindi finance channel comment mining.

### 5.2 Content Gaps

| Topic | Current Coverage | Priority |
|-------|-----------------|----------|
| Emergency fund sizing | Good | Low (well-covered) |
| SIP basics | Good | Low |
| Home loan decisions | Good | Low |
| Payday loan spirals | Very Weak | High (C4 critical need) |
| Freelancer income management | Almost None | High (C5 critical need) |
| Hindi-heavy financial literacy | Minimal | High (C3 market) |
| Women's financial planning | Minimal | Medium |
| Senior citizen investment | Minimal | Medium |
| NRI taxation | Minimal | Low (not core cohort) |

### 5.3 Language Gap

62% of corpus is English-only. Our target C3/C4/C5 users communicate in Hinglish-heavy or Hindi. The knowledge base search results will be English-forward — agents must translate community wisdom into the user's language register.

---

## 6. Top Rules of Thumb from Corpus

Community-validated rules that appear repeatedly across posts:

1. **Emergency fund first**: 3-6 months expenses in liquid fund before any investing
2. **Term insurance, not endowment**: Pure term + separate investment, never bundled
3. **Direct plan, not regular**: 1-1.5% annual saving in MF fees
4. **SIP date = salary+1**: Auto-debit one day after salary credit
5. **Nifty 50 index for starters**: Low cost, beats 80% of active funds over 10 years
6. **FOIR below 40%**: Total EMIs should not exceed 40% of income
7. **Health insurance separate from employer**: Company cover ends with job
8. **Never stop SIP during crash**: Crash = cheap units = higher future returns
9. **1 index + 1 flexicap + 1 international**: Sufficient diversification for 90% of investors
10. **Check claim settlement ratio**: For insurance, 97%+ CSR is the minimum

---

## 7. Common Mistakes from Corpus

Mistakes that appear repeatedly in user stories:

1. **Buying insurance for tax saving**: Endowment/ULIP for 80C when ELSS is superior
2. **Too many mutual funds**: 7+ funds with 60-80% overlap = false diversification
3. **Regular plan instead of direct**: Paying 1-1.5% commission annually to distributor
4. **No health insurance until emergency**: Then buying post-diagnosis = higher premiums, exclusions
5. **Panic-selling during corrections**: Locking in losses, missing the recovery
6. **Keeping excess cash in savings account**: 3.5% vs 6-7% in liquid fund
7. **Chasing last year's top fund**: Reversion to mean — last year's #1 rarely repeats
8. **F&O without understanding**: 90% lose money, average loss ₹1.1L (SEBI study)
9. **Home loan at max eligibility**: Banks approve at 50% FOIR — doesn't mean it's comfortable
10. **Not filing ITR below taxable limit**: Misses TDS refunds, creates loan documentation issues

---

## 8. Wisdom Types in Corpus

| Wisdom Type | Description | Example |
|-------------|-------------|---------|
| Rules of thumb | Simple heuristics with numbers | "10x annual income for life cover" |
| Anti-patterns | What NOT to do | "Never buy insurance for tax saving" |
| Decision frameworks | How to choose between options | "If loan rate > SIP CAGR after tax, prepay" |
| Behavioral coaching | Managing emotions around money | "Market gira? SIP band mat kar." |
| System navigation | How to work within Indian financial system | "CIBIL dispute process step by step" |
| Community warnings | Collectively validated risks | "90% F&O traders lose money" |

---

_Analysis based on corpus as of February 2026. Updated as new data sources (YouTube, WhatsApp) are integrated._
