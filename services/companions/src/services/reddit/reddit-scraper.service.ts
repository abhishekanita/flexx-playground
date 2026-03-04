import { RedditPostModel } from '@/schema';
import { SUBREDDITS, RedditTimeframe } from '@/types';
import { redditPlugin } from '@/plugins/reddit/reddit.plugin';
import fs from 'fs';
import path from 'path';
import { createExportSession, saveJSON } from '@/utils/data-export';
import logger, { ServiceLogger } from '@/utils/logger';

interface ScrapingStats {
    subreddit: string;
    postsFound: number;
    newPostsSaved: number;
    errors: number;
}

export interface RedditScraperConfig {
    topPostsLimit: number;
    hotPostsLimit: number;
    timeframes: RedditTimeframe[];
}

const DEFAULT_CONFIG: RedditScraperConfig = {
    topPostsLimit: 100,
    hotPostsLimit: 50,
    timeframes: ['year', 'month'],
};

export class RedditScraperService {
    private logger: ServiceLogger;
    private exportDir: string = '';
    private config: RedditScraperConfig;

    constructor(config?: Partial<RedditScraperConfig>) {
        this.logger = logger.createServiceLogger('RedditScraper');
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    private async savePost(postData: any, subreddit: string): Promise<boolean> {
        const postId = postData.id;

        const existing = await RedditPostModel.findOne({ redditId: postId });
        if (existing) {
            this.logger.info(`    Skipping: ${postId}`);
            return false;
        }

        this.logger.info(`    Fetching comments for post: ${postId}`);
        const { post, comments } = await redditPlugin.fetchPostWithComments(postId, subreddit);

        const flatComments = redditPlugin.flattenComments(comments);

        const doc = {
            redditId: post.id,
            subreddit: post.subreddit || subreddit,
            title: post.title || '',
            body: post.selftext || '',
            author: post.author || '[deleted]',
            score: post.score || 0,
            upvoteRatio: post.upvote_ratio || 0,
            numComments: post.num_comments || 0,
            permalink: post.permalink || '',
            flair: post.link_flair_text || undefined,
            createdAt: new Date((post.created_utc || 0) * 1000),
            comments: flatComments,
            scrapedAt: new Date(),
            processed: false,
        };

        await RedditPostModel.create(doc);

        if (this.exportDir) {
            saveJSON(this.exportDir, `${subreddit}-${post.id}`, {
                raw: { post, comments },
                transformed: doc,
            });
        }

        this.logger.green(
            `    Saved: "${(post.title || '').substring(0, 60)}..." with ${flatComments.length} comments`
        );
        return true;
    }

    async scrapeSubreddit(subreddit: string): Promise<ScrapingStats> {
        const stats: ScrapingStats = {
            subreddit,
            postsFound: 0,
            newPostsSaved: 0,
            errors: 0,
        };

        this.logger.info(`Starting scrape for r/${subreddit}`);

        for (const timeframe of this.config.timeframes) {
            try {
                this.logger.info(`  Fetching top ${this.config.topPostsLimit} posts (${timeframe}) from r/${subreddit}`);
                const posts = await redditPlugin.fetchTopPosts(subreddit, timeframe, this.config.topPostsLimit);

                stats.postsFound += posts.length;
                this.logger.info(`  Found ${posts.length} posts for timeframe: ${timeframe}`);

                for (const post of posts) {
                    try {
                        const saved = await this.savePost(post, subreddit);
                        if (saved) stats.newPostsSaved++;
                    } catch (err: any) {
                        stats.errors++;
                        this.logger.error(`    Error processing post: ${err.message}`);
                    }
                }
            } catch (err: any) {
                stats.errors++;
                this.logger.error(`  Error fetching ${timeframe} posts from r/${subreddit}: ${err.message}`);
            }
        }

        // Also fetch hot posts
        try {
            this.logger.info(`  Fetching hot posts from r/${subreddit}`);
            const posts = await redditPlugin.fetchHotPosts(subreddit, this.config.hotPostsLimit);
            stats.postsFound += posts.length;

            for (const post of posts) {
                try {
                    const saved = await this.savePost(post, subreddit);
                    if (saved) stats.newPostsSaved++;
                } catch (err: any) {
                    stats.errors++;
                    this.logger.error(`    Error saving hot post: ${err.message}`);
                }
            }
        } catch (err: any) {
            stats.errors++;
            this.logger.error(`  Error fetching hot posts from r/${subreddit}: ${err.message}`);
        }

        this.logger.info(
            `Completed r/${subreddit}: ${stats.postsFound} found, ${stats.newPostsSaved} new, ${stats.errors} errors`
        );

        return stats;
    }

    async scrapeAll(): Promise<ScrapingStats[]> {
        const allStats: ScrapingStats[] = [];

        this.exportDir = createExportSession('reddit');
        this.logger.info(`Starting Reddit scraping for ${SUBREDDITS.length} subreddits`);
        this.logger.info(`Raw data export: ${this.exportDir}`);

        for (const subreddit of SUBREDDITS) {
            const stats = await this.scrapeSubreddit(subreddit);
            allStats.push(stats);
        }

        const totalFound = allStats.reduce((sum, s) => sum + s.postsFound, 0);
        const totalSaved = allStats.reduce((sum, s) => sum + s.newPostsSaved, 0);
        const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);

        this.logger.info(`\nReddit scraping complete:`);
        this.logger.info(`  Total posts found: ${totalFound}`);
        this.logger.info(`  New posts saved: ${totalSaved}`);
        this.logger.info(`  Errors: ${totalErrors}`);

        return allStats;
    }

