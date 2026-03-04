import { ObjectId } from 'mongoose';

export const TOPICS = [
    'savings',
    'investments',
    'insurance',
    'loans',
    'tax-planning',
    'mutual-funds',
    'stocks',
    'real-estate',
    'retirement',
    'budgeting',
    'credit',
    'banking',
    'crypto',
    'gold',
    'government-schemes',
    'financial-planning',
    'trading',
    'other',
] as const;

export type Topic = (typeof TOPICS)[number];

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type TargetAudience = 'beginner' | 'intermediate' | 'advanced';
export type Actionability = 'informational' | 'actionable' | 'comparison' | 'review';
export type SourceType = 'reddit' | 'youtube';

export interface KnowledgeBaseEntry {
    _id: ObjectId;
    sourceType: SourceType;
    sourceId: string;
    title: string;
    summary: string;
    keyInsights: string[];
    topic: Topic;
    subTopics: string[];
    financialProducts: string[];
    sentiment: Sentiment;
    riskLevel: RiskLevel | null;
    targetAudience: TargetAudience;
    actionability: Actionability;
    relevanceScore: number;
    engagementScore: number;
    embedding: number[];
    metadata: Record<string, any>;
    createdAt: Date;
    processedAt: Date;
}

export interface KnowledgeBaseExtraction {
    summary: string;
    keyInsights: string[];
    topic: Topic;
    subTopics: string[];
    financialProducts: string[];
    sentiment: Sentiment;
    riskLevel: RiskLevel | null;
    targetAudience: TargetAudience;
    actionability: Actionability;
    relevanceScore: number;
}
