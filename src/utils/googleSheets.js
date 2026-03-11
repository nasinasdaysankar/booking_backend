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
            dailyOrderNumber,
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
                dailyOrderNumber || 'N/A',                  // Column B: Daily Order # (Changed from ID)
                id,                                         // Column C: Database ID
                cashfreeOrderId || 'N/A',                   // Column D: Cashfree Order ID
                billId,                                     // Column E: Bill ID
                studentId,                                  // Column F: Student ID
                customerName || 'Guest',                    // Column G: Customer Name
                getCafeteriaName(cafeteriaId),             // Column H: Cafeteria Name
                itemsString,                                // Column I: Items
                totalAmount,                                // Column J: Total Amount
                platformFee || 0,                           // Column K: Platform Fee
                gstAmount || 0,                             // Column L: GST Amount
                commissionAmount || 0,                      // Column M: Commission Amount
                isParcel ? 'Yes' : 'No',                    // Column N: Is Parcel
                parcelAmount || 0,                          // Column O: Parcel Amount
                status || 'PAID',                           // Column P: Order Status
                paymentStatus || 'SUCCESS',                 // Column Q: Payment Status
                kotNumber || 'N/A'                          // Column R: KOT Number
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:R',
            valueInputOption: 'USER_ENTERED',
            resource: { values: Values },
        });

        console.log(`📊 [GOOGLE SHEETS] Order #${id} synced with all fields`);
    } catch (error) {
        console.error('❌ [GOOGLE SHEETS ERR]:', error.message);
    }
};
