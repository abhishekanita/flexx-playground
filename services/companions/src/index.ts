import { processRedditPosts } from './scripts/scripts/reddit/process-reddit';
import creditScorePlugin from './plugins/credit-score/credit-score.plugin';
import testAccountAggregator from './scripts/test/test-account-aggregator';
import testCreditScore from './scripts/test/test-credit-score';
import { testUPIAutopay } from './scripts/test/test-upi-autopay';
import { testInstaScrapping } from './scripts/test/test-insta-scrapping';
import { startInstaScrapping } from './scripts/scripts/insta/start-instagram-scraping';
import redditService from './services/reddit/reddit.service';

const main = async () => {
    try {
        // console.log('Started');
        // await testCreditScore.runFullFlowTest();
        // await testCreditScore.testInitiate();
        // const oId = '1bd18171-c14b-43a1-8eeb-5fd3aceef9b7';
        // const rId = 'CCR260225CR862559554';
        // await testCreditScore.testAuthorize(oId, rId);

        // await processRedditPosts();

        // await redditService.exportProcessed('csv');
        // await testCams.testFullFlow();
        await testAccountAggregator.runFullFlowTest();
        // await testInstaScrapping();
        // await startInstaScrapping();

        console.log('Ended');
    } catch (err) {
        console.log(err);
    }
};

main();
