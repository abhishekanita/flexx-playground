export enum TransactionType {
    Debit = 'debit',
    Credit = 'credit',
    Reversal = 'reversal',
    Refund = 'refund',
}

export enum TransactionChannel {
    UPI = 'UPI',
    IMPS = 'IMPS',
    NEFT = 'NEFT',
    RTGS = 'RTGS',
    ATM = 'ATM',
    POS = 'POS', // card swipe at terminal
    NACH = 'NACH', // auto-debit / EMI mandate
    Cheque = 'CHEQUE',
    NetBanking = 'NET_BANKING',
    Wallet = 'WALLET', // Paytm wallet, Amazon Pay, etc.
    CreditCard = 'CREDIT_CARD',
    Unknown = 'UNKNOWN',
}

export enum TransactionCategory {
    // Food
    FoodDelivery = 'food_delivery', // Swiggy, Zomato
    Restaurant = 'restaurant', // dine-in
    Groceries = 'groceries', // Zepto, Blinkit, BigBasket

    // Transport
    CabRide = 'cab_ride', // Ola, Uber, Rapido
    Fuel = 'fuel', // HPCL, BPCL, IOC
    PublicTransit = 'public_transit', // metro, bus

    // Shopping
    Ecommerce = 'ecommerce', // Amazon, Flipkart
    Fashion = 'fashion',
    Electronics = 'electronics',

    // Entertainment
    OTT = 'ott', // Netflix, Hotstar, Prime
    Movies = 'movies', // BookMyShow, PVR
    Gaming = 'gaming',

    // Bills & Utilities
    Electricity = 'electricity',
    Water = 'water',
    Gas = 'gas',
    Broadband = 'broadband',
    MobileRecharge = 'mobile_recharge',

    // Financial
    EMI = 'emi', // loan EMI
    CreditCardBill = 'credit_card_bill',
    Investment = 'investment', // MF, stocks, FD
    Insurance = 'insurance',
    Rent = 'rent',
    Salary = 'salary',
    Transfer = 'transfer', // peer-to-peer
    ATMWithdrawal = 'atm_withdrawal',

    // Health
    Medical = 'medical',
    Pharmacy = 'pharmacy',

    // Education
    Education = 'education',

    // Travel
    Flight = 'flight',
    Hotel = 'hotel',
    Train = 'train',

    // Subscriptions
    Subscription = 'subscription',

    Other = 'other',
    Unknown = 'unknown',
}

export enum UpiApp {
    PhonePe = 'PhonePe',
    GooglePay = 'GooglePay',
    Paytm = 'Paytm',
    BHIM = 'BHIM',
    CRED = 'CRED',
    AmazonPay = 'AmazonPay',
    WhatsAppPay = 'WhatsAppPay',
    Slice = 'Slice',
    Jupiter = 'Jupiter',
    Fi = 'Fi',
    Other = 'Other',
}

export enum SignalSourceType {
    BankAlert = 'bank_alert',
    BankStatement = 'bank_statement',
    CreditCardStatement = 'credit_card_statement',
    MerchantInvoice = 'merchant_invoice',
    UpiStatement = 'upi_statement',
}

export enum EnrichmentAction {
    Create = 'create',
    Enrich = 'enrich',
    EnrichWithReview = 'enrich_with_review',
    Duplicate = 'duplicate', // same signal seen twice — skip
}

export enum ReconciliationStatus {
    Pending = 'pending', // no bank statement yet
    Reconciled = 'reconciled', // confirmed in bank statement
    Unmatched = 'unmatched', // invoice exists but no bank debit found
    Disputed = 'disputed', // amount mismatch across signals
}
