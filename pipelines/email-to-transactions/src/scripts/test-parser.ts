enum FinancialEmailTypes {
    BankTransactionAlerts = 'BankTransactionAlerts',
    CreditCardSpendAlerts = 'CreditCardSpendAlerts',
    MonthlyBankStatements = 'MonthlyBankStatements',
    MonthlyCreditCardStatements = 'MonthlyCreditCardStatements',
    MutualFundConfirmations = 'MutualFundConfirmations',
    MutualFundCAS = 'MutualFundCAS',
    BrokerContractNotes = 'BrokerContractNotes',
    InsurancePremiums = 'InsurancePremiums',
    EMIDeductionAlerts = 'EMIDeductionAlerts',
    TaxAndITR = 'TaxAndITR',
    SubscriptionReceipts = 'SubscriptionReceipts',
    SpendingReceipts = 'SpendingReceipts',
    UPIAppReceipts = 'UPIAppReceipts',
}

export const parsers = [
    {
        sender: 'BankStatements@kotak.bank.in',
        subject: '/Your January 2026 statement for Kotak A/c X9778/i',
        dataIn: 'encrypted-pdf',
        numberOfAttachments: 1,
        category: FinancialEmailTypes.MonthlyBankStatements,
        passwordHint: '{{fullname.tolowercase(without_space).(first_4)}}{{dob.(first_4)}}', //abhi1804
        pdfDecryted: () => {
            return [];
        },
    },
    {
        email: 'no-reply@paytm.com>',
        subject: 'Your Paytm Statement - February 2026',
        dataIn: 'encrypted-pdf',
        category: FinancialEmailTypes.UPIAppReceipts,
        numberOfAttachments: 2,
        // howToFilterAttachment: isXls(),
        passwordHint: '{{fullname.tolowercase(without_space).(first_4)}}{{dob.(first_4)}}', //abhi1804
        pdfDecryted: () => {
            return [];
        },
    },
];
