export interface RawRedditPost {
    id: string;
    subreddit: { display_name: string };
    title: string;
    selftext: string;
    author: { name: string };
    score: number;
    upvote_ratio: number;
    num_comments: number;
    permalink: string;
    link_flair_text: string | null;
    created_utc: number;
    comments: RawRedditComment[];
}

export interface RawRedditComment {
    id: string;
    author: { name: string };
    body: string;
    score: number;
    depth: number;
    parent_id: string;
    created_utc: number;
    is_submitter: boolean;
    replies: RawRedditComment[];
}
