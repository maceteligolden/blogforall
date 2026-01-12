# Subscription System Setup Guide

## ✅ Completed Components

### Backend

1. **Schemas & Entities:**
   - ✅ `plan.schema.ts` - Plan model with limits and features
   - ✅ `subscription.schema.ts` - Subscription model with status tracking
   - ✅ `card.schema.ts` - Payment method storage
   - ✅ Updated `user.schema.ts` - Added `stripe_customer_id`

2. **Repositories:**
   - ✅ `plan.repository.ts` - Plan CRUD operations
   - ✅ `subscription.repository.ts` - Subscription management
   - ✅ `card.repository.ts` - Payment method management

3. **Services:**
   - ✅ `subscription.service.ts` - Core subscription logic
   - ✅ `billing.service.ts` - Payment method management
   - ✅ `stripe.facade.ts` - Stripe API wrapper

4. **Controllers & Routes:**
   - ✅ Subscription endpoints: `/api/v1/subscriptions`
   - ✅ Billing endpoints: `/api/v1/billing`
   - ✅ Webhook endpoint: `/api/v1/webhooks/stripe`

5. **Webhooks:**
   - ✅ `billing.webhook.ts` - Handles Stripe events:
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

6. **Auth Integration:**
   - ✅ Stripe customer creation on user signup

7. **Scripts:**
   - ✅ `seed-plans.ts` - Creates initial plans (Free, Starter $5, Professional $10, Enterprise $20)

### Frontend

1. **API Services:**
   - ✅ `subscription.service.ts` - Subscription API client
   - ✅ `billing.service.ts` - Billing API client

2. **UI Components:**
   - ✅ `dashboard/subscription/page.tsx` - Subscription management
   - ✅ `dashboard/billing/page.tsx` - Payment method management

## 📋 Setup Instructions

### 1. Environment Variables

Add to your `.env` files:

```env
# Stripe Configuration
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2. Install Stripe Dependencies

```bash
# Frontend
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js

# Backend (if not already installed)
cd backend
npm install stripe
```

### 3. Seed Initial Plans

```bash
cd backend
npx ts-node scripts/seed-plans.ts
```

This will create:
- **Free Plan**: $0/month - 3 blog posts, 1,000 API calls/month, 0.5 GB storage
- **Starter Plan**: $5/month - 10 blog posts, 10,000 API calls/month, 1 GB storage
- **Professional Plan**: $10/month - 50 blog posts, 100,000 API calls/month, 10 GB storage
- **Enterprise Plan**: $20/month - Unlimited everything

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/v1/webhooks/stripe`
3. Select events:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 5. Update Frontend Billing Page

The billing page needs Stripe Elements integration. Install:
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Then update `frontend/app/dashboard/billing/page.tsx` to use Stripe Elements component.

## 🔄 Next Steps (Optional)

1. **Usage Tracking:**
   - Track API calls per user
   - Track blog post count
   - Enforce plan limits

2. **Enhanced Features:**
   - Invoice history
   - Payment method management UI improvements
   - Subscription upgrade/downgrade notifications
   - Usage dashboard

3. **Testing:**
   - Test subscription creation
   - Test plan changes
   - Test payment failures
   - Test webhook events

## 📝 API Endpoints

### Subscription Endpoints
- `GET /api/v1/subscriptions` - Get current subscription
- `GET /api/v1/subscriptions/plans` - Get all available plans
- `POST /api/v1/subscriptions/change-plan` - Change subscription plan
- `POST /api/v1/subscriptions/cancel` - Cancel subscription

### Billing Endpoints
- `POST /api/v1/billing/cards/initialize` - Initialize add card
- `POST /api/v1/billing/cards/confirm` - Confirm and save card
- `GET /api/v1/billing/cards` - Get all user cards
- `DELETE /api/v1/billing/cards/:id` - Delete a card
- `PUT /api/v1/billing/cards/:id/default` - Set default card

### Webhook Endpoint
- `POST /api/v1/webhooks/stripe` - Stripe webhook handler

## 🎯 Usage

1. Users sign up → Stripe customer created automatically
2. Users can add payment methods via billing page
3. Users can subscribe to plans via subscription page
4. Stripe webhooks handle subscription lifecycle events
5. System automatically manages subscription status
