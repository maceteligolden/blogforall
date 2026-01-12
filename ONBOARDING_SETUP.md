# Onboarding System Setup

## Overview

The onboarding system requires all users to:
1. **Add a payment card** (via Stripe)
2. **Select a paid plan** (Starter $5, Professional $10, or Enterprise $20)
3. Complete both steps before accessing the dashboard

## ✅ Completed Components

### Backend

1. **User Schema Update:**
   - ✅ Added `onboarding_completed` boolean field (default: false)

2. **Onboarding Module:**
   - ✅ `onboarding.service.ts` - Handles onboarding logic
   - ✅ `onboarding.controller.ts` - API endpoints
   - ✅ `onboarding.router.ts` - Routes at `/api/v1/onboarding`

3. **Onboarding Endpoints:**
   - `GET /api/v1/onboarding/status` - Check onboarding status
   - `POST /api/v1/onboarding/complete` - Complete onboarding (plan + card)

4. **Auth Integration:**
   - ✅ Stripe customer created on signup
   - ✅ Free subscription created on signup
   - ✅ Users start with `onboarding_completed: false`

5. **Subscription Service:**
   - ✅ Updated to handle initial plan selection (from free to paid)

### Frontend

1. **Onboarding Page:**
   - ✅ `/onboarding` - Two-step flow:
     - Step 1: Select a paid plan
     - Step 2: Add payment card using Stripe Elements
   - ✅ Protected route (requires authentication)
   - ✅ Auto-redirects to dashboard if already completed

2. **Dashboard Protection:**
   - ✅ Dashboard layout checks onboarding status
   - ✅ Redirects to `/onboarding` if not completed
   - ✅ Blocks access until onboarding is complete

3. **Auth Flow:**
   - ✅ Login checks onboarding status and redirects accordingly
   - ✅ Signup redirects to login, then onboarding

4. **API Service:**
   - ✅ `onboarding.service.ts` - Frontend API client

## 🔄 User Flow

1. **User Signs Up:**
   - Account created
   - Stripe customer created
   - Free subscription created
   - `onboarding_completed: false`

2. **User Logs In:**
   - System checks onboarding status
   - If not completed → Redirect to `/onboarding`
   - If completed → Redirect to `/dashboard`

3. **Onboarding Process:**
   - User selects a paid plan (Starter, Professional, or Enterprise)
   - User adds payment card via Stripe Elements
   - System:
     - Saves payment method
     - Sets as default
     - Subscribes to selected plan
     - Marks `onboarding_completed: true`
   - User redirected to dashboard

4. **Dashboard Access:**
   - Layout checks onboarding status on every load
   - If not completed → Redirect to onboarding
   - If completed → Show dashboard

## 📝 API Endpoints

### Onboarding
- `GET /api/v1/onboarding/status` - Get onboarding status
  - Returns: `{ requiresOnboarding: boolean, hasCard: boolean, hasPlan: boolean }`

- `POST /api/v1/onboarding/complete` - Complete onboarding
  - Body: `{ planId: string, paymentMethodId: string }`
  - Creates subscription and marks onboarding as complete

## 🔒 Security

- Onboarding page is protected (requires authentication)
- Dashboard access is blocked until onboarding is complete
- Payment processing handled securely by Stripe
- Card details never stored on our servers

## 📦 Required Packages

The following packages are already added to `package.json`:
- `@stripe/stripe-js` - Stripe JavaScript SDK
- `@stripe/react-stripe-js` - React components for Stripe

Install with:
```bash
cd frontend
npm install
```

## 🎯 Environment Variables

Make sure these are set:
```env
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 🚀 Testing the Flow

1. Sign up a new user
2. User should be redirected to `/onboarding`
3. Select a plan → Payment form appears
4. Add card details → Complete onboarding
5. User redirected to dashboard
6. Dashboard should be accessible

## ⚠️ Important Notes

- Users **cannot** access the dashboard until onboarding is complete
- Only **paid plans** are shown during onboarding (no free plan option)
- The onboarding check happens in the dashboard layout on every page load
- If a user somehow bypasses onboarding, they'll be redirected on next dashboard access
