import { YouTubeVideo } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IYouTubeVideoDoc extends Document, Omit<YouTubeVideo, '_id'> {}

const TranscriptSegmentSchema = new Schema(
    {
        text: { type: String, required: true },
        offset: { type: Number, required: true },
        duration: { type: Number, required: true },
    },
    { _id: false }
);

export const YouTubeVideoSchema = new Schema<IYouTubeVideoDoc>(
    {
        videoId: { type: String, required: true, unique: true, index: true },
        channelId: { type: String, required: true, index: true },
        channelName: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        publishedAt: { type: Date, required: true },
        viewCount: { type: Number, default: 0 },
        likeCount: { type: Number, default: 0 },
        commentCount: { type: Number, default: 0 },
        duration: { type: String, default: '' },
        tags: { type: [String], default: [] },
        transcript: { type: String },
        transcriptSegments: { type: [TranscriptSegmentSchema] },
        thumbnailUrl: { type: String },
        scrapedAt: { type: Date, default: Date.now },
        processed: { type: Boolean, default: false, index: true },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'youtube-videos',
    }
);

export const YouTubeVideoModel = model<IYouTubeVideoDoc>('YouTubeVideo', YouTubeVideoSchema);
