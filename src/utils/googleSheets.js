import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account from firebase-admin.json
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'firebase-admin.json');
const SPREADSHEET_ID = '1eX9wOWKrFdBlh33ZfxTQMYWCBAC0jyAx_8q4YNFCWHA';

// Initialize Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Appends a new order row to Google Sheets with all available fields
 * @param {Object} orderData - The complete order details
 */
export const appendOrderToSheet = async (orderData) => {
    try {
        const {
            id,
            cashfreeOrderId,
            billId,
            studentId,
            customerName,
            cafeteriaId,
            totalAmount,
            platformFee,
            gstAmount,
            commissionAmount,
            isParcel,
            parcelAmount,
            items,
            status,
            paymentStatus,
            kotNumber,
            createdAt
        } = orderData;

        // Format items as a string: "2x Coffee, 1x Tea"
        const itemsString = items?.map(item => `${item.quantity || item.qty}x ${item.name}`).join(', ') || 'N/A';

        // Convert cafeteria ID to name
        const getCafeteriaName = (id) => {
            switch (Number(id)) {
                case 1: return "Anathahara";
                case 2: return "Aromos";
                case 3: return "Dhanapani";
                case 4: return "Foodclub";
                default: return `Cafeteria ${id}`;
            }
        };

        const Values = [
            [
                new Date(createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), // Column A: Date
                id,                                         // Column B: ID
                cashfreeOrderId || 'N/A',                   // Column C: Cashfree Order ID
                billId,                                     // Column D: Bill ID
                studentId,                                  // Column E: Student ID
                customerName || 'Guest',                    // Column F: Customer Name
                getCafeteriaName(cafeteriaId),             // Column G: Cafeteria Name
                itemsString,                                // Column H: Items
                totalAmount,                                // Column I: Total Amount
                platformFee || 0,                           // Column J: Platform Fee
                gstAmount || 0,                             // Column K: GST Amount
                commissionAmount || 0,                      // Column L: Commission Amount
                isParcel ? 'Yes' : 'No',                    // Column M: Is Parcel
                parcelAmount || 0,                          // Column N: Parcel Amount
                status || 'PAID',                           // Column O: Order Status
                paymentStatus || 'SUCCESS',                 // Column P: Payment Status
                kotNumber || 'N/A'                          // Column Q: KOT Number
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:Q',
            valueInputOption: 'USER_ENTERED',
            resource: { values: Values },
        });

        console.log(`📊 [GOOGLE SHEETS] Order #${id} synced with all fields`);
    } catch (error) {
        console.error('❌ [GOOGLE SHEETS ERR]:', error.message);
    }
};
