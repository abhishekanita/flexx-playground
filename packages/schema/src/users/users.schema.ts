import { UserAccount } from '@playground/types';
import { Document, Schema } from 'mongoose';

export interface IUserAccountDoc extends Document, Omit<UserAccount, '_id'> {}

export const UserSchema = new Schema<IUserAccountDoc>(
    {
        email: String,
        phoneNumber: String,
        username: String,
        avatar: String,
        googleId: String,
        isSubscribed: Boolean,
        isOnboarded: Boolean,
        isAdmin: { type: Boolean, default: false },
        isTester: { type: Boolean, default: false },
        experiments: Schema.Types.Mixed,
        attributes: Schema.Types.Mixed,
        referralCode: { type: String, unique: true, sparse: true },
        referredBy: { type: String, index: true },
        referredByCode: String,
        referralCount: { type: Number, default: 0 },
        expoPushTokens: { type: [String], default: [] },
        isDeleted: { type: Boolean, default: false },
        lastActiveAt: Date,
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'users',
    }
);
