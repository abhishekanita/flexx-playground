import creditScore from '@/plugins/credit-score/credit-score.plugin';

const params = {
    abhishek: {
        firstName: 'ABHISHEK',
        lastName: 'AGGARWAL',
        dob: '18-04-1997',
        phone: '7838237658',
        email: 'abhishek12318@gmail.com',
        pan: 'BSCPA0434K',
        address: {
            line1: 'HOUSE 544-A/B2, BITNA ROAD, SHIV COLONY',
            city: 'PINJORE',
            state: 'HARYANA',
            stateCode: 'HA',
            pincode: '134102',
            country: 'India',
        },
    },
    ashutosh: {
        firstName: 'ASHUTOSH',
        lastName: 'DHEWAL',
        dob: '06-11-1995',
        phone: '9810254998',
        email: 'ashudhewal@gmail.com',
        pan: 'BWKPD0449P',
        address: {
            line1: 'HOUSE 544-A/B2, BITNA ROAD, SHIV COLONY',
            city: 'PINJORE',
            state: 'HARYANA',
            stateCode: 'HA',
            pincode: '134102',
            country: 'India',
        },
    },
};

class TestCreditScore {
    private testParams = params['ashutosh'];

    async testInitiate(params?: typeof this.testParams) {
        console.log('=== Testing: CRIF HighMark Initiate ===');
        try {
            const result = await creditScore.initiate(params || this.testParams);
            console.log('Initiate Result:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('Initiate failed:', error);
            throw error;
        }
    }

    async testAuthorize(orderId: string, reportId: string) {
        console.log('=== Testing: CRIF HighMark Authorize ===');
        try {
            const result = await creditScore.authorize({ orderId, reportId });
            console.log('Authorize Result:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('Authorize failed:', error);
            throw error;
        }
    }

    async testFetchReport(orderId: string, reportId: string) {
        console.log('=== Testing: CRIF HighMark Fetch Report ===');
        try {
            const result = await creditScore.fetchReport({ orderId, reportId });
            console.log('Report:', JSON.stringify(result.report, null, 2));
            return result;
        } catch (error) {
            console.error('Fetch report failed:', error);
            throw error;
        }
    }

    async runFullFlowTest(params?: typeof this.testParams) {
        console.log('========================================');
        console.log('    CREDIT SCORE FLOW TEST');
        console.log('========================================\n');

        console.log('\n--- Step 1: Initiate ---');
        const initResult = await this.testInitiate(params);
        console.log('initResult', initResult);

        if (!initResult.reportId) {
            console.log('\nNo reportId returned. Check rawResponse for details.');
            return initResult;
        }

        console.log('\n--- Step 2: Authorize ---');
        await this.testAuthorize(initResult.orderId, initResult.reportId);

        console.log('\n--- Step 3: Fetch Report ---');
        const report = await this.testFetchReport(initResult.orderId, initResult.reportId);

        console.log('report', report);
        console.log('\n========================================');
        console.log('    TEST COMPLETE');
        console.log('========================================');

        return { initResult, report };
    }
}

export default new TestCreditScore();
