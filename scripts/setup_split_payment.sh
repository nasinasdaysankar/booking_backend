#!/bin/bash

# ===================================================================
# Quick Start Script: Cashfree Split Payment Setup
# ===================================================================

set -e  # Exit on error

echo "🚀 Cashfree Split Payment - Quick Setup"
echo "========================================"
echo ""

# Check if running from correct directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the backend root directory"
  exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1: Installing new dependencies..."
npm install axios
echo "✅ Dependencies installed"
echo ""

# Step 2: Check database connection
echo "🗄️ Step 2: Checking database connection..."
echo "ℹ️  Please ensure your DATABASE_URL is configured in Railway"
echo ""

# Step 3: Run migrations
echo "📊 Step 3: Database migrations"
echo "⚠️  You need to run the migration manually:"
echo ""
echo "   Option A: Using psql (from your local machine)"
echo "   psql \$DATABASE_URL -f migrations/001_add_vendor_split_tables.sql"
echo ""
echo "   Option B: Using Railway database console"
echo "   1. Go to Railway dashboard → Your database"
echo "   2. Open 'Connect' → 'psql'"  
echo "   3. Copy and paste SQL from: migrations/001_add_vendor_split_tables.sql"
echo ""
read -p "Press Enter after running the migration..."
echo ""

# Step 4: Environment variables
echo "🔐 Step 4: Environment Variables Check"
echo "Add these to your Railway environment:"
echo ""
echo "CASHFREE_SANDBOX_CLIENT_ID=<your_client_id>"
echo "CASHFREE_SANDBOX_CLIENT_SECRET=<your_secret>"
echo "CASHFREE_ENV=sandbox"
echo ""
read -p "Press Enter after adding environment variables to Railway..."
echo ""

# Step 5: Cloud Function deployment
echo "☁️ Step 5: Deploy Cloud Function"
echo "Navigate to: cd cloud-functions/createCashfreeOrder"
echo "Then run: npm install"
echo ""
echo "Deploy command:"
echo "gcloud functions deploy createCashfreeOrder \\"
echo "  --runtime nodejs20 \\"
echo "  --trigger-http \\"
echo "  --allow-unauthenticated \\"
echo "  --region us-central1 \\"
echo "  --set-env-vars DB_NAME=<db>,DB_USER=<user>,DB_PASSWORD=<pass>,DB_HOST=<host>,DB_PORT=5432,CASHFREE_SANDBOX_CLIENT_ID=<id>,CASHFREE_SANDBOX_CLIENT_SECRET=<secret>"
echo ""
read -p "Press Enter after deploying Cloud Function..."
echo ""

# Step 6: Register vendor
echo "👤 Step 6: Register Your Cafeteria as Vendor"
echo ""
echo "Use this API endpoint:"
echo "POST https://your-backend.railway.app/api/vendors/register"
echo ""
echo "Sample request body (see docs/SPLIT_PAYMENT_SETUP.md for details):"
cat << 'EOF'
{
  "cafeteriaId": 1,
  "vendorName": "Your Cafeteria Name",
  "vendorEmail": "admin@cafeteria.com",
  "vendorPhone": "9876543210",
  "accountHolderName": "ACCOUNT HOLDER",
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234",
  "bankName": "State Bank of India"
}
EOF
echo ""
echo "Use Postman, Insomnia, or curl to make this request with admin token"
echo ""
read -p "Press Enter after registering vendor..."
echo ""

# Step 7: Restart backend
echo "🔄 Step 7: Restart Backend"
echo "In Railway dashboard, trigger a redeploy or restart"
echo ""
read -p "Press Enter after restarting..."
echo ""

# Summary
echo ""
echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo "1. Test payment flow from mobile app"
echo "2. Check Cashfree dashboard for split configuration"
echo "3. Verify commission records in database"
echo ""
echo "📖 Full Documentation: docs/SPLIT_PAYMENT_SETUP.md"
echo ""
echo "🎉 Happy coding!"
