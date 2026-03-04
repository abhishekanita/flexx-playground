export interface YouTubeChannelConfig {
	id: string;
	name: string;
	handle: string;
}

export const FINANCE_YOUTUBE_CHANNELS: YouTubeChannelConfig[] = [
	{ id: 'UCbXSMt5Xmz-KGBwVkHjeOmQ', name: 'CA Rachana Ranade', handle: '@CArachanaranade' },
	{ id: 'UCRzYN32xtBf3Yxkb8qbFLYg', name: 'Warikoo', handle: '@waaborkar' },
	{ id: 'UC4AHMJxGqBiGat7P5TgBKHA', name: 'Labour Law Advisor', handle: '@LabourLawAdvisor' },
	{ id: 'UCRwgDXSZ19HwCiXqYXmHt0A', name: 'Pranjal Kamra', handle: '@PranjalKamra' },
	{ id: 'UCqW8jxh4tH1Z1sWPbkGWL4g', name: 'Asset Yogi', handle: '@AssetYogi' },
	{ id: 'UCjkowCsxG5Q0BAqxseOWVIw', name: 'Sagar Sinha', handle: '@SagarSSinha' },
];

export interface CreatorVideo {
	videoId: string;
	title: string;
	description: string; // truncated to 200 chars
	tags: string[];
	channelName: string;
	channelHandle: string;
	viewCount: number;
	likeCount: number;
	commentCount: number;
	publishedAt: Date;
	thumbnailUrl: string;
}
