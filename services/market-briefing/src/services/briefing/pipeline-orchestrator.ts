import logger from '@/utils/logger';
import { formatCost } from '@/utils/ai-cost';
import { PipelineRun, ContentPiece } from '@/schema';
import type { IPipelineRun, IPipelineStage, PipelineTrigger } from '@/schema';
import { aggregateUserDemand, fetchAllData } from './data-aggregator';
import { generateAllContent } from './content-generator';
import type { PipelineEvent } from './types';

const log = logger.createServiceLogger('PipelineOrchestrator');

export class PipelineOrchestrator {
	/**
	 * Run the full daily briefing pipeline:
	 *   Stage 1: Aggregate demand
	 *   Stage 2: Fetch raw data
	 *   Stage 3: Generate content via LLM
	 *   Stage 4: Store content + update pipeline run
	 */
	async runDailyPipeline(trigger: PipelineTrigger = 'manual'): Promise<IPipelineRun> {
		const pipelineStart = Date.now();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		log.info(`Starting daily pipeline (trigger: ${trigger})`);

		// Create pipeline run document
		const pipelineRun = await PipelineRun.create({
			date: today,
			trigger,
			status: 'running',
			stages: [
				{ name: 'aggregate-demand', status: 'pending' },
				{ name: 'fetch-data', status: 'pending' },
				{ name: 'generate-content', status: 'pending' },
				{ name: 'store-content', status: 'pending' },
			],
		});

		try {
			// ─── Stage 1: Aggregate Demand ──────────────────────
			await this.updateStage(pipelineRun, 'aggregate-demand', 'running');
			const demand = await aggregateUserDemand();
			await this.updateStage(pipelineRun, 'aggregate-demand', 'completed', {
				userCount: demand.userCount,
				symbols: demand.symbols.length,
				schemes: demand.schemeCodes.length,
				interests: demand.interests.length,
			});

			// ─── Stage 2: Fetch Data ────────────────────────────
			await this.updateStage(pipelineRun, 'fetch-data', 'running');
			const dataFetchStart = Date.now();
			const rawData = await fetchAllData(demand, pipelineRun._id);
			const dataFetchTimeMs = Date.now() - dataFetchStart;

			// Compute article dedup stats
			const totalArticlesFetched = rawData.rssArticles.length + rawData.rbiArticles.length +
				rawData.marketNews.length +
				[...rawData.stockNews.values()].reduce((sum, arr) => sum + arr.length, 0);

			await this.updateStage(pipelineRun, 'fetch-data', 'completed', {
				stockQuotes: rawData.stockQuotes.length,
				indexQuotes: rawData.indexQuotes.length,
				macroQuotes: rawData.macroQuotes.length,
				fiiDiiAvailable: !!rawData.fiiDiiTrend.today,
				mfNAVs: rawData.mfNAVs.length,
				rssArticles: rawData.rssArticles.length,
				marketNews: rawData.marketNews.length,
				creatorVideos: rawData.creatorVideos.length,
				creatorReels: rawData.creatorReels.length,
				errors: rawData.errors.length,
				articlesStored: rawData.savedArticles.length,
				articlesDeduplicated: totalArticlesFetched - rawData.savedArticles.length,
				timeMs: dataFetchTimeMs,
			});

			// ─── Stage 3: Generate Content ──────────────────────
			await this.updateStage(pipelineRun, 'generate-content', 'running');
			const contentGenStart = Date.now();
			const generatedContent = await generateAllContent(rawData, demand, pipelineRun._id);
			const contentGenTimeMs = Date.now() - contentGenStart;
			const totalLLMCost = generatedContent.reduce((sum, r) => sum + r.costUSD, 0);
			await this.updateStage(pipelineRun, 'generate-content', 'completed', {
				piecesGenerated: generatedContent.length,
				totalLLMCost: formatCost(totalLLMCost),
				timeMs: contentGenTimeMs,
			});

			// ─── Stage 4: Store Content ─────────────────────────
			await this.updateStage(pipelineRun, 'store-content', 'running');

			// Archive previous content
			await ContentPiece.updateMany(
				{ date: { $lt: today }, status: 'published' },
				{ $set: { status: 'archived' } },
			);

			// Bulk insert new content
			const contentDocs = generatedContent.map((result) => ({
				pipelineRunId: pipelineRun._id,
				date: today,
				category: result.input.category,
				subcategory: result.input.subcategory || '',
				title: result.content.title,
				body: result.content.body,
				tldr: result.content.tldr,
				durationSeconds: result.content.durationSeconds,
				tags: {
					symbols: result.input.tags.symbols || [],
					schemeCodes: result.input.tags.schemeCodes || [],
					sectors: result.input.tags.sectors || [],
					interests: result.input.tags.interests || [],
					riskLevels: result.input.tags.riskLevels || [],
					incomeBrackets: result.input.tags.incomeBrackets || [],
					ageGroups: result.input.tags.ageGroups || [],
					isUniversal: result.input.tags.isUniversal || false,
				},
				sources: result.input.sources,
				modelId: result.model,
				promptTokens: result.promptTokens,
				completionTokens: result.completionTokens,
				costUSD: result.costUSD,
				priority: result.input.priority,
				status: 'published',
			}));

			if (contentDocs.length > 0) {
				await ContentPiece.insertMany(contentDocs);
			}

			await this.updateStage(pipelineRun, 'store-content', 'completed', {
				stored: contentDocs.length,
			});

			// ─── Finalize ───────────────────────────────────────
			const totalTimeMs = Date.now() - pipelineStart;

			pipelineRun.status = 'completed';
			pipelineRun.stats = {
				totalUsers: demand.userCount,
				uniqueSymbols: demand.symbols.length,
				uniqueSchemes: demand.schemeCodes.length,
				uniqueInterests: demand.interests.length,
				contentPiecesGenerated: generatedContent.length,
				totalLLMCost,
				dataFetchTimeMs,
				contentGenTimeMs,
				totalTimeMs,
			};
			await pipelineRun.save();

			log.info(`Pipeline completed in ${(totalTimeMs / 1000).toFixed(1)}s`);
			log.info(`  ${generatedContent.length} content pieces generated`);
			log.info(`  LLM cost: ${formatCost(totalLLMCost)}`);
			log.info(`  Data fetch: ${(dataFetchTimeMs / 1000).toFixed(1)}s`);
			log.info(`  Content gen: ${(contentGenTimeMs / 1000).toFixed(1)}s`);

			return pipelineRun;
		} catch (err: any) {
			log.error(`Pipeline failed: ${err.message}`);

			pipelineRun.status = 'failed';
			pipelineRun.error = err.message;
			pipelineRun.stats.totalTimeMs = Date.now() - pipelineStart;
			await pipelineRun.save();

			throw err;
		}
	}

	/**
	 * Run an event-triggered pipeline (crash, RBI announcement, etc.)
	 */
	async runEventPipeline(event: PipelineEvent): Promise<IPipelineRun> {
		const trigger: PipelineTrigger = event.type === 'crash'
			? 'event:crash'
			: event.type === 'rbi'
				? 'event:rbi'
				: 'manual';

		log.info(`Running event pipeline: ${trigger}`);
		return this.runDailyPipeline(trigger);
	}

	// ─── Helpers ────────────────────────────────────────────────

	private async updateStage(
		pipelineRun: IPipelineRun,
		stageName: string,
		status: IPipelineStage['status'],
		metadata?: Record<string, any>,
	): Promise<void> {
		const stage = pipelineRun.stages.find((s) => s.name === stageName);
		if (!stage) return;

		stage.status = status;
		if (status === 'running') stage.startedAt = new Date();
		if (status === 'completed' || status === 'failed') stage.completedAt = new Date();
		if (metadata) stage.metadata = metadata;

		await pipelineRun.save();
		log.info(`Stage "${stageName}" → ${status}`);
	}
}

export const pipelineOrchestrator = new PipelineOrchestrator();
