export interface InstagramAccountConfig {
	username: string;
	displayName: string;
}

export const FINANCE_INSTAGRAM_ACCOUNTS: InstagramAccountConfig[] = [
	{ username: 'carachanaranade', displayName: 'CA Rachana Ranade' },
	{ username: 'ankaborkar', displayName: 'Warikoo' },
	{ username: 'labourlawadvisor', displayName: 'Labour Law Advisor' },
	{ username: 'pranjalkamra', displayName: 'Pranjal Kamra' },
	{ username: 'assetyogi', displayName: 'Asset Yogi' },
	{ username: 'financewithsharan', displayName: 'Finance with Sharan' },
];

export const FINANCE_INSTAGRAM_KEYWORDS: string[] = [
	'stockmarket',
	'nifty',
	'sensex',
	'mutualfunds',
	'personalfinance',
	'investing',
];

export interface CreatorReel {
	reelId: string;
	caption: string; // truncated to 300 chars
	hashtags: string[];
	username: string;
	displayName: string;
	likeCount: number;
	viewCount: number;
	commentCount: number;
	publishedAt: Date;
	thumbnailUrl: string;
	source: 'account' | 'keyword-search';
}
