import { RedditPost } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IRedditPostDoc extends Document, Omit<RedditPost, '_id'> {}

const RedditCommentSchema = new Schema(
    {
        redditId: { type: String, required: true },
        author: { type: String, required: true },
        body: { type: String, required: true },
        score: { type: Number, default: 0 },
        depth: { type: Number, default: 0 },
        parentId: { type: String, required: true },
        createdAt: { type: Date, required: true },
        isSubmitter: { type: Boolean, default: false },
    },
    { _id: false }
);

export const RedditPostSchema = new Schema<IRedditPostDoc>(
    {
        redditId: { type: String, required: true, unique: true, index: true },
        subreddit: { type: String, required: true, index: true },
        title: { type: String, required: true },
        body: { type: String, default: '' },
        author: { type: String, required: true },
        score: { type: Number, default: 0 },
        upvoteRatio: { type: Number, default: 0 },
        numComments: { type: Number, default: 0 },
        permalink: { type: String, required: true },
        flair: { type: String },
        createdAt: { type: Date, required: true },
        comments: { type: [RedditCommentSchema], default: [] },
        scrapedAt: { type: Date, default: Date.now },
        processed: { type: Boolean, default: false, index: true },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'reddit-posts',
    }
);

export const RedditPostModel = model<IRedditPostDoc>('RedditPost', RedditPostSchema);
