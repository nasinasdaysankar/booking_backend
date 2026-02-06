# Cashfree Split Payment - Setup Guide

## 🎯 Overview

This guide will help you set up and deploy the Cashfree split payment feature that automatically separates ₹1 platform commission from vendor payments.

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ Cashfree account with "Vendor Split" or "Easy Split" feature enabled
2. ✅ Access to your Railway database
3. ✅ Google Cloud Platform account (for Cloud Function)
4. ✅ Cafeteria bank account details ready

---

## 🚀 Step-by-Step Setup

### Step 1: Run Database Migrations

Execute the migration script to create necessary tables:

```bash
# Navigate to backend directory
cd /Users/nasinaudaysankar/booking_backend-5

# Connect to your Railway database and run migration
# Option A: Using psql
psql -h <your-railway-host> -U <username> -d <database> -f migrations/001_add_vendor_split_tables.sql

# Option B: Copy and paste SQL directly in Railway's database console
```

**Verify migration:**
```sql
SELECT * FROM vendors;
SELECT column_name FROM information_schema.columns WHERE table_name = 'commissions';
```

---

### Step 2: Update Environment Variables

Add Cashfree credentials to your Railway environment:

```bash
# In Railway dashboard, add these environment variables:
CASHFREE_SANDBOX_CLIENT_ID=your_sandbox_client_id
CASHFREE_SANDBOX_CLIENT_SECRET=your_sandbox_secret
CASHFREE_ENV=sandbox

# For production (later):
CASHFREE_PRODUCTION_CLIENT_ID=your_production_client_id
CASHFREE_PRODUCTION_CLIENT_SECRET=your_production_secret
CASHFREE_ENV=production
```

---

### Step 3: Deploy Updated Cloud Function

```bash
# Navigate to cloud function directory
cd cloud-functions/createCashfreeOrder

# Install dependencies
npm install

# Deploy to Google Cloud
gcloud functions deploy createCashfreeOrder \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1 \
  --set-env-vars DB_NAME=<your_db>,DB_USER=<user>,DB_PASSWORD=<pass>,DB_HOST=<host>,DB_PORT=5432,CASHFREE_SANDBOX_CLIENT_ID=<id>,CASHFREE_SANDBOX_CLIENT_SECRET=<secret>

# Note the deployed URL and update it in your Flutter app
```

---

### Step 4: Register Your Cafeteria as Vendor

Use the API to register your cafeteria with Cashfree:

```bash
POST https://your-backend-url.com/api/vendors/register
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "cafeteriaId": 1,
  "vendorName": "Alliance Cafeteria",
  "vendorEmail": "admin@cafeteria.com",
  "vendorPhone": "9876543210",
  "accountHolderName": "CAFETERIA OWNER NAME",
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234",
  "bankName": "State Bank of India"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vendor registered successfully with Cashfree",
  "vendor": {
    "id": 1,
    "cafeteriaId": 1,
    "vendorId": "VENDOR_1",
    "cashfreeVendorId": "VENDOR_1",
    "status": "ACTIVE"
  }
}
```

---

### Step 5: Restart Your Backend

```bash
# In Railway, trigger a redeploy or restart your service
# This ensures new models and routes are loaded
```

---

### Step 6: Test the Split Payment Flow

**Test Order Creation:**

1. **Create a test order** from your Flutter app
2. **Check the logs** in Railway to see split configuration:
   ```
   💰 Split configuration: {
     vendorAmount: '99.00',
     platformCommission: '1.00',
     vendorId: 'VENDOR_1'
   }
   ```

3. **Verify in Cashfree Dashboard:**
   - Go to Cashfree Sandbox Dashboard
   - Check Orders → Your Order ID
   - Verify "Order Splits" section shows the split

4. **Check Database:**
   ```sql
   SELECT * FROM commissions WHERE "orderId" = <your_order_id>;
   -- Should show:
   -- amount: 1.00 (platform)
   -- vendorAmount: 99.00
   -- totalAmount: 100.00
   -- splitStatus: 'PENDING'
   ```

---

## 🔧 API Endpoints

### Vendor Management

```bash
# Get all vendors
GET /api/vendors
Authorization: Bearer <admin_token>

# Get vendor by cafeteria
GET /api/vendors/cafeteria/:cafeteriaId
Authorization: Bearer <admin_token>

# Update vendor status
PUT /api/vendors/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "ACTIVE" | "SUSPENDED" | "REJECTED",
  "rejectionReason": "optional reason if rejected"
}
```

