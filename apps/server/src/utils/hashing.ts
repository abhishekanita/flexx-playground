import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { v4 as uuidv4 } from 'uuid';

export const signJwt = async (data: { accountId: string }): Promise<string> => {
    const token = await (jwt as any).sign(data, config.jwt.secret as string, {
        expiresIn: config.jwt.expiresIn,
    });
    return token;
};

export const verifyJwt = async (token: string): Promise<unknown> => {
    const decoded = await jwt.verify(token, config.jwt.secret);
    return decoded;
};

export const getHash = (string: string): string => {
    const salt = bcrypt.genSaltSync(10);
    const hashedString = bcrypt.hashSync(string, salt);
    return hashedString;
};

export const getRandomHash = (): string => {
    const string = crypto.randomBytes(32).toString('hex');
    return getHash(string);
};

export const compareHash = (string: string, hash: string): boolean => {
    return bcrypt.compareSync(string, hash);
};

export const base64Encode = (data: string): string => {
    const buff = Buffer.from(data);
    return buff.toString('base64');
};

export const base64Decode = (data: string): string => {
    const buff = Buffer.from(data, 'base64');
    return buff.toString('ascii');
};

export const getUUID = () => {
    return uuidv4();
};
