import { AccountAggregator } from '@/plugins/account-aggregator/account-aggregator';
import accountAggregator from '@/plugins/account-aggregator/account-aggregator.plugin';

class TestAccountAggregator {
    async runFullFlowTest() {
        const userId = '9814838083@finvu';
        // const accessToken = '';
        const accessToken: string =
            'eyJraWQiOiJmaW5zZW5zZSIsImFsZyI6IlJTMjU2In0.eyJpc3MiOiJmaW5mYWN0b3IiLCJhdWQiOiJmaW5mYWN0b3IiLCJleHAiOjE3NzI1Njg3MTksImp0aSI6Ik44cVVzY2wyM2IwaFFFMTZhd1lfQlEiLCJpYXQiOjE3NzI0ODIzMTksIm5iZiI6MTc3MjQ4MjMxOSwic3ViIjoiY2hhbm5lbEBmaW50cmFsZWFzZSIsImF6cCI6ImNoYW5uZWxAZmludHJhbGVhc2UiLCJyb2xlcyI6ImNoYW5uZWwiLCJ0aWQiOiJmaXVsaXZlQGZpbnRyYWxlYXNlIn0.D287f1n7ktjEM2ahBD4Xm9aa03EmGUOT7Egvx2tpzPMq-flgboZn6xvf4fKNemyi4V3-MljQzC3c18MM-c1abAVAQoT9UnUaDlcp6_4z8YpqQjvkGzL8kh8mZMTmavKhqhsJ8oFCSK0Qvxf3z3C1kOIUHB0WGY_a1kUhf2gVLZ1clRzRr4MPLe8XZjBZ_Tgtn4c-fKaiu3FqmnB7-kFAh-iIzS2C-ZMyKuu4fC7r0LN7dWgfc3Kn2MeF84up59ge0S0TCQ2eZQbSHbJuUtKemmxlGODvuP5uuY1MH1Sy0qAnHgQ2PLRRQ7oH9nPQZXUQDtqCtdIwnz4hirvRLJoOwQ';

        const aa = new AccountAggregator(accessToken);

        if (!accessToken || accessToken === '') {
            await aa.login();
        }

        const requsestConsent = await aa.createConsentRequest({ customerId: userId });
        console.log('requsestConsent', requsestConsent);

        // requsestConsent {
        //     encryptedRequest: 'IgkgUehoIPPR-QbvNSJWsNX_xy7jWIZhoqg-hOCEnL9lz5V8zAgWzDW-ZGxFJYgZR6Ny1JPb5bwJqvGiqJTbBVP2l6oJLyAy-EAHkeW3UnWG4TmZoHuRcYQN4iCJTdmdkr9uTjH2gwZC6UCdjKqD5ILsbRstYhy63YfeLH1L5CnrXnCQ3kARLvtE9qyT2TkIcuxFaOxdGPbh-muI7PVflQRrjzr4wx1DW5KUD30YZy4aTVtbAVNAjGvuvrio5SknZV4psZWunT4hAqxYVoiJnUxkIAAwgN254kbey7IbZhMi1QmVGvp8KPxuO5cwbLPf',
        //     requestDate: '020320261557636',
        //     encryptedFiuId: 'VltFX1tGV3ZXXFtDRFJaVVNDVg==',
        //     ConsentHandle: '91522b75-1d13-48e8-9ba8-d975cefce2c8',
        //     url: 'https://webvwlive.finvu.in/onboarding?ecreq=IgkgUehoIPPR-QbvNSJWsNX_xy7jWIZhoqg-hOCEnL9lz5V8zAgWzDW-ZGxFJYgZR6Ny1JPb5bwJqvGiqJTbBVP2l6oJLyAy-EAHkeW3UnWG4TmZoHuRcYQN4iCJTdmdkr9uTjH2gwZC6UCdjKqD5ILsbRstYhy63YfeLH1L5CnrXnCQ3kARLvtE9qyT2TkIcuxFaOxdGPbh-muI7PVflQRrjzr4wx1DW5KUD30YZy4aTVtbAVNAjGvuvrio5SknZV4psZWunT4hAqxYVoiJnUxkIAAwgN254kbey7IbZhMi1QmVGvp8KPxuO5cwbLPf&reqdate=020320261557636&fi=VltFX1tGV3ZXXFtDRFJaVVNDVg%3D%3D&fip='
        //   }
        // console.log('requsestConsent', requsestConsent);
        // const consentHandle = requsestConsent.ConsentHandle;
        const consentHandle = '78d62086-ec36-4111-9165-2f9dd1f38c78';
        const consentId = '8078dcc2-e309-45bd-a5ff-cc852ff89872';
        const sessionId = '15db9a61-7bff-4e72-a5b8-87b93c99daf7';
        // const ts = '2026-03-02T19:57:21.104+00:00';

        // const status = await aa.getConsentStatus(consentHandle, userId);
        // console.log(status);

        // const dataRequestResponse = await aa.createFidataRequest(userId, consentHandle, consentId);
        // console.log(dataRequestResponse);

        const status = await aa.getFiDataStatus(consentId, sessionId, consentHandle, userId);
        console.log('status', status);
    }
}

export default new TestAccountAggregator();
