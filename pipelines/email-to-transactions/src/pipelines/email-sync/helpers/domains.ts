// =============================================================================
// Promotional sender blacklist — emails from these senders are skipped at sync
// =============================================================================
// Only includes senders that are PURELY promotional (no financial data).
// Domains that send both transactional + promotional emails (swiggy, cred,
// amazon, kfintech, nsdl, etc.) are NOT blacklisted here — their promotional
// emails are handled by catch-all marketing parser configs instead.

export const PROMOTIONAL_SENDERS: RegExp[] = [
    // Banks — marketing / offers senders (not alert/statement senders)
    /^inform?ations?@(?:hdfcbank\.net|mailers\.hdfcbank\.net)$/i,
    /^offers@offers\.sbicard\.com$/i,
    /^americanexpress@email\.americanexpress\.com$/i,
    /^info@bajajfinance\.com$/i,
    /^sbi@communications\.sbi$/i,

    // Investment platforms — newsletters / digests
    /^noreply@(?:digest\.groww\.in|daily\.digest\.groww\.in|dailydigest\.groww\.in)$/i,
    /^noreply@newsletter\.zerodha$/i,
    /^alerts@mailer\.moneycontrol\.com$/i,
    /^service@service\.icicisecurities\.com$/i,

    // Travel — marketing senders
    /^noreply@zen-?makemytrip\.com$/i,
    /^mailers@marketing\.goindigo$/i,
    /^newsletter@reply\.agoda$/i,
    /^noreply@update\.goibibo$/i,

    // Food / Commerce — marketing senders
    /^noreply@mailers\.zomato\.com$/i,
    /^(?:alert|noreply)@(?:info\.|notify\.)?bigbasket\.com$/i,
    /^noreply@nykaa\.com$/i,
    /^(?:mail@info\.paytm\.com|noreply@paytmoffers\.in)$/i,
    /^no-reply@mailer\.urbanladder\.com$/i,
    /^noreply@tataneuloan\.tataneu\.com$/i,

    // Newsletters / misc platforms
    /@mail\.beehiiv\.com$/i,
    /@substack\.com$/i,
    /@linkedin\.com$/i,
    /^newsletter@(?:economictimesnews|ettech|etretail|ethealthworld|etprime|etbrandequity)\.com$/i,
    /^notification@rize\.io$/i,
    /^mail@adplistapp\.org$/i,
    /^do-not-reply@rank1infotech\.com$/i,

    // Booking / hospitality
    /@booking\.com$/i,
    /^discover@airbnb/i,
    /^automated@airbnb/i,
    /^bookings@hostelworld/i,
    /^newsletter@notifications\.lumosity/i,

    // Misc small senders (purely promotional / non-financial)
    /^info@seabeachhostel/i,
    /^update\.en@em\.talabat/i,
    /^info@n\.myprotein/i,
    /^contactwwod@myhq/i,
    /^bookings@community\.myhq/i,
    /^noreply@myhq/i,
    /^notice@e\.godaddy/i,
    /^sm\.profiles@yourstory/i,
    /^contact@waalaxy/i,
    /^hey@mail\.granola/i,
    /^connor@pilotplans/i,
    /^morning@finshots/i,
    /^hello@(?:chess|namecheap|the-captable)/i,
    /^store\+/i,
    /^no-reply@youtube/i,
    /^noreply@redditmail/i,
    /^prime@amazon/i,
    /^account-update@amazon/i,
    /^(?:payments-update|store-news)@amazon\.in$/i,
    /^noreply@darwinbox/i,
    /^email@email\.playstation/i,
];

/**
 * Check if an email sender address is on the promotional blacklist.
 */
export function isPromotionalSender(fromAddress: string): boolean {
    return PROMOTIONAL_SENDERS.some(pattern => pattern.test(fromAddress));
}

export const EMAIL_DOMAINS: Record<'BANK' | 'INVESTMENT' | 'INSURANCE' | 'FINTECH' | 'COMMERCE', string[]> = {
    BANK: [
        'kotak.bank.in',
        'alerts.sbi.co.in',
        'hdfcbank.net',
        'hdfc.bank.in',
        'icicibank.com',
        'icici.bank.in',
        'sbi.co.in',
        'sbi.bank.in',
        'axisbank.com',
        'axis.bank.in',
        'kotak.com',
        'kotakbank.com',
        'yesbank.in',
        'indusind.com',
        'idfcfirstbank.com',
        'federalbank.co.in',
        'rblbank.com',
        'bandhanbank.com',
        'aubank.in',
        'bankofbaroda.co.in',
        'bankofbaroda.com',
        'canarabank.com',
        'unionbankofindia.co.in',
        'pnb.co.in',
        'bankofindia.co.in',
        'centralbankofindia.co.in',
        'indianbank.in',
        'iob.in',
        'idbi.co.in',
        'dcbbank.com',
        'csb.co.in',
        'ippbonline.in',
    ],
    INVESTMENT: [
        'zerodha.com',
        'groww.in',
        'upstox.com',
        'angelone.in',
        'paytmmoney.com',
        'phonepe.com',
        'smallcase.com',
        'camsonline.com',
        'kfintech.com',
        'cdslindia.com',
        'nsdl.co.in',
        'kuvera.in',
    ],
    INSURANCE: ['policybazaar.com', 'acko.com', 'tataaig.com', 'hdfclife.com', 'licindia.in'],
    FINTECH: ['paytm.com', 'razorpay.com', 'cashfree.com', 'sliceit.com'],
    COMMERCE: [
        'amazon.in',
        'flipkart.com',
        'swiggy.in',
        'zomato.com',
        'uber.com',
        'ola.com',
        'irctc.co.in',
        'makemytrip.com',
        'goibibo.com',
        'airbnb.com',
        'booking.com',
        'bigbasket.com',
        'blinkit.com',
        'zepto.com',
        'nykaa.com',
        'myntra.com',
    ],
};
