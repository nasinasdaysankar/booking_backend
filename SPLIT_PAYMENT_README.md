# Cashfree Split Payment - Quick Reference

## 📁 What Was Created

This implementation adds **automated payment splitting** at the Cashfree gateway level.

### Core Files

| File | Purpose |
|------|---------|
| [`src/models/Vendor.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/models/Vendor.js) | Vendor/cafeteria payment account model |
| [`src/controllers/vendorController.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/controllers/vendorController.js) | Vendor CRUD + Cashfree registration |
| [`src/routes/vendorRoutes.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/routes/vendorRoutes.js) | Vendor API endpoints |
| [`cloud-functions/createCashfreeOrder/index.js`](file:///Users/nasinaudaysankar/booking_backend-5/cloud-functions/createCashfreeOrder/index.js) | Enhanced order creation with vendor splits |
| [`migrations/001_add_vendor_split_tables.sql`](file:///Users/nasinaudaysankar/booking_backend-5/migrations/001_add_vendor_split_tables.sql) | Database schema updates |

### Modified Files

| File | Changes |
|------|---------|
| [`src/models/Commission.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/models/Commission.js) | Added vendor split tracking fields |
| [`src/controllers/paymentController.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/controllers/paymentController.js) | Records vendor amount in commission |
| [`src/models/index.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/models/index.js) | Registered Vendor model |
| [`src/app.js`](file:///Users/nasinaudaysankar/booking_backend-5/src/app.js) | Mounted vendor routes |

### Documentation

| File | Description |
|------|-------------|
| [`docs/SPLIT_PAYMENT_SETUP.md`](file:///Users/nasinaudaysankar/booking_backend-5/docs/SPLIT_PAYMENT_SETUP.md) | Complete setup guide |
| [`scripts/setup_split_payment.sh`](file:///Users/nasinaudaysankar/booking_backend-5/scripts/setup_split_payment.sh) | Interactive setup script |

---

## 🚀 Quick Start (5 Steps)

### 1. Run Database Migration

```bash
psql $DATABASE_URL -f migrations/001_add_vendor_split_tables.sql
```

### 2. Add Environment Variables

In Railway dashboard, add:
```bash
CASHFREE_SANDBOX_CLIENT_ID=your_client_id
CASHFREE_SANDBOX_CLIENT_SECRET=your_secret
CASHFREE_ENV=sandbox
```

### 3. Deploy Cloud Function

```bash
cd cloud-functions/createCashfreeOrder
npm install
gcloud functions deploy createCashfreeOrder \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1 \
  --set-env-vars DB_NAME=<db>,DB_USER=<user>,DB_PASSWORD=<pass>,DB_HOST=<host>,CASHFREE_SANDBOX_CLIENT_ID=<id>,CASHFREE_SANDBOX_CLIENT_SECRET=<secret>
```

### 4. Register Vendor

```bash
POST https://your-backend.railway.app/api/vendors/register
Authorization: Bearer <admin_token>

{
  "cafeteriaId": 1,
  "vendorName": "Your Cafeteria",
  "vendorEmail": "admin@cafeteria.com",
  "vendorPhone": "9876543210",
  "accountHolderName": "ACCOUNT HOLDER",
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234",
  "bankName": "State Bank of India"
}
```

### 5. Test Payment

Make a test payment from your app and verify:
- ✅ Split appears in Cashfree dashboard
- ✅ Commission record shows correct amounts
- ✅ Cloud Function logs show split configuration

---

## 💰 How It Works

```
Customer pays ₹100
        ↓
  Cashfree Gateway
        ↓
    Automatic Split
        ↓
   ₹1 → Platform Account (You)
   ₹99 → Vendor Account (Cafeteria Owner)
```

**Settlement:** Daily at 9 AM IST (T+1)

---

## 📊 API Endpoints

### Vendor Management

```bash
# Register vendor
POST /api/vendors/register

# Get all vendors
GET /api/vendors

# Get vendor by cafeteria
GET /api/vendors/cafeteria/:cafeteriaId

# Update vendor status
PUT /api/vendors/:id/status
```

All endpoints require admin authentication.

---

## 🔍 Testing Queries

### View Commission Records

```sql
SELECT 
  c.id,
  o."billId",
  c.amount as platform_commission,
  c."vendorAmount",
  c."totalAmount",
  c."splitStatus",
  cf.name as cafeteria
FROM commissions c
JOIN orders o ON c."orderId" = o.id
JOIN cafeterias cf ON c."cafeteriaId" = cf.id
ORDER BY c."createdAt" DESC
LIMIT 10;
```

### Check Vendor Status

```sql
SELECT 
  v."vendorId",
  v."vendorName",
  v."status",
  v."cashfreeVendorId",
  c.name as cafeteria_name
FROM vendors v
JOIN cafeterias c ON v."cafeteriaId" = c.id;
```

---

## 📖 Full Documentation

- **Setup Guide:** [`docs/SPLIT_PAYMENT_SETUP.md`](file:///Users/nasinaudaysankar/booking_backend-5/docs/SPLIT_PAYMENT_SETUP.md)
- **Implementation Details:** See walkthrough artifact
- **Interactive Setup:** Run `./scripts/setup_split_payment.sh`

---

## ✅ Success Checklist

Before going live:

- [ ] Database migrations executed
- [ ] Environment variables configured
- [ ] Cloud Function deployed
- [ ] Vendor registered with `status: ACTIVE`
- [ ] Test payment shows split in Cashfree
- [ ] Commission amounts verified in database
- [ ] Backend restarted on Railway

---

## 🆘 Troubleshooting

**Issue:** Vendor registration fails  
**Solution:** Check Cashfree credentials and ensure "vendor split" feature is enabled

**Issue:** Split not showing in Cashfree  
**Solution:** Verify vendor status is `ACTIVE` in database

**Issue:** Commission amounts incorrect  
**Solution:** Check payment controller logs for calculation errors

---

## 📞 Support

- Cashfree Docs: https://docs.cashfree.com/docs/split-settlement
- Email: support@cashfree.com

---

**🎉 You're ready to deploy! Follow the [SPLIT_PAYMENT_SETUP.md](file:///Users/nasinaudaysankar/booking_backend-5/docs/SPLIT_PAYMENT_SETUP.md) guide for detailed instructions.**
