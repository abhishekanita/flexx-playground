export interface RawYouTubeVideo {
    id: string;
    snippet: {
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        tags?: string[];
        thumbnails?: {
            high?: { url: string };
            medium?: { url: string };
            default?: { url: string };
        };
    };
    contentDetails: {
        duration: string;
    };
    statistics: {
        viewCount: string;
        likeCount: string;
        commentCount: string;
    };
}

export interface RawPlaylistItem {
    snippet: {
        resourceId: {
            videoId: string;
        };
    };
}

export interface RawChannelInfo {
    id: string;
    snippet: {
        title: string;
        customUrl?: string;
    };
    contentDetails: {
        relatedPlaylists: {
            uploads: string;
        };
    };
}
