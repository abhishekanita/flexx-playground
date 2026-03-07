import mongoose, { Schema, Document } from 'mongoose';
import { User } from '@/types/users/user.types';

export interface IUserDoc extends Document, Omit<User, '_id'> {}

const UserLocalSchema = new Schema<IUserDoc>(
    {
        email: String,
        isGmailConnected: Boolean,
        gmailSyncCursor: Date,
    },
    { timestamps: true, versionKey: false, collection: 'users' }
);

export const UserLocalModel = mongoose.model<IUserDoc>('users-local', UserLocalSchema);
