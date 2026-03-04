# Razorpay UPI Autopay & Subscription Integration

This document covers the complete workflow for integrating Razorpay Subscriptions with UPI Autopay in our product.

---

## Table of Contents

1. [Overview](#overview)
2. [UPI Autopay Features](#upi-autopay-features)
3. [API Configuration](#api-configuration)
4. [Core Concepts](#core-concepts)
5. [API Endpoints](#api-endpoints)
6. [Subscription States](#subscription-states)
7. [Webhook Events](#webhook-events)
8. [React Native Integration](#react-native-integration)
9. [Implementation Workflow](#implementation-workflow)
10. [Testing](#testing)
11. [Error Handling](#error-handling)

---

## Overview

Razorpay Subscriptions provides a unified API for recurring payments supporting:

- **UPI AutoPay** - Cardless recurring payments via UPI apps
- **Card e-Mandates** - Card-based recurring payments
- **eNACH / Physical NACH** - Bank account mandates

**Key Advantage**: Single integration handles all recurring payment methods.

---

## UPI Autopay Features

| Feature                    | Details                                              |
| -------------------------- | ---------------------------------------------------- |
| **Max Transaction Limit**  | ₹5,000 per debit (RBI mandate)                       |
| **Mandate Frequencies**    | Daily, Weekly, Monthly, Quarterly, Yearly, As-needed |
| **Supported Account Types**| Savings, Current, Overdraft                          |
| **Supported UPI Apps**     | PhonePe, Google Pay, Paytm, BHIM, Amazon Pay         |
| **Mandate Confirmation**   | Real-time (instant)                                  |
| **Pre-debit Notification** | 24 hours before debit (automated by Razorpay)        |

### UPI Autopay Customer Flow

```
1. Customer selects subscription plan
2. Redirected to Razorpay checkout / UPI app
3. Customer selects UPI app and enters PIN
4. Mandate created instantly
5. Subscription becomes active
6. Auto-debits occur per billing cycle
```

---

## API Configuration

### Base URL

```
https://api.razorpay.com/v1
```

### Authentication

HTTP Basic Auth with API credentials:

```
Authorization: Basic base64(key_id:key_secret)
```

### Environment Variables

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

### SDK Installation (Node.js)

```bash
pnpm add razorpay
```

```typescript
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
```

---

## Core Concepts

### Plan

A **Plan** defines the billing configuration:

- Billing period (daily, weekly, monthly, yearly)
- Billing interval (e.g., every 2 months)
- Amount to charge
- Currency

Plans are reusable - create once, use for many subscriptions.

### Subscription

A **Subscription** links a customer to a plan:

- References a plan_id
- Has a total billing cycle count
- Tracks current state (created, active, etc.)
- Generates invoices automatically

### Invoice

An **Invoice** is generated for each billing cycle:

- Contains the amount due
- Tracks payment status
- Links to the payment entity once paid

### Mandate (UPI Autopay)

A **Mandate** is the customer's authorization for recurring debits:

- Created during authentication
- Stored by the customer's UPI app
- Customer can pause/cancel from their UPI app

---

## API Endpoints

### Plans API

#### Create a Plan

Creates a reusable billing plan.

**Request**

```
POST /plans
```

**Parameters**

| Param              | Type    | Required | Description                                       |
| ------------------ | ------- | -------- | ------------------------------------------------- |
| `period`           | string  | Yes      | `daily`, `weekly`, `monthly`, `yearly`            |
| `interval`         | integer | Yes      | Billing interval (min 7 for daily)                |
| `item.name`        | string  | Yes      | Plan name                                         |
| `item.amount`      | integer | Yes      | Amount in paise (99900 = ₹999)                    |
| `item.currency`    | string  | Yes      | `INR`                                             |
| `item.description` | string  | No       | Plan description                                  |
| `notes`            | object  | No       | Key-value metadata (max 15 pairs)                 |

**Example Request**

```bash
curl -u $RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET \
  -X POST https://api.razorpay.com/v1/plans \
  -H "Content-Type: application/json" \
  -d '{
    "period": "monthly",
    "interval": 1,
    "item": {
      "name": "Premium Monthly",
      "amount": 99900,
      "currency": "INR",
      "description": "Premium subscription - monthly billing"
    },
    "notes": {
      "plan_type": "premium",
      "features": "all_access"
    }
  }'
```

**Response** `200 OK`

```json
{
  "id": "plan_JlHBKvZKh3tPzN",
  "entity": "plan",
  "interval": 1,
  "period": "monthly",
  "item": {
    "id": "item_JlHBKvZKh3tPzO",
    "active": true,
    "name": "Premium Monthly",
    "description": "Premium subscription - monthly billing",
    "amount": 99900,
    "unit_amount": 99900,
    "currency": "INR",
    "type": "plan",
    "unit": null,
    "tax_inclusive": false,
    "hsn_code": null,
    "sac_code": null,
    "tax_rate": null,
    "tax_id": null,
    "tax_group_id": null,
    "created_at": 1656597363
  },
  "notes": {
    "plan_type": "premium",
    "features": "all_access"
  },
  "created_at": 1656597363
}
```

**Important Notes**

- Plans cannot be edited or deleted once created
- For daily plans, minimum interval is 7
- Store `plan_id` in your database for subscription creation

---

#### Fetch All Plans

```
GET /plans
```

**Query Parameters**

| Param   | Type    | Description                    |
| ------- | ------- | ------------------------------ |
| `count` | integer | Number of plans (default: 10)  |
| `skip`  | integer | Number of plans to skip        |
| `from`  | integer | Unix timestamp (start)         |
| `to`    | integer | Unix timestamp (end)           |

---

#### Fetch a Plan

```
GET /plans/{plan_id}
```

---

### Subscriptions API

#### Create a Subscription

Creates a subscription for a customer.

**Request**

```
POST /subscriptions
```

**Parameters**

| Param             | Type    | Required | Description                                           |
| ----------------- | ------- | -------- | ----------------------------------------------------- |
| `plan_id`         | string  | Yes      | Plan ID (e.g., `plan_xxx`)                            |
| `total_count`     | integer | Yes      | Total billing cycles                                  |
| `quantity`        | integer | No       | Units per invoice (default: 1)                        |
| `start_at`        | integer | No       | Unix timestamp to start (immediate if omitted)        |
| `expire_by`       | integer | No       | Expiry timestamp for auth link                        |
| `customer_notify` | boolean | No       | Razorpay sends notifications (default: true)          |
| `offer_id`        | string  | No       | Offer to apply                                        |
| `addons`          | array   | No       | Upfront/one-time charges                              |
| `notes`           | object  | No       | Metadata (max 15 pairs)                               |

**Example Request**

```bash
curl -u $RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET \
  -X POST https://api.razorpay.com/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "plan_JlHBKvZKh3tPzN",
    "total_count": 12,
    "quantity": 1,
    "customer_notify": true,
    "notes": {
      "user_id": "user_abc123",
      "plan_name": "premium"
    },
    "addons": [
      {
        "item": {
          "name": "Setup Fee",
          "amount": 10000,
          "currency": "INR"
        }
      }
    ]
  }'
```

**Response** `200 OK`

```json
{
  "id": "sub_JlHCJhdjfbdjJD",
  "entity": "subscription",
  "plan_id": "plan_JlHBKvZKh3tPzN",
  "status": "created",
  "current_start": null,
  "current_end": null,
  "ended_at": null,
  "quantity": 1,
  "notes": {
    "user_id": "user_abc123",
    "plan_name": "premium"
  },
  "charge_at": null,
  "offer_id": null,
  "short_url": "https://rzp.io/i/abcdefgh",
  "has_scheduled_changes": false,
  "change_scheduled_at": null,
  "source": "api",
  "payment_method": "upi",
  "created_at": 1656597963,
  "expire_by": null,
  "customer_notify": 1,
  "total_count": 12,
  "paid_count": 0,
  "remaining_count": 12
}
```

**Key Response Fields**

| Field             | Description                                        |
| ----------------- | -------------------------------------------------- |
| `id`              | Subscription ID (store this)                       |
| `status`          | Current state                                      |
| `short_url`       | Payment link for customer authentication           |
| `current_start`   | Current billing cycle start                        |
| `current_end`     | Current billing cycle end                          |
| `paid_count`      | Number of successful charges                       |
| `remaining_count` | Remaining billing cycles                           |

---

#### Create a Subscription Link

Creates a hosted page for subscription signup.

```
POST /subscription_links
```

**Additional Parameters**

| Param                     | Type   | Required | Description               |
| ------------------------- | ------ | -------- | ------------------------- |
| `subscription.plan_id`    | string | Yes      | Plan ID                   |
| `subscription.total_count`| integer| Yes      | Total billing cycles      |
| `customer.name`           | string | No       | Customer name             |
| `customer.email`          | string | No       | Customer email            |
| `customer.contact`        | string | No       | Customer phone            |

---

#### Fetch All Subscriptions

```
GET /subscriptions
```

**Query Parameters**

| Param     | Type    | Description                           |
| --------- | ------- | ------------------------------------- |
| `plan_id` | string  | Filter by plan                        |
| `count`   | integer | Number to fetch (default: 10)         |
| `skip`    | integer | Pagination offset                     |
| `from`    | integer | Unix timestamp (start)                |
| `to`      | integer | Unix timestamp (end)                  |

---

#### Fetch a Subscription

```
GET /subscriptions/{subscription_id}
```

---

#### Update a Subscription

Updates plan, quantity, or other parameters. Only works for `authenticated` or `active` subscriptions.

```
PATCH /subscriptions/{subscription_id}
```

**Parameters**

| Param             | Type    | Description                      |
| ----------------- | ------- | -------------------------------- |
| `plan_id`         | string  | New plan ID (upgrade/downgrade)  |
| `quantity`        | integer | New quantity                     |
| `remaining_count` | integer | Update remaining cycles          |
| `offer_id`        | string  | Apply new offer                  |
| `schedule_change_at` | string | `now` or `cycle_end`          |

---

#### Cancel a Subscription

```
POST /subscriptions/{subscription_id}/cancel
```

**Parameters**

| Param               | Type    | Description                              |
| ------------------- | ------- | ---------------------------------------- |
| `cancel_at_cycle_end` | boolean | Cancel at end of current cycle (true) or immediately (false) |

---

#### Pause a Subscription

```
POST /subscriptions/{subscription_id}/pause
```

**Parameters**

| Param      | Type   | Description                    |
| ---------- | ------ | ------------------------------ |
| `pause_at` | string | `now` (immediate pause)        |

---

#### Resume a Subscription

```
POST /subscriptions/{subscription_id}/resume
```

**Parameters**

| Param       | Type   | Description                    |
| ----------- | ------ | ------------------------------ |
| `resume_at` | string | `now` (immediate resume)       |

---

#### Fetch Subscription Invoices

```
GET /subscriptions/{subscription_id}/invoices
```

---

## Subscription States

| State           | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `created`       | Subscription created, awaiting customer authentication     |
| `authenticated` | Customer completed auth, waiting for start_at              |
| `active`        | Billing cycle started, payments being charged              |
| `pending`       | Payment failed, retrying                                   |
| `halted`        | All retry attempts exhausted                               |
| `paused`        | Temporarily paused by merchant                             |
| `cancelled`     | Terminated (by merchant or customer)                       |
| `completed`     | All billing cycles finished successfully                   |
| `expired`       | Authentication window expired                              |

### State Transition Diagram

```
                    ┌──────────────┐
                    │   created    │
                    └──────┬───────┘
                           │ customer authenticates
                           ▼
                    ┌──────────────┐
            ┌───────│ authenticated│───────┐
            │       └──────┬───────┘       │
            │              │ start_at      │ expires
            │              ▼               ▼
            │       ┌──────────────┐  ┌─────────┐
            │       │    active    │  │ expired │
            │       └──────┬───────┘  └─────────┘
            │              │
      ┌─────┴─────┬────────┼────────┬───────────┐
      │           │        │        │           │
      ▼           ▼        ▼        ▼           ▼
┌─────────┐ ┌─────────┐ ┌───────┐ ┌─────────┐ ┌───────────┐
│ paused  │ │ pending │ │halted │ │cancelled│ │ completed │
└────┬────┘ └────┬────┘ └───┬───┘ └─────────┘ └───────────┘
     │           │          │
     │ resume    │ payment  │ reactivate
     │           │ succeeds │
     └───────────┴──────────┘
            │
            ▼
      ┌──────────┐
      │  active  │
      └──────────┘
```

### State-Specific Behaviors

| State           | Invoices Generated | Auto-charge Attempted | Can Update |
| --------------- | ------------------ | --------------------- | ---------- |
| `created`       | No                 | No                    | No         |
| `authenticated` | No                 | No                    | Yes        |
| `active`        | Yes                | Yes                   | Yes        |
| `pending`       | Yes                | Yes (retries)         | No         |
| `halted`        | Yes                | No                    | No         |
| `paused`        | No                 | No                    | No         |
| `cancelled`     | No                 | No                    | No         |
| `completed`     | No                 | No                    | No         |

---

## Webhook Events

### Setup Webhook Endpoint

Configure webhook URL in Razorpay Dashboard → Settings → Webhooks

### Subscription Events

| Event                        | Trigger                               |
| ---------------------------- | ------------------------------------- |
| `subscription.authenticated` | Customer completed authentication     |
| `subscription.activated`     | Subscription became active            |
| `subscription.charged`       | Payment successful                    |
| `subscription.pending`       | Payment failed, retrying              |
| `subscription.halted`        | All retries exhausted                 |
| `subscription.cancelled`     | Subscription cancelled                |
| `subscription.completed`     | All cycles completed                  |
| `subscription.paused`        | Subscription paused                   |
| `subscription.resumed`       | Subscription resumed                  |
| `subscription.updated`       | Subscription updated                  |

### Webhook Payload Structure

```json
{
  "entity": "event",
  "account_id": "acc_xxxxxxxxxx",
  "event": "subscription.charged",
  "contains": ["subscription", "payment"],
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_JlHCJhdjfbdjJD",
        "entity": "subscription",
        "plan_id": "plan_JlHBKvZKh3tPzN",
        "status": "active",
        "current_start": 1656597963,
        "current_end": 1659276363,
        "ended_at": null,
        "quantity": 1,
        "notes": {
          "user_id": "user_abc123"
        },
        "charge_at": 1659276363,
        "offer_id": null,
        "short_url": "https://rzp.io/i/abcdefgh",
        "has_scheduled_changes": false,
        "change_scheduled_at": null,
        "source": "api",
        "payment_method": "upi",
        "created_at": 1656597963,
        "total_count": 12,
        "paid_count": 1,
        "remaining_count": 11,
        "customer_id": "cust_xxxxxxxxxx"
      }
    },
    "payment": {
      "entity": {
        "id": "pay_xxxxxxxxxx",
        "entity": "payment",
        "amount": 99900,
        "currency": "INR",
        "status": "captured",
        "method": "upi",
        "description": "Subscription payment",
        "order_id": null,
        "invoice_id": "inv_xxxxxxxxxx",
        "international": false,
        "refund_status": null,
        "captured": true,
        "email": "customer@example.com",
        "contact": "+919876543210",
        "customer_id": "cust_xxxxxxxxxx",
        "notes": [],
        "fee": 2357,
        "tax": 360,
        "error_code": null,
        "error_description": null,
        "created_at": 1656597963
      }
    }
  },
  "created_at": 1656597963
}
```

### Webhook Signature Verification

```typescript
import crypto from "crypto";

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in webhook handler
app.post("/api/webhooks/razorpay", (req, res) => {
  const signature = req.headers["x-razorpay-signature"] as string;
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Process webhook
  const { event, payload } = req.body;
  // ...
});
```

---

## React Native Integration

### Install Razorpay SDK

```bash
npm install react-native-razorpay
# or
yarn add react-native-razorpay
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

Add to `android/app/build.gradle`:

```gradle
dependencies {
    implementation 'com.razorpay:checkout:1.6.33'
}
```

### Subscription Flow in React Native

```typescript
import RazorpayCheckout from "react-native-razorpay";

interface SubscriptionResponse {
  subscriptionId: string;
  shortUrl: string;
  planId: string;
}

// Step 1: Create subscription via your backend
async function createSubscription(planId: string): Promise<SubscriptionResponse> {
  const response = await fetch("/api/subscriptions/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ planId }),
  });
  return response.json();
}

// Step 2: Open Razorpay checkout for authentication
async function authenticateSubscription(subscriptionId: string) {
  const options = {
    key: RAZORPAY_KEY_ID, // Your Razorpay Key ID
    subscription_id: subscriptionId,
    name: "Your App Name",
    description: "Subscription Payment",
    image: "https://yourapp.com/logo.png",
    prefill: {
      name: user.name,
      email: user.email,
      contact: user.phone,
    },
    theme: {
      color: "#3399cc",
    },
    // For UPI Autopay, these are auto-handled
  };

  try {
    const data = await RazorpayCheckout.open(options);
    // Payment successful
    console.log("Payment ID:", data.razorpay_payment_id);
    console.log("Subscription ID:", data.razorpay_subscription_id);
    console.log("Signature:", data.razorpay_signature);

    // Verify on backend
    await verifySubscription({
      paymentId: data.razorpay_payment_id,
      subscriptionId: data.razorpay_subscription_id,
      signature: data.razorpay_signature,
    });

    // Navigate to success screen
    navigation.navigate("SubscriptionSuccess");
  } catch (error) {
    // Payment failed or cancelled
    console.log("Payment Error:", error.code, error.description);
    Alert.alert("Payment Failed", error.description);
  }
}

// Step 3: Verify subscription on backend
async function verifySubscription(data: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}) {
  const response = await fetch("/api/subscriptions/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}
```

### Complete React Native Component Example

```tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import RazorpayCheckout from "react-native-razorpay";

interface Plan {
  id: string;
  name: string;
  amount: number;
  period: string;
}

interface SubscriptionScreenProps {
  plans: Plan[];
  user: { name: string; email: string; phone: string };
}

export function SubscriptionScreen({ plans, user }: SubscriptionScreenProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const handleSubscribe = async (plan: Plan) => {
    setLoading(true);
    setSelectedPlan(plan);

    try {
      // 1. Create subscription on backend
      const response = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const { subscriptionId } = await response.json();

      // 2. Open Razorpay checkout
      const options = {
        key: "rzp_test_xxxxxxxxxxxxx",
        subscription_id: subscriptionId,
        name: "Your App",
        description: `${plan.name} Subscription`,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone,
        },
        theme: { color: "#6366f1" },
      };

      const data = await RazorpayCheckout.open(options);

      // 3. Verify on backend
      await fetch("/api/subscriptions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_subscription_id: data.razorpay_subscription_id,
          razorpay_signature: data.razorpay_signature,
        }),
      });

      Alert.alert("Success!", "Your subscription is now active.");
    } catch (error: any) {
      Alert.alert(
        "Payment Failed",
        error.description || "Something went wrong"
      );
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a Plan</Text>
      {plans.map((plan) => (
        <TouchableOpacity
          key={plan.id}
          style={styles.planCard}
          onPress={() => handleSubscribe(plan)}
          disabled={loading}
        >
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>
            ₹{plan.amount / 100}/{plan.period}
          </Text>
          {loading && selectedPlan?.id === plan.id && (
            <ActivityIndicator color="#fff" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  planCard: {
    backgroundColor: "#6366f1",
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  planName: { color: "#fff", fontSize: 18, fontWeight: "600" },
  planPrice: { color: "#e0e7ff", fontSize: 14, marginTop: 4 },
});
```

---

## Implementation Workflow

### Backend Implementation Steps

#### 1. Database Schema

```typescript
// Subscription Plan (mirrors Razorpay plan)
interface SubscriptionPlan {
  _id: string;
  razorpayPlanId: string;  // plan_xxx from Razorpay
  name: string;
  description: string;
  amount: number;          // in paise
  currency: string;
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User Subscription
interface UserSubscription {
  _id: string;
  userId: string;
  planId: string;                      // reference to SubscriptionPlan
  razorpaySubscriptionId: string;      // sub_xxx from Razorpay
  razorpayCustomerId?: string;         // cust_xxx from Razorpay
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  endedAt?: Date;
  totalCount: number;
  paidCount: number;
  remainingCount: number;
  notes?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "paused"
  | "cancelled"
  | "completed"
  | "expired";

// Payment History
interface SubscriptionPayment {
  _id: string;
  subscriptionId: string;
  razorpayPaymentId: string;
  razorpayInvoiceId?: string;
  amount: number;
  currency: string;
  status: "captured" | "failed" | "refunded";
  method: string;                      // "upi", "card", etc.
  paidAt: Date;
  createdAt: Date;
}
```

#### 2. API Endpoints (Server)

```typescript
// POST /api/subscriptions/plans - Create a plan (admin only)
// GET  /api/subscriptions/plans - List available plans
// POST /api/subscriptions/create - Create subscription for user
// POST /api/subscriptions/verify - Verify payment signature
// GET  /api/subscriptions/current - Get user's active subscription
// POST /api/subscriptions/cancel - Cancel subscription
// POST /api/subscriptions/pause - Pause subscription
// POST /api/subscriptions/resume - Resume subscription
// POST /api/webhooks/razorpay - Handle Razorpay webhooks
```

#### 3. Service Implementation

```typescript
// subscription.service.ts

import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export class SubscriptionService {
  // Create a plan in Razorpay
  async createPlan(data: {
    name: string;
    amount: number;
    period: string;
    interval: number;
    description?: string;
  }) {
    const razorpayPlan = await razorpay.plans.create({
      period: data.period,
      interval: data.interval,
      item: {
        name: data.name,
        amount: data.amount,
        currency: "INR",
        description: data.description,
      },
    });

    // Save to database
    const plan = await SubscriptionPlanModel.create({
      razorpayPlanId: razorpayPlan.id,
      name: data.name,
      amount: data.amount,
      period: data.period,
      interval: data.interval,
      description: data.description,
      isActive: true,
    });

    return plan;
  }

  // Create subscription for user
  async createSubscription(userId: string, planId: string) {
    const plan = await SubscriptionPlanModel.findById(planId);
    if (!plan) throw new Error("Plan not found");

    // Check for existing active subscription
    const existing = await UserSubscriptionModel.findOne({
      userId,
      status: { $in: ["active", "authenticated", "pending"] },
    });
    if (existing) throw new Error("User already has an active subscription");

    // Create in Razorpay
    const razorpaySub = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: 12, // 12 billing cycles
      customer_notify: 1,
      notes: {
        user_id: userId,
        plan_id: planId,
      },
    });

    // Save to database
    const subscription = await UserSubscriptionModel.create({
      userId,
      planId,
      razorpaySubscriptionId: razorpaySub.id,
      status: "created",
      totalCount: razorpaySub.total_count,
      paidCount: 0,
      remainingCount: razorpaySub.total_count,
    });

    return {
      subscriptionId: subscription._id,
      razorpaySubscriptionId: razorpaySub.id,
      shortUrl: razorpaySub.short_url,
    };
  }

  // Verify payment signature
  verifyPaymentSignature(data: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }): boolean {
    const body = data.razorpay_payment_id + "|" + data.razorpay_subscription_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    return expectedSignature === data.razorpay_signature;
  }

  // Handle webhook events
  async handleWebhook(event: string, payload: any) {
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;

    switch (event) {
      case "subscription.authenticated":
        await this.handleAuthenticated(subscription);
        break;
      case "subscription.activated":
        await this.handleActivated(subscription);
        break;
      case "subscription.charged":
        await this.handleCharged(subscription, payment);
        break;
      case "subscription.pending":
        await this.handlePending(subscription);
        break;
      case "subscription.halted":
        await this.handleHalted(subscription);
        break;
      case "subscription.cancelled":
        await this.handleCancelled(subscription);
        break;
      case "subscription.completed":
        await this.handleCompleted(subscription);
        break;
    }
  }

  private async handleCharged(subscription: any, payment: any) {
    // Update subscription status
    await UserSubscriptionModel.findOneAndUpdate(
      { razorpaySubscriptionId: subscription.id },
      {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_start * 1000),
        currentPeriodEnd: new Date(subscription.current_end * 1000),
        paidCount: subscription.paid_count,
        remainingCount: subscription.remaining_count,
      }
    );

    // Record payment
    await SubscriptionPaymentModel.create({
      subscriptionId: subscription.id,
      razorpayPaymentId: payment.id,
      razorpayInvoiceId: payment.invoice_id,
      amount: payment.amount,
      currency: payment.currency,
      status: "captured",
      method: payment.method,
      paidAt: new Date(payment.created_at * 1000),
    });

    // Grant user access / update entitlements
    const userSub = await UserSubscriptionModel.findOne({
      razorpaySubscriptionId: subscription.id,
    });
    if (userSub) {
      await this.grantAccess(userSub.userId);
    }
  }

  // ... implement other handlers
}
```

---

## Testing

### Test Mode

Use test API keys from Razorpay Dashboard (Settings → API Keys).

Test key format: `rzp_test_xxxxxxxxxxxxx`

### Test Cards

| Card Number         | Description           |
| ------------------- | --------------------- |
| 4111 1111 1111 1111 | Successful payment    |
| 4000 0000 0000 0002 | Card declined         |

### Test UPI

| VPA              | Description        |
| ---------------- | ------------------ |
| success@razorpay | Successful payment |
| failure@razorpay | Failed payment     |

### Test Subscription Flow

1. Create plan with test credentials
2. Create subscription
3. Open checkout with test card/UPI
4. Verify webhook delivery in Dashboard
5. Trigger test charges from Dashboard

### Dashboard Test Features

- **Trigger Test Charge**: Force a billing cycle charge
- **View Webhooks**: See all webhook deliveries
- **Subscription Timeline**: View state transitions

---

## Error Handling

### Common Error Codes

| Code                          | Description                       |
| ----------------------------- | --------------------------------- |
| `BAD_REQUEST_ERROR`           | Invalid parameters                |
| `GATEWAY_ERROR`               | Payment gateway issue             |
| `SERVER_ERROR`                | Razorpay server error             |
| `SUBSCRIPTION_NOT_FOUND`      | Invalid subscription ID           |
| `PLAN_NOT_FOUND`              | Invalid plan ID                   |
| `SUBSCRIPTION_UPDATE_FAILED`  | Cannot update in current state    |

### Retry Logic for Failed Payments

Razorpay automatically retries failed payments:

1. **Retry Schedule**: Configurable in Dashboard
2. **Max Retries**: Default 3 attempts
3. **Retry Interval**: Typically 1, 3, 5 days
4. **State Flow**: `active` → `pending` → `halted` (if all fail)

### Handling Halted Subscriptions

```typescript
async function handleHaltedSubscription(userId: string) {
  // Notify user
  await sendEmail(userId, "subscription_halted", {
    message: "Your payment failed. Please update your payment method.",
  });

  // Optionally suspend access
  await suspendUserAccess(userId);

  // Provide reactivation link
  const subscription = await getSubscription(userId);
  return {
    status: "halted",
    reactivationUrl: subscription.shortUrl,
  };
}
```

---

## Best Practices

1. **Always verify webhook signatures** - Prevent fraudulent webhook calls
2. **Store subscription state locally** - Don't rely solely on Razorpay API calls
3. **Implement idempotency** - Handle duplicate webhook deliveries
4. **Use notes field** - Store user_id and internal references
5. **Handle state transitions gracefully** - Update UI based on subscription status
6. **Pre-debit notifications** - UPI Autopay sends these automatically
7. **Test thoroughly** - Use test mode before going live
8. **Monitor webhooks** - Set up alerts for failed webhook deliveries

---

## References

- [Razorpay Subscriptions Documentation](https://razorpay.com/docs/payments/subscriptions/)
- [Razorpay API Reference](https://razorpay.com/docs/api/payments/subscriptions/)
- [UPI AutoPay Overview](https://razorpay.com/upi-autopay/)
- [Webhook Events](https://razorpay.com/docs/webhooks/payloads/subscriptions/)
- [React Native SDK](https://razorpay.com/docs/payments/payment-gateway/web-integration/react-native/)
- [Subscription States](https://razorpay.com/docs/payments/subscriptions/states/)