---

## 📊 Monitoring Split Settlements

### Check Commission Status

```sql
-- View all commissions with split status
SELECT 
  c.id,
  c."orderId",
  c.amount as platform_commission,
  c."vendorAmount",
  c."totalAmount",
  c."splitStatus",
  c."settledAt",
  o."billId",
  cf.name as cafeteria
FROM commissions c
JOIN orders o ON c."orderId" = o.id
JOIN cafeterias cf ON c."cafeteriaId" = cf.id
ORDER BY c."createdAt" DESC;
```

### Settlement Timeline

- **Payment Success**: Immediate (at checkout)
- **Split Settlement**: T+1 days (daily settlement at 9 AM IST)
- **Status Update**: Via Cashfree webhook (automatic)

---

## 🔍 Troubleshooting

### Issue: Vendor Registration Fails

**Symptoms:**
```json
{
  "success": false,
  "message": "Vendor saved locally but Cashfree registration failed"
}
```

**Solutions:**
1. Check Cashfree credentials are correct
2. Verify vendor split feature is enabled on your account
3. Validate bank account details (IFSC should be valid)
4. Check Cashfree API logs for specific error

### Issue: Order Created Without Split

**Symptoms:** Order works but split is not visible in Cashfree

**Solutions:**
1. Verify vendor status is "ACTIVE":
   ```sql
   SELECT status FROM vendors WHERE "cafeteriaId" = 1;
   ```
2. Check Cloud Function logs for errors
3. Ensure Cloud Function has correct database credentials

### Issue: Split Status Remains PENDING

**Symptoms:** Commission has `splitStatus: 'PENDING'` even after 24 hours

**Solutions:**
1. Check Cashfree settlement dashboard
2. Verify vendor bank account is verified
3. Contact Cashfree support for settlement status

---

## 🎓 How It Works

```
┌─────────────┐
│   Customer  │
│  Pays ₹100  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   Cashfree PG   │
│  (Auto Split)   │
└────┬─────┬──────┘
     │     │
     │     └──────────┐
     │                │
     ▼                ▼
┌─────────┐    ┌──────────┐
│Platform │    │  Vendor  │
│  ₹1.00  │    │  ₹99.00  │
│ (Your)  │    │ (Admin)  │
└─────────┘    └──────────┘
```

**Key Points:**
1. User pays total amount (₹100) through Cashfree
2. Cashfree automatically splits at settlement:
   - ₹1 → Your account (platform commission)
   - ₹99 → Vendor account (cafeteria owner)
3. Database tracks both amounts for reporting
4. Settlement happens daily (T+1)

---

## 📝 Important Notes

1. **Sandbox vs Production:**
   - In sandbox, vendor auto-activates
   - In production, vendors need KYC approval (2-3 days)

2. **MDR Charges:**
   - Cashfree may charge additional fees for split payments
   - Usually 0.2-0.5% extra on MDR
   - Verify with Cashfree sales team

3. **Settlement:**
   - Daily settlement at 9 AM IST (T+1)
   - Settlements happen to vendor's registered bank account
   - Platform commission settles to your primary account

4. **Compliance:**
   - Ensure proper GST invoicing if applicable
   - Maintain TDS records if needed
   - Follow RBI guidelines for merchant payments

---

## 🔐 Security Best Practices

1. **Never commit secrets:**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   cloud-functions/createCashfreeOrder/.env
   ```

2. **Use environment variables** for all sensitive data

3. **Validate vendor bank accounts** before activation

4. **Monitor split settlements** regularly

---

## 📞 Support

If you encounter issues:

1. **Cashfree Support:** support@cashfree.com
2. **Check Cashfree Docs:** https://docs.cashfree.com/docs/split-settlement
3. **Review logs:**
   - Railway backend logs
   - Google Cloud Function logs
   - Cashfree dashboard

---

## ✅ Checklist Before Going Live

- [ ] Database migrations executed successfully
- [ ] Vendor registered and status is "ACTIVE"  
- [ ] Test payment completed with split visible in Cashfree
- [ ] Commission recorded correctly in database
- [ ] Cloud Function deployed and tested
- [ ] Environment variables configured in Railway
- [ ] Cashfree account verified and production credentials obtained
- [ ] KYC completed for vendor (production only)
- [ ] Settlement bank account verified
- [ ] Legal/compliance checks completed

---

**🎉 You're all set! Your split payment system is ready to automatically separate platform commission from vendor payments.**
