import { ObjectId } from 'mongoose';

export interface RedditComment {
    redditId: string;
    author: string;
    body: string;
    score: number;
    depth: number;
    parentId: string;
    createdAt: Date;
    isSubmitter: boolean;
}

export interface RedditPost {
    _id: ObjectId;
    redditId: string;
    subreddit: string;
    title: string;
    body: string;
    author: string;
    score: number;
    upvoteRatio: number;
    numComments: number;
    permalink: string;
    flair?: string;
    createdAt: Date;
    comments: RedditComment[];
    scrapedAt: Date;
    processed: boolean;
}

export type RedditTimeframe = 'day' | 'week' | 'month' | 'year' | 'all';

export const SUBREDDITS = [
    // 'IndiaInvestments',
    // 'personalfinanceindia',
    // 'IndianStreetBets',
    'FIREIndia',
    'DalalStreetTalks',
    'IndianStockMarket',
    'indiabusiness',
] as const;

export type Subreddit = (typeof SUBREDDITS)[number];
