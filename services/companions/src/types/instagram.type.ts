import { ObjectId } from 'mongoose';

export interface InstagramComment {
    commentId: string;
    username: string;
    text: string;
    likeCount: number;
    timestamp: Date;
}

export interface InstagramReel {
    _id: ObjectId;
    reelId: string;
    shortcode: string;
    username: string;
    caption: string;
    likeCount: number;
    commentCount: number;
    viewCount: number;
    playCount: number;
    publishedAt: Date;
    videoUrl: string;
    thumbnailUrl?: string;
    hashtags: string[];
    comments: InstagramComment[];
    transcript?: string;
    videoLocalPath?: string;
    videoS3Url?: string;
    scrapedAt: Date;
    processed: boolean;
}

export interface InstagramAccountConfig {
    username: string;
    category: 'creator' | 'news' | 'brand';
}
