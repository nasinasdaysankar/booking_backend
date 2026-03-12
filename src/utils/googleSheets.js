import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account from firebase-admin.json
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'firebase-admin.json');
const SPREADSHEET_ID = '1eX9wOWKrFdBlh33ZfxTQMYWCBAC0jyAx_8q4YNFCWHA';

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
    "Order Status",             // Column O (Updated dynamically)
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
 * Ensures the header row exists and is correct
 */
const ensureHeaders = async () => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A1:A1',
        });

        const firstCell = response.data.values?.[0]?.[0];
        
        if (firstCell !== "Order ID") {
            // Aggressively set headers in the first row
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A1:W1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [HEADERS] },
            });
            console.log("✅ [GOOGLE SHEETS] Header row synced/corrected");
        }
    } catch (err) {
        console.error("⚠️ [GOOGLE SHEETS] Error syncing headers:", err.message);
    }
};

/**
 * Appends a new order row to Google Sheets
 */
export const appendOrderToSheet = async (orderData) => {
    try {
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

        const itemsString = items?.map(item => `${item.quantity || item.qty}x ${item.name}`).join(', ') || 'N/A';

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
                id,                                         // Column A
                cashfreeOrderId || 'N/A',                   // Column B
                billId,                                     // Column C
                studentId,                                  // Column D
                customerName || 'Guest',                    // Column E
                cafeteriaId,                                // Column F
                getCafeteriaName(cafeteriaId),             // Column G
                itemsString,                                // Column H
                totalAmount,                                // Column I
                platformFee || 0,                           // Column J
                gstAmount || 0,                             // Column K
                commissionAmount || 0,                      // Column L
                isParcel ? 'Yes' : 'No',                    // Column M
                parcelAmount || 0,                          // Column N
                status || 'PAID',                           // Column O
                paymentStatus || 'SUCCESS',                 // Column P
                kotNumber || 'N/A',                         // Column Q
                dailyOrderNumber || 'N/A',                  // Column R
                totalOrderNumber || 'N/A',                  // Column S
                etaMinutes || 0,                            // Column T
                isRated ? 'Yes' : 'No',                    // Column U
                new Date(createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                new Date(updatedAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:W',
            valueInputOption: 'USER_ENTERED',
            resource: { values: Values },
        });

        console.log(`📊 [GOOGLE SHEETS] Order #${id} appended successfully.`);
    } catch (error) {
        console.error('❌ [GOOGLE SHEETS ERR]:', error.message);
    }
};

/**
 * Updates the status of an existing order row dynamically
 */
export const updateOrderStatusInSheet = async (orderId, newStatus) => {
    try {
        if (!orderId) return;

        // 1. Find the row index by searching for Order ID in Column A
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:A',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => String(row[0]) === String(orderId));

        if (rowIndex === -1) {
            console.warn(`⚠️ [GOOGLE SHEETS] Order #${orderId} not found in sheet for status update.`);
            return;
        }

        const spreadsheetRow = rowIndex + 1; // 1-indexed for Sheets API
        
        // 2. Update Column O (Order Status) which is the 15th column
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!O${spreadsheetRow}`, // Column O
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[newStatus]] },
        });

        // 3. Update the "Updated At" timestamp (Column W - 23rd column)
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!W${spreadsheetRow}`, // Column W
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[timestamp]] },
        });

        console.log(`🔄 [GOOGLE SHEETS] Order #${orderId} status updated to ${newStatus} dynamically.`);
    } catch (error) {
        console.error('❌ [GOOGLE SHEETS UPDATE ERR]:', error.message);
    }
};