    async exportToMarkdown(options?: {
        maxBodyLength?: number;
        maxCommentLength?: number;
        maxCommentsPerPost?: number;
    }): Promise<string> {
        const maxBody = options?.maxBodyLength ?? 500;
        const maxComment = options?.maxCommentLength ?? 300;
        const maxComments = options?.maxCommentsPerPost ?? 10;

        const posts = await RedditPostModel.find().sort({ score: -1 });

        if (posts.length === 0) {
            this.logger.warn('No posts found in database to export');
            return '';
        }

        // Group by subreddit
        const grouped: Record<string, typeof posts> = {};
        for (const post of posts) {
            if (!grouped[post.subreddit]) grouped[post.subreddit] = [];
            grouped[post.subreddit].push(post);
        }

        const lines: string[] = [
            `# Reddit Financial Knowledge Base Export`,
            ``,
            `> Exported: ${new Date().toISOString()}`,
            `> Total posts: ${posts.length}`,
            `> Subreddits: ${Object.keys(grouped).join(', ')}`,
            ``,
            `---`,
            ``,
        ];

        for (const [subreddit, subredditPosts] of Object.entries(grouped)) {
            lines.push(`## r/${subreddit} (${subredditPosts.length} posts)`);
            lines.push(``);

            for (const post of subredditPosts) {
                const body = post.body
                    ? post.body.length > maxBody
                        ? post.body.substring(0, maxBody) + '...'
                        : post.body
                    : '*(no body)*';

                lines.push(`### ${post.title}`);
                lines.push(``);
                lines.push(`| Score | Comments | Upvote Ratio | Flair | Date |`);
                lines.push(`|-------|----------|--------------|-------|------|`);
                lines.push(
                    `| ${post.score} | ${post.numComments} | ${(post.upvoteRatio * 100).toFixed(0)}% | ${post.flair || '-'} | ${post.createdAt.toISOString().split('T')[0]} |`
                );
                lines.push(``);
                lines.push(`**Post:** ${body}`);
                lines.push(``);

                // Top comments by score
                const topComments = [...post.comments]
                    .sort((a, b) => b.score - a.score)
                    .slice(0, maxComments);

                if (topComments.length > 0) {
                    lines.push(`**Top Comments (${topComments.length}/${post.comments.length}):**`);
                    lines.push(``);
                    for (const c of topComments) {
                        const commentBody =
                            c.body.length > maxComment
                                ? c.body.substring(0, maxComment) + '...'
                                : c.body;
                        const opTag = c.isSubmitter ? ' *(OP)*' : '';
                        lines.push(`- **[${c.score}]** ${c.author}${opTag}: ${commentBody}`);
                    }
                    lines.push(``);
                }

                lines.push(`[Link](https://reddit.com${post.permalink})`);
                lines.push(``);
                lines.push(`---`);
                lines.push(``);
            }
        }

        const markdown = lines.join('\n');
        const outputDir = path.join(process.cwd(), 'data');
        fs.mkdirSync(outputDir, { recursive: true });
        const outputPath = path.join(outputDir, `reddit-export-${Date.now()}.md`);
        fs.writeFileSync(outputPath, markdown, 'utf-8');

        this.logger.green(`Exported ${posts.length} posts to ${outputPath}`);
        return outputPath;
    }
}
