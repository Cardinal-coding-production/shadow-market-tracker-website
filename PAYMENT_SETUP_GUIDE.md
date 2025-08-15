# 🔧 Payment Setup Guide - Fix Refund Issue

## 🚨 Why Payments Were Getting Refunded

Your payments were automatically refunded because:
1. **No Order Creation**: Live Razorpay requires server-side order creation
2. **No Payment Verification**: Razorpay couldn't verify payment completion
3. **Missing Backend**: Frontend-only integration causes auto-refunds

## ✅ Solution Implemented

I've added proper backend integration with:
- **Order Creation API**: `/api/create-order.js`
- **Payment Verification API**: `/api/verify-payment.js`
- **Updated Frontend**: Proper order flow

## 🔑 Required: Set Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Click on your `shadow-market-tracker-website` project
3. Go to **Settings** tab
4. Click **Environment Variables**

### Step 2: Add These Variables
Add these exact environment variables:

```
RAZORPAY_KEY_ID = rzp_live_R5bUcfPrk6LOKC
RAZORPAY_KEY_SECRET = 60FxdU1hJh11gi2EuRDdfeAY
```

**Important:** 
- Variable names must be EXACT
- No quotes around values
- Apply to: Production, Preview, Development

### Step 3: Redeploy
After adding environment variables:
1. Go to **Deployments** tab
2. Click **Redeploy** on latest deployment
3. Wait for deployment to complete

## 🧪 Testing Options

### Option A: Test Mode (Recommended First)
- Current setup uses `rzp_test_` key
- Use test cards: 4111 1111 1111 1111
- No real money involved
- Perfect for testing the flow

### Option B: Live Mode
After testing works:
1. Change `rzp_test_` to `rzp_live_` in index.html
2. Real payments will work without refunds

## 🔍 How to Verify It's Working

### Test Payment Flow:
1. Go to your website
2. Click any payment button
3. **Before**: Payment → Immediate refund
4. **After**: Payment → Success page → Money stays

### Check Razorpay Dashboard:
- **Before**: Payment shows as "Refunded"
- **After**: Payment shows as "Captured" or "Settled"

## 📞 If Issues Persist

Contact me with:
1. Screenshot of Vercel environment variables
2. Screenshot of payment attempt
3. Any error messages in browser console

## 🎯 Expected Result

After setup:
- ✅ No more automatic refunds
- ✅ Payments get captured properly
- ✅ Money stays in your account
- ✅ Proper order tracking
- ✅ Payment verification

Your payment system will be production-ready! 🚀
