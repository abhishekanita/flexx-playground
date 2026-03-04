import { InstagramPlugin } from '@/plugins/instagram/instagram.plugin';
import { fetchInstaTranscripts } from '../scripts/insta/fetch-instagram-transcripts';

export const testInstaScrapping = async () => {
    try {
        const instaPlugin = new InstagramPlugin();
        // const reels = await instaPlugin.searchReelsByKeyword('finance', 20);
        await fetchInstaTranscripts();
        // console.log(reels);
    } catch (err) {
        console.log(err);
    }
};
