import axios, { AxiosError } from 'axios';
import { config } from '@/config';
import { RedditComment, RedditTimeframe } from '@/types';

const SCRAPER_API_KEY = config.scraperApi?.apiKey;
const SCRAPER_API_URL = 'https://api.scraperapi.com';
const REDDIT_BASE_URL = 'https://www.reddit.com';
const REQUEST_DELAY_MS = SCRAPER_API_KEY ? 500 : 3000;
const MAX_RETRIES = 3;

export class RedditPlugin {
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async redditGet(path: string, params: Record<string, any> = {}) {
        const redditParams = new URLSearchParams({ ...params, raw_json: '1' }).toString();
        const targetUrl = `${REDDIT_BASE_URL}${path}?${redditParams}`;

        if (SCRAPER_API_KEY) {
            return axios.get(SCRAPER_API_URL, {
                params: {
                    api_key: SCRAPER_API_KEY,
                    url: targetUrl,
                },
                timeout: 60000,
            });
        }

        return axios.get(targetUrl, {
            headers: {
                'User-Agent': 'finbase-scraper/1.0 (educational project)',
                'Accept': 'application/json',
            },
            timeout: 30000,
        });
    }

    private async requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await fn();
                await this.sleep(REQUEST_DELAY_MS);
                return result;
            } catch (err) {
                const status = (err as AxiosError)?.response?.status;
                if ((status === 429 || status === 500) && attempt < MAX_RETRIES) {
                    const backoff = attempt * 30000;
                    console.log(`  Rate limited (${status}). Waiting ${backoff / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
                    await this.sleep(backoff);
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Max retries exceeded');
    }

    async fetchTopPosts(
        subreddit: string,
        timeframe: RedditTimeframe,
        limit: number = 100
    ): Promise<any[]> {
        const allPosts: any[] = [];
        let after: string | null = null;
        const perPage = Math.min(limit, 100);

        while (allPosts.length < limit) {
            const params: any = { t: timeframe, limit: perPage };
            if (after) params.after = after;

            const response = await this.requestWithRetry(() =>
                this.redditGet(`/r/${subreddit}/top.json`, params)
            );

            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            const children = data?.data?.children || [];

            if (children.length === 0) break;

            for (const child of children) {
                allPosts.push(child.data);
            }

            after = data?.data?.after;
            if (!after) break;
        }

        return allPosts.slice(0, limit);
    }

    async fetchHotPosts(
        subreddit: string,
        limit: number = 100
    ): Promise<any[]> {
        const response = await this.requestWithRetry(() =>
            this.redditGet(`/r/${subreddit}/hot.json`, { limit })
        );

        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const children = data?.data?.children || [];
        return children.map((c: any) => c.data);
    }

    async fetchPostWithComments(
        postId: string,
        subreddit: string
    ): Promise<{ post: any; comments: any[] }> {
        const response = await this.requestWithRetry(() =>
            this.redditGet(`/r/${subreddit}/comments/${postId}.json`, {
                limit: 500,
                depth: 10,
                sort: 'top',
            })
        );

        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const postData = data?.[0]?.data?.children?.[0]?.data;
        const commentChildren = data?.[1]?.data?.children || [];

        const comments = commentChildren
            .filter((c: any) => c.kind === 't1')
            .map((c: any) => c.data);

        return { post: postData, comments };
    }

    flattenComments(comments: any[], depth: number = 0): RedditComment[] {
        const flat: RedditComment[] = [];

        for (const comment of comments) {
            if (!comment || !comment.body || comment.body === '[deleted]' || comment.body === '[removed]') {
                continue;
            }

            flat.push({
                redditId: comment.id || '',
                author: comment.author || '[deleted]',
                body: comment.body || '',
                score: comment.score || 0,
                depth: comment.depth ?? depth,
                parentId: comment.parent_id || '',
                createdAt: new Date((comment.created_utc || 0) * 1000),
                isSubmitter: comment.is_submitter || false,
            });

            const replies = comment.replies?.data?.children;
            if (replies && replies.length > 0) {
                const childComments = replies
                    .filter((r: any) => r.kind === 't1')
                    .map((r: any) => r.data);
                flat.push(...this.flattenComments(childComments, depth + 1));
            }
        }

        return flat;
    }
}

export const redditPlugin = new RedditPlugin();
