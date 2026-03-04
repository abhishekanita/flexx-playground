import { ObjectId } from 'mongoose';

export interface UserAccount {
    _id: ObjectId;
    email?: string;
    username: string;
    avatar: string;
    googleId?: string;
    createdAt: Date;
    updatedAt: Date;
}
