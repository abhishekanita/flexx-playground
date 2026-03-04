import mongoose from 'mongoose';
import { config } from '@/config';
import { GrowwScraper } from '@/core/scraper/groww-scraper';

const mode = process.argv[2] || 'light'; // light | deep | full
const maxDeep = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

async function main() {
	console.log(`Connecting to MongoDB...`);
	await mongoose.connect(config.db.uri + '/' + config.db.name);
	console.log(`Connected. Running Groww scraper in "${mode}" mode...`);

	const scraper = new GrowwScraper();

	let stats;
	switch (mode) {
		case 'light':
			stats = await scraper.lightSync();
			break;
		case 'deep':
			stats = await scraper.deepSync(maxDeep);
			break;
		case 'full':
			stats = await scraper.fullSync(maxDeep);
			break;
		default:
			console.error(`Unknown mode: ${mode}. Use light, deep, or full.`);
			process.exit(1);
	}

	console.log('\n--- Groww Scraper Stats ---');
	console.log(`  AMCs processed:       ${stats.amcsProcessed}`);
	console.log(`  Schemes (light sync): ${stats.schemesFromLightSync}`);
	console.log(`  Schemes (deep sync):  ${stats.schemesDeepSynced}`);
	console.log(`  Errors:               ${stats.errors.length}`);
	if (stats.errors.length) {
		stats.errors.forEach((e) => console.log(`    - ${e}`));
	}

	await mongoose.disconnect();
	console.log('Done.');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
