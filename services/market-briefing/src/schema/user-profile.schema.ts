import mongoose, { Schema, Document } from 'mongoose';

export interface IHolding {
	symbol: string;
	exchange: string;
	qty?: number;
	avgPrice?: number;
}

export interface IMFHolding {
	schemeCode: number;
	schemeName?: string;
	units?: number;
	investedAmount?: number;
}

export interface IUserProfile extends Document {
	userId: string;
	holdings: IHolding[];
	mfHoldings: IMFHolding[];
	interests: string[];
	riskProfile: 'conservative' | 'moderate' | 'aggressive';
	incomeBracket: '0-5L' | '5-10L' | '10-20L' | '20L+';
	ageGroup: '18-25' | '26-35' | '36-50' | '50+';
	location: { city?: string; state?: string };
	sipDates: number[];
	preferredLanguage: 'en' | 'hi' | 'hinglish';
	notificationPrefs: { pushEnabled: boolean; briefingTime: string };
	createdAt: Date;
	updatedAt: Date;
}

const HoldingSchema = new Schema(
	{
		symbol: { type: String, required: true },
		exchange: { type: String, default: 'NSE' },
		qty: Number,
		avgPrice: Number,
	},
	{ _id: false },
);

const MFHoldingSchema = new Schema(
	{
		schemeCode: { type: Number, required: true },
		schemeName: String,
		units: Number,
		investedAmount: Number,
	},
	{ _id: false },
);

const UserProfileSchema = new Schema(
	{
		userId: { type: String, required: true, unique: true, index: true },
		holdings: { type: [HoldingSchema], default: [] },
		mfHoldings: { type: [MFHoldingSchema], default: [] },
		interests: { type: [String], default: [] },
		riskProfile: {
			type: String,
			enum: ['conservative', 'moderate', 'aggressive'],
			default: 'moderate',
		},
		incomeBracket: {
			type: String,
			enum: ['0-5L', '5-10L', '10-20L', '20L+'],
			default: '5-10L',
		},
		ageGroup: {
			type: String,
			enum: ['18-25', '26-35', '36-50', '50+'],
			default: '26-35',
		},
		location: {
			city: String,
			state: String,
		},
		sipDates: { type: [Number], default: [] },
		preferredLanguage: {
			type: String,
			enum: ['en', 'hi', 'hinglish'],
			default: 'hinglish',
		},
		notificationPrefs: {
			pushEnabled: { type: Boolean, default: true },
			briefingTime: { type: String, default: '08:00' },
		},
	},
	{ timestamps: true },
);

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
