import { npciPlugin } from '@/plugins/npci/npci.plugin';
import axios from 'axios';

class TestUPIAutopay {
    constructor() {}

    async run() {
        const phone = '9606187162';
        // const phoneRes = await npciPlugin.sendOTP(phone);
        // console.log(phoneRes);
        // return;

        // const authResponse2 = await npciPlugin.validateOTP(phone, '363388');
        // console.log(authResponse2);
        // return;

        //ashu
        const authResponse = {
            access_token:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzIiwibW9iaWxlX251bWJlciI6IjJWdGR6NnFXdy9yM0N3RDNqOVZCUVE9PSIsInNlc3Npb25faWQiOiJiZDFhZjE2MC0xMjIxLTExZjEtODQ3Zi0xZWY0OTIxNThhNjAiLCJleHAiOjE3NzIwMDg5NTR9.wEnfNGPHxz2EltS1UJxSdHKpGJzWykA2w7JVX1iwILQ',
            session_id: 'bd1af160-1221-11f1-847f-1ef492158a60',
            user: {
                id: '3910b316-d889-425c-a98f-45838f6f9197',
                phone: '2Vtdz6qWw/r3CwD3j9VBQQ==',
                created_at: '2026-01-15T17:03:26.120000',
            },
            csrf_token: '2SQ2ObsU2qWdgXxNz4CAteb1owvt1AFL',
        };

        const parthResponse = {
            access_token:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzIiwibW9iaWxlX251bWJlciI6IjU0VkFORXhBREJPUTdzWEU2NDV5bUE9PSIsInNlc3Npb25faWQiOiJhOTc0OWNmYS0xMjIyLTExZjEtYTUzYi1kNmI2YzM1ZWFhNjgiLCJleHAiOjE3NzIwMDkzNTB9.9rxtrA-eV8MkHQw9Epd5kDqF_vaN-W-1J2MtN9fOzrg',
            session_id: 'a9749cfa-1222-11f1-a53b-d6b6c35eaa68',
            user: {
                id: 'a4257e19-e8c1-4443-b6a4-e85a2b20b079',
                phone: '54VANExADBOQ7sXE645ymA==',
                created_at: '2026-01-16T16:32:52.192000',
            },
            csrf_token: 'IhkUMhCm81cnO3CPemKXZgMfKJTYCDRs',
        };

        npciPlugin.loginFromOTPResponse(parthResponse);
        const mandates = await npciPlugin.getMandates(parthResponse.user.phone);
        const insights = await npciPlugin.generateInsights(mandates);
        console.log(mandates);
        console.log(insights);

        // return;
        // const revokeLink = await npciPlugin.revokeMandate(tokens.user.phone, mandates[0]);
        // console.log('revokeLink', revokeLink);
        // npciPlugin.printRevokeQR(mandates[0], 'PHONEPE');
        // console.log(revokeLink);
    }
}

export const testUPIAutopay = new TestUPIAutopay();

[
    {
        umn: '490cf9163a840e0ae063871cbc0ae49e@ptsbi',
        payeeName: 'AWS INDIA',
        amount: 15000,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'EDUCATION & PROFESSIONAL SERVICES',
        totalExecutionCount: 1,
        totalExecutionAmount: 2,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '2571980ff6526355e0630c27b10a6667@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 195,
        recurrance: 'CUSTOM',
        status: 'INACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 5,
        totalExecutionAmount: 975,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '49079e55d04a08f9e063871cbc0a438b@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 1199,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 1,
        totalExecutionAmount: 1199,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '4744526d8b324692e0630827b10a88d8@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 399,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 1,
        totalExecutionAmount: 5,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '48f8b390322fa416e063881cbc0a9bf8@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 149,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 2,
        totalExecutionAmount: 298,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '36c5df92d97e6bb5e0630b27b10ab6d9@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 399,
        recurrance: 'CUSTOM',
        status: 'INACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 2,
        totalExecutionAmount: 798,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '361f59d727ca7330e0630c27b10a915b@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 999,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 1,
        totalExecutionAmount: 5,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '4a69eed2890bc933e063881cbc0acb57@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 99,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 1,
        totalExecutionAmount: 99,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '2bc2c5be1083cdb8e0630c27b10a22f7@ptsbi',
        payeeName: 'APPLE MEDIA SERVICES',
        amount: 1799,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'ENTERTAINMENT & MEDIA',
        totalExecutionCount: 2,
        totalExecutionAmount: 3598,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '8c2c9a93e51c465c9200122fb1de8f7f@ibl',
        payeeName: 'GOODSCORE',
        amount: 99,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'INVESTMENTS & FINANCIAL SERVICES',
        totalExecutionCount: 1,
        totalExecutionAmount: 99,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '4a00a0983832e928e063871cbc0ab3e2@ptsbi',
        payeeName: 'JIO BLACKROCK INVESTMENT ADVISERS PRIVATE LIMITED',
        amount: 499,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'INVESTMENTS & FINANCIAL SERVICES',
        totalExecutionCount: 1,
        totalExecutionAmount: 1,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '4a39a9a7022d16f6e0638b1cbc0a85a3@ptsbi',
        payeeName: 'APPLE SERVICES',
        amount: 8700,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'RETAIL & SHOPPING',
        totalExecutionCount: 1,
        totalExecutionAmount: 8700,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '505c09cd07094b4c8d3fec766e78608d@ibl',
        payeeName: 'AMAZON INDIA',
        amount: 39,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'RETAIL & SHOPPING',
        totalExecutionCount: 1,
        totalExecutionAmount: 29,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: 'ca9be0c8ca1849b89c24bde18e3a37de@ybl',
        payeeName: 'DISNEY HOTSTAR',
        amount: 1499,
        recurrance: 'CUSTOM',
        status: 'INACTIVE',
        category: 'RETAIL & SHOPPING',
        totalExecutionCount: 2,
        totalExecutionAmount: 2998,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: 'PTM78d663ea64473bfd6242c610664a2@paytm',
        payeeName: 'APPLE SERVICES',
        amount: 169,
        recurrance: 'CUSTOM',
        status: 'INACTIVE',
        category: 'RETAIL & SHOPPING',
        totalExecutionCount: 16,
        totalExecutionAmount: 2704,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '51094c629ce24098bc378428ea5d39cd@ybl',
        payeeName: 'NETFLIX COM',
        amount: 649,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'UTILITIES & BILL PAYMENTS',
        totalExecutionCount: 23,
        totalExecutionAmount: 14927,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '2f5e6f0396964fdcacb0a33bfaea6f31@ibl',
        payeeName: 'GOOGLE',
        amount: 1950,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'OTHERS',
        totalExecutionCount: 2,
        totalExecutionAmount: 1950,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
    {
        umn: '0173ea0f2d2a45819667d26b0b18bad8@ibl',
        payeeName: 'ELEVEN LABS',
        amount: 519.2,
        recurrance: 'CUSTOM',
        status: 'ACTIVE',
        category: 'OTHERS',
        totalExecutionCount: 1,
        totalExecutionAmount: 519.2,
        isPause: true,
        isRevoke: true,
        isUnpause: false,
    },
];
