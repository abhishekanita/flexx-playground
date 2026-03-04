import { InstagramReel } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IInstagramReelDoc extends Document, Omit<InstagramReel, '_id'> {}

const InstagramCommentSchema = new Schema(
    {
        commentId: { type: String, required: true },
        username: { type: String, required: true },
        text: { type: String, required: true },
        likeCount: { type: Number, default: 0 },
        timestamp: { type: Date, required: true },
    },
    { _id: false }
);

export const InstagramReelSchema = new Schema<IInstagramReelDoc>(
    {
        reelId: { type: String, required: true, unique: true, index: true },
        shortcode: { type: String, required: true },
        username: { type: String, required: true, index: true },
        caption: { type: String, default: '' },
        likeCount: { type: Number, default: 0 },
        commentCount: { type: Number, default: 0 },
        viewCount: { type: Number, default: 0 },
        playCount: { type: Number, default: 0 },
        publishedAt: { type: Date, required: true },
        videoUrl: { type: String, required: true },
        thumbnailUrl: { type: String },
        hashtags: { type: [String], default: [] },
        comments: { type: [InstagramCommentSchema], default: [] },
        transcript: { type: String },
        videoLocalPath: { type: String },
        videoS3Url: { type: String },
        scrapedAt: { type: Date, default: Date.now },
        processed: { type: Boolean, default: false, index: true },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'instagram-reels',
    }
);

export const InstagramReelModel = model<IInstagramReelDoc>('InstagramReel', InstagramReelSchema);
