import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { YouTubeVideoModel } from '@/schema/youtube-video.schema';
import { KnowledgeBaseModel } from '@/schema/knowledge-base.schema';
import fs from 'fs';
import path from 'path';

function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0');
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}

async function main() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        console.log('Connected to database');

        // --- 1. Get all YouTube videos ---
        const allVideos = await YouTubeVideoModel.find({}).lean();
        console.log(`Total YouTube videos: ${allVideos.length}`);

        // --- 2. Get all processed YouTube entries from knowledge-base ---
        const kbEntries = await KnowledgeBaseModel.find({ sourceType: 'youtube' }).select('-embedding').lean();
        console.log(`Total processed YouTube KB entries: ${kbEntries.length}`);

        // === ANALYSIS 1: Channel-level stats ===
        const channelStats: Record<string, {
            name: string;
            totalVideos: number;
            totalViews: number;
            totalLikes: number;
            totalComments: number;
            avgViews: number;
            avgLikes: number;
            avgDurationSec: number;
            hasTranscript: number;
            processed: number;
            oldestVideo: Date | null;
            newestVideo: Date | null;
            topVideos: any[];
        }> = {};

        for (const v of allVideos) {
            const key = v.channelName;
            if (!channelStats[key]) {
                channelStats[key] = {
                    name: key,
                    totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
                    avgViews: 0, avgLikes: 0, avgDurationSec: 0,
                    hasTranscript: 0, processed: 0,
                    oldestVideo: null, newestVideo: null,
                    topVideos: [],
                };
            }
            const cs = channelStats[key];
            cs.totalVideos++;
            cs.totalViews += v.viewCount || 0;
            cs.totalLikes += v.likeCount || 0;
            cs.totalComments += v.commentCount || 0;
            cs.avgDurationSec += parseDuration(v.duration || '');
            if (v.transcript) cs.hasTranscript++;
            if (v.processed) cs.processed++;
            if (!cs.oldestVideo || v.publishedAt < cs.oldestVideo) cs.oldestVideo = v.publishedAt;
            if (!cs.newestVideo || v.publishedAt > cs.newestVideo) cs.newestVideo = v.publishedAt;
            cs.topVideos.push({ title: v.title, views: v.viewCount, likes: v.likeCount, duration: v.duration, publishedAt: v.publishedAt });
        }

        // Compute averages and sort top videos
        for (const cs of Object.values(channelStats)) {
            cs.avgViews = Math.round(cs.totalViews / cs.totalVideos);
            cs.avgLikes = Math.round(cs.totalLikes / cs.totalVideos);
            cs.avgDurationSec = Math.round(cs.avgDurationSec / cs.totalVideos);
            cs.topVideos.sort((a: any, b: any) => b.views - a.views);
            cs.topVideos = cs.topVideos.slice(0, 10); // top 10 per channel
        }

        // === ANALYSIS 2: KB topic distribution ===
        const topicDist: Record<string, number> = {};
        const sentimentDist: Record<string, number> = {};
        const audienceDist: Record<string, number> = {};
        const actionabilityDist: Record<string, number> = {};
        const riskDist: Record<string, number> = {};
        const allSubTopics: Record<string, number> = {};
        const allFinProducts: Record<string, number> = {};
        const allInsights: string[] = [];
        const allSummaries: { title: string; summary: string; topic: string; channel: string; relevance: number; engagement: number; views: number; }[] = [];

        // Per-channel topic distribution
        const channelTopics: Record<string, Record<string, number>> = {};

        for (const kb of kbEntries) {
            // Topic
            topicDist[kb.topic] = (topicDist[kb.topic] || 0) + 1;

            // Sentiment
            sentimentDist[kb.sentiment] = (sentimentDist[kb.sentiment] || 0) + 1;

            // Audience
            audienceDist[kb.targetAudience] = (audienceDist[kb.targetAudience] || 0) + 1;

            // Actionability
            actionabilityDist[kb.actionability] = (actionabilityDist[kb.actionability] || 0) + 1;

            // Risk
            if (kb.riskLevel) riskDist[kb.riskLevel] = (riskDist[kb.riskLevel] || 0) + 1;

            // SubTopics
            for (const st of kb.subTopics || []) {
                allSubTopics[st] = (allSubTopics[st] || 0) + 1;
            }

            // Financial products
            for (const fp of kb.financialProducts || []) {
                allFinProducts[fp] = (allFinProducts[fp] || 0) + 1;
            }

            // Insights
            allInsights.push(...(kb.keyInsights || []));

            // Summaries with metadata
            const meta = kb.metadata || {};
            allSummaries.push({
                title: kb.title,
                summary: kb.summary,
                topic: kb.topic,
                channel: meta.channelName || '',
                relevance: kb.relevanceScore,
                engagement: kb.engagementScore,
                views: meta.viewCount || 0,
            });

            // Channel-topic
            const ch = meta.channelName || 'unknown';
            if (!channelTopics[ch]) channelTopics[ch] = {};
            channelTopics[ch][kb.topic] = (channelTopics[ch][kb.topic] || 0) + 1;
        }

        // === ANALYSIS 3: Duration distribution ===
        const durationBuckets = { 'under_5min': 0, '5_to_10min': 0, '10_to_20min': 0, '20_to_30min': 0, '30_to_60min': 0, 'over_60min': 0 };
        for (const v of allVideos) {
            const sec = parseDuration(v.duration || '');
            if (sec < 300) durationBuckets.under_5min++;
            else if (sec < 600) durationBuckets['5_to_10min']++;
            else if (sec < 1200) durationBuckets['10_to_20min']++;
            else if (sec < 1800) durationBuckets['20_to_30min']++;
            else if (sec < 3600) durationBuckets['30_to_60min']++;
            else durationBuckets.over_60min++;
        }

        // === ANALYSIS 4: Tags analysis ===
        const tagCounts: Record<string, number> = {};
        for (const v of allVideos) {
            for (const tag of v.tags || []) {
                const normalized = tag.toLowerCase().trim();
                tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
            }
        }
        const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 100);

        // === ANALYSIS 5: Publishing frequency ===
        const monthlyPublish: Record<string, number> = {};
        for (const v of allVideos) {
            const d = new Date(v.publishedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyPublish[key] = (monthlyPublish[key] || 0) + 1;
        }

        // === ANALYSIS 6: Engagement vs topic ===
        const topicEngagement: Record<string, { totalViews: number; totalLikes: number; count: number }> = {};
        for (const kb of kbEntries) {
            const meta = kb.metadata || {};
            if (!topicEngagement[kb.topic]) topicEngagement[kb.topic] = { totalViews: 0, totalLikes: 0, count: 0 };
            topicEngagement[kb.topic].totalViews += meta.viewCount || 0;
            topicEngagement[kb.topic].totalLikes += meta.likeCount || 0;
            topicEngagement[kb.topic].count++;
        }

        // === ANALYSIS 7: Top videos by views ===
        const topVideosByViews = allVideos
            .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
            .slice(0, 50)
            .map(v => ({
                title: v.title,
                channel: v.channelName,
                views: v.viewCount,
                likes: v.likeCount,
                comments: v.commentCount,
                duration: v.duration,
                publishedAt: v.publishedAt,
                tags: (v.tags || []).slice(0, 5),
            }));

        // === ANALYSIS 8: Content type classification by title patterns ===
        const titlePatterns: Record<string, number> = {
            'how_to_explainer': 0,
            'listicle_top_n': 0,
            'comparison': 0,
            'news_market_update': 0,
            'personal_story': 0,
            'review_analysis': 0,
            'myths_mistakes': 0,
            'qa_doubt_solving': 0,
            'motivational': 0,
            'other': 0,
        };
        for (const v of allVideos) {
            const t = (v.title || '').toLowerCase();
            if (/how to|kaise|kese|step by step|guide|tutorial|sik/.test(t)) titlePatterns.how_to_explainer++;
            else if (/top \d|best \d|\d+ best|\d+ ways|\d+ tips|\d+ mistakes/.test(t)) titlePatterns.listicle_top_n++;
            else if (/vs |versus|compare|better|which one|konsa/.test(t)) titlePatterns.comparison++;
            else if (/news|market|budget|crash|rally|nifty|sensex|rbi|sebi|policy|election/.test(t)) titlePatterns.news_market_update++;
            else if (/my |mera|meri|i did|i made|journey|experience|story/.test(t)) titlePatterns.personal_story++;
            else if (/review|analysis|deep dive|explained|samjho|detail/.test(t)) titlePatterns.review_analysis++;
            else if (/myth|mistake|galti|avoid|never|don.?t|mat karo/.test(t)) titlePatterns.myths_mistakes++;
            else if (/\?|doubt|q&a|qa|sawaal|answer/.test(t)) titlePatterns.qa_doubt_solving++;
            else if (/mindset|success|rich|ameer|motivat|inspire/.test(t)) titlePatterns.motivational++;
            else titlePatterns.other++;
        }

        // Sort distributions
        const sortedSubTopics = Object.entries(allSubTopics).sort((a, b) => b[1] - a[1]).slice(0, 60);
        const sortedFinProducts = Object.entries(allFinProducts).sort((a, b) => b[1] - a[1]).slice(0, 60);
        const sortedTopics = Object.entries(topicDist).sort((a, b) => b[1] - a[1]);

        // Top summaries by relevance
        const topByRelevance = allSummaries.sort((a, b) => b.relevance - a.relevance).slice(0, 30);

        const result = {
            overview: {
                totalVideos: allVideos.length,
                totalProcessedKB: kbEntries.length,
                totalChannels: Object.keys(channelStats).length,
                totalInsights: allInsights.length,
                totalUniqueTags: Object.keys(tagCounts).length,
            },
            channelStats,
            channelTopics,
            distributions: {
                topics: sortedTopics,
                sentiment: sentimentDist,
                audience: audienceDist,
                actionability: actionabilityDist,
                risk: riskDist,
                duration: durationBuckets,
                titlePatterns,
            },
            topicEngagement: Object.fromEntries(
                Object.entries(topicEngagement).map(([k, v]) => [k, {
                    avgViews: Math.round(v.totalViews / v.count),
                    avgLikes: Math.round(v.totalLikes / v.count),
                    count: v.count,
                }]).sort((a: any, b: any) => b[1].avgViews - a[1].avgViews)
            ),
            subTopics: sortedSubTopics,
            financialProducts: sortedFinProducts,
            topTags,
            monthlyPublishing: Object.fromEntries(Object.entries(monthlyPublish).sort()),
            topVideosByViews,
            topByRelevance,
            sampleInsights: allInsights.slice(0, 200),
        };

        const outPath = path.join(process.cwd(), 'youtube-analysis.json');
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
        console.log(`Written to ${outPath}`);

        // Print summary
        console.log('\n=== OVERVIEW ===');
        console.log(JSON.stringify(result.overview, null, 2));
        console.log('\n=== CHANNEL STATS ===');
        for (const cs of Object.values(channelStats)) {
            console.log(`\n${cs.name}: ${cs.totalVideos} videos | ${(cs.totalViews / 1e6).toFixed(1)}M views | avg ${formatDuration(cs.avgDurationSec)} | ${cs.hasTranscript} transcripts | ${cs.processed} processed`);
        }
        console.log('\n=== TOPIC DISTRIBUTION ===');
        console.log(JSON.stringify(sortedTopics, null, 2));
        console.log('\n=== CONTENT TYPE BY TITLE ===');
        console.log(JSON.stringify(titlePatterns, null, 2));
        console.log('\n=== DURATION DISTRIBUTION ===');
        console.log(JSON.stringify(durationBuckets, null, 2));
        console.log('\n=== AUDIENCE DISTRIBUTION ===');
        console.log(JSON.stringify(audienceDist, null, 2));
        console.log('\n=== ACTIONABILITY ===');
        console.log(JSON.stringify(actionabilityDist, null, 2));
        console.log('\n=== SENTIMENT ===');
        console.log(JSON.stringify(sentimentDist, null, 2));

        await mongoose.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error(`Fatal error: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
