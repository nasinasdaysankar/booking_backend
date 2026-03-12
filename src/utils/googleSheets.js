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

const HEADERS = [
    "Order ID",                 // Column A
    "Cashfree Order ID",        // Column B
    "Bill ID",                  // Column C
    "Student ID",               // Column D
    "Customer Name",            // Column E
    "Cafeteria ID",             // Column F
    "Cafeteria Name",           // Column G
    "Items",                    // Column H
    "Total Amount",             // Column I
    "Platform Fee",             // Column J
    "GST Amount",               // Column K
    "Commission Amount",        // Column L
    "Is Parcel",                // Column M
    "Parcel Amount",            // Column N
    "Order Status",             // Column O
    "Payment Status",           // Column P
    "KOT Number",               // Column Q
    "Daily Order #",            // Column R
    "Total Order #",            // Column S
    "ETA (Minutes)",            // Column T
    "Is Rated",                 // Column U
    "Created At",               // Column V
    "Updated At"                // Column W
];

/**
 * Ensures the header row exists in the spreadsheet
 */
const ensureHeaders = async () => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A1:A1',
        });

        const firstCell = response.data.values?.[0]?.[0];
        
        // If A1 is empty OR it doesn't contain "Order ID", we need to write/fix headers
        if (!firstCell || firstCell !== "Order ID") {
            // Note: This updates A1:W1. If there was data there, it will be overwritten by headers.
            // This is usually what's desired if headers are missing.
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A1:W1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [HEADERS] },
            });
            console.log("✅ [GOOGLE SHEETS] Header row created/corrected");
        }
    } catch (err) {
        console.error("⚠️ [GOOGLE SHEETS] Error checking/creating headers:", err.message);
    }
};

/**
 * Appends a new order row to Google Sheets with all available fields
 * @param {Object} orderData - The complete order details
 */
export const appendOrderToSheet = async (orderData) => {
    try {
        // First, make sure headers exist
        await ensureHeaders();

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
            totalOrderNumber,
            etaMinutes,
            isRated,
            createdAt,
            updatedAt
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
                id,                                         // Column A: Order ID
                cashfreeOrderId || 'N/A',                   // Column B: Cashfree Order ID
                billId,                                     // Column C: Bill ID
                studentId,                                  // Column D: Student ID
                customerName || 'Guest',                    // Column E: Customer Name
                cafeteriaId,                                // Column F: Cafeteria ID
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
                kotNumber || 'N/A',                         // Column Q: KOT Number
                dailyOrderNumber || 'N/A',                  // Column R: Daily Order #
                totalOrderNumber || 'N/A',                  // Column S: Total Order #
                etaMinutes || 0,                            // Column T: ETA
                isRated ? 'Yes' : 'No',                    // Column U: Is Rated
                new Date(createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), // Column V: Created At
                new Date(updatedAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })  // Column W: Updated At
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:W',
            valueInputOption: 'USER_ENTERED',
            resource: { values: Values },
        });

        console.log(`📊 [GOOGLE SHEETS] Order #${id} synced with all 23 fields`);
    } catch (error) {
        console.error('❌ [GOOGLE SHEETS ERR]:', error.message);
    }
};
