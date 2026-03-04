import { ObjectId } from 'mongoose';

export interface TranscriptSegment {
    text: string;
    offset: number;
    duration: number;
}

export interface YouTubeVideo {
    _id: ObjectId;
    videoId: string;
    channelId: string;
    channelName: string;
    title: string;
    description: string;
    publishedAt: Date;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    duration: string;
    tags: string[];
    transcript?: string;
    transcriptSegments?: TranscriptSegment[];
    thumbnailUrl?: string;
    scrapedAt: Date;
    processed: boolean;
}

export interface YouTubeChannel {
    id: string;
    name: string;
    handle: string;
    uploadsPlaylistId: string;
}

export interface YouTubeChannelConfig {
    id: string;
    name: string;
    handle: string;
}
