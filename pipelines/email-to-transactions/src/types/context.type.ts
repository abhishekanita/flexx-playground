import { UpiApp } from './transactions.enums';

export interface FoodDeliveryItem {
    name: string;
    qty: number;
    price: number; // INR
    category?: string; // 'biryani' | 'beverage' etc.
}

export interface SwiggyContext {
    order_id: string;
    restaurant_name: string;
    restaurant_id?: string;
    restaurant_area?: string;
    items: FoodDeliveryItem[];
    delivery_fee: number;
    platform_fee?: number;
    tax: number;
    discount: number;
    delivery_address_label?: string; // 'Home' | 'Work'
    cuisine?: string[];
    rating_given?: number;
}

export interface ZomatoContext {
    order_id: string;
    restaurant_name: string;
    restaurant_id?: string;
    items: FoodDeliveryItem[];
    delivery_fee: number;
    packaging_fee?: number;
    tax: number;
    pro_discount?: number;
    delivery_address_label?: string;
    cuisine?: string[];
}

export interface ZeptoContext {
    order_id: string;
    items: FoodDeliveryItem[];
    delivery_time_minutes?: number;
    platform_fee?: number;
    tax: number;
    discount: number;
    delivery_address_label?: string;
}

export interface BlinkitContext {
    order_id: string;
    items: FoodDeliveryItem[];
    delivery_time_minutes?: number;
    platform_fee?: number;
    tax: number;
    discount: number;
}

export interface EcommerceItem {
    name: string;
    qty: number;
    price: number;
    category?: string;
    seller?: string;
    asin?: string; // Amazon specific
}

export interface AmazonContext {
    order_id: string;
    items: EcommerceItem[];
    shipping_fee: number;
    tax: number;
    discount: number;
    return_by?: string; // ISO date
    emi_months?: number;
}

export interface FlipkartContext {
    order_id: string;
    items: EcommerceItem[];
    shipping_fee: number;
    discount: number;
    return_by?: string;
}

export interface OlaUberContext {
    trip_id: string;
    pickup_location: string;
    drop_location: string;
    distance_km?: number;
    ride_type?: string; // 'Auto' | 'Mini' | 'Prime' | 'Moto'
    surge_applied?: boolean;
    surge_multiplier?: number;
    driver_rating?: number;
    toll_charges?: number;
}

export interface BookMyShowContext {
    booking_id: string;
    movie?: string;
    event?: string;
    cinema?: string;
    seats?: string[];
    show_time?: string; // ISO datetime
    screen_type?: string; // 'IMAX' | '4DX' | 'Standard'
    genre?: string[];
    convenience_fee: number;
}

export interface InsuranceContext {
    policy_no: string;
    plan_name: string;
    insurer: string;
    coverage_type?: string; // 'term' | 'health' | 'vehicle' | 'life'
    receipt_no?: string;
    next_due_date?: string; // ISO date
    policy_term?: string;
}

export interface UtilityContext {
    biller: string; // 'BESCOM' | 'HP Gas' | 'Mahanagar Gas'
    consumer_no?: string;
    bill_month?: string;
    units_consumed?: number;
    due_date?: string;
    receipt_no?: string;
}

export interface EmiContext {
    loan_account: string;
    lender: string;
    loan_type?: string; // 'home' | 'car' | 'personal' | 'credit_card'
    emi_amount: number;
    principal_component?: number;
    interest_component?: number;
    outstanding_balance?: number;
    emi_number?: number; // e.g. EMI 14 of 60
    total_emis?: number;
}

export interface SubscriptionContext {
    service_name: string;
    plan_name?: string;
    billing_cycle: 'monthly' | 'quarterly' | 'annual';
    next_charge?: string; // ISO date
    screens?: number; // Netflix: how many screens
}

export interface CreditCardPaymentContext {
    card_name: string; // 'HDFC Regalia' | 'Axis Magnus'
    statement_amount: number;
    minimum_due?: number;
    cashback_earned?: number;
    reward_points?: number;
    upi_app?: UpiApp;
}

// Union of all possible context shapes
export interface TransactionContext {
    swiggy?: SwiggyContext;
    zomato?: ZomatoContext;
    zepto?: ZeptoContext;
    blinkit?: BlinkitContext;
    amazon?: AmazonContext;
    flipkart?: FlipkartContext;
    ola?: OlaUberContext;
    uber?: OlaUberContext;
    bookmyshow?: BookMyShowContext;
    insurance?: InsuranceContext;
    utility?: UtilityContext;
    emi?: EmiContext;
    subscription?: SubscriptionContext;
    credit_card_bill?: CreditCardPaymentContext;
    [key: string]: unknown; // forward-compat: new merchants without type changes
}
