/**
 * ===================================================================
 * Google Cloud Function: createCashfreeOrder
 * Enhanced with Vendor Split functionality
 * ===================================================================
 */

const functions = require('@google-cloud/functions-framework');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');

// ================= DATABASE CONFIG =================
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
        logging: false,
    }
);

// ================= VENDOR MODEL =================
const Vendor = sequelize.define('Vendor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cafeteriaId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    vendorId: { type: DataTypes.STRING, allowNull: false, unique: true },
    cashfreeVendorId: { type: DataTypes.STRING, allowNull: true, unique: true },
    status: {
        type: DataTypes.ENUM('PENDING_KYC', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
        defaultValue: 'PENDING_KYC',
    },
}, {
    tableName: 'vendors',
    timestamps: true,
});

// ================= HELPER: GET VENDOR BY CAFETERIA =================
async function getVendorByCafeteria(cafeteriaId) {
    try {
        const vendor = await Vendor.findOne({
            where: { cafeteriaId, status: 'ACTIVE' },
        });
        return vendor;
    } catch (error) {
        console.error('❌ Error fetching vendor:', error);
        return null;
    }
}

// ================= MAIN CLOUD FUNCTION =================
functions.http('createCashfreeOrder', async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            orderAmount,
            orderCurrency,
            orderId,
            cafeteriaId,
            customerDetails,
            orderMeta,
        } = req.body;

        console.log('📦 Creating Cashfree order:', {
            orderId,
            amount: orderAmount,
            cafeteriaId,
        });

        // ✅ Validate required fields
        if (!orderAmount || !orderId || !cafeteriaId || !customerDetails) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
            });
        }

        // ✅ Connect to database
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // ✅ Get vendor for this cafeteria
        const vendor = await getVendorByCafeteria(cafeteriaId);

        if (!vendor) {
            console.warn('⚠️ No active vendor found for cafeteria', cafeteriaId);
            console.log('📌 Creating order WITHOUT split (vendor not configured)');
        } else {
            console.log('✅ Vendor found:', {
                vendorId: vendor.vendorId,
                cashfreeVendorId: vendor.cashfreeVendorId,
            });
        }

        // ✅ Calculate split amounts
        const totalAmount = parseFloat(orderAmount);
        const platformCommission = 1.00; // ₹1 platform fee
        const vendorAmount = totalAmount - platformCommission;

        // ✅ Prepare Cashfree request
        const cashfreeUrl = 'https://sandbox.cashfree.com/pg/orders';

        const orderPayload = {
            order_id: orderId,
            order_amount: totalAmount,
            order_currency: orderCurrency || 'INR',
            customer_details: {
                customer_id: customerDetails.customerId,
                customer_email: customerDetails.customerEmail,
                customer_phone: customerDetails.customerPhone,
                customer_name: customerDetails.customerName || 'Customer',
            },
            order_meta: {
                return_url: orderMeta?.returnUrl || 'https://google.com',
                notify_url: process.env.WEBHOOK_URL || '',
            },
        };

        // ✅ Add vendor split if vendor is active
        if (vendor && vendor.cashfreeVendorId) {
            orderPayload.order_splits = [
                {
                    vendor_id: vendor.cashfreeVendorId,
                    amount: vendorAmount.toFixed(2),
                    // Platform commission (₹1) automatically goes to primary account
                },
            ];

            console.log('💰 Split configuration:', {
                vendorAmount: vendorAmount.toFixed(2),
                platformCommission: platformCommission.toFixed(2),
                vendorId: vendor.cashfreeVendorId,
            });
        }

        // ✅ Call Cashfree API
        const cashfreeResponse = await axios.post(cashfreeUrl, orderPayload, {
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': process.env.CASHFREE_SANDBOX_CLIENT_ID,
                'x-client-secret': process.env.CASHFREE_SANDBOX_CLIENT_SECRET,
                'x-api-version': '2023-08-01',
            },
        });

        console.log('✅ Cashfree order created:', cashfreeResponse.data.order_id);

        // ✅ Generate bill ID
        const billId = `BILL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        return res.status(200).json({
            success: true,
            orderId: cashfreeResponse.data.order_id,
            paymentSessionId: cashfreeResponse.data.payment_session_id,
            billId,
            splitEnabled: !!vendor,
            vendorAmount: vendor ? vendorAmount.toFixed(2) : null,
            platformCommission: vendor ? platformCommission.toFixed(2) : null,
        });

    } catch (error) {
        console.error('❌ Error creating Cashfree order:', error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data || {},
        });
    } finally {
        await sequelize.close();
    }
});

// ================= EXPORT =================
module.exports = { createCashfreeOrder };
