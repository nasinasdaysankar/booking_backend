import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account from firebase-admin.json
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'firebase-admin.json');
const SPREADSHEET_ID = '1gN_9ptv8kWCW0h2GNNfifEpcuO2bUURsfsWJ9GRTAzc';

// Initialize Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Appends a new order row to Google Sheets
 * @param {Object} orderData - The order details
 */
export const appendOrderToSheet = async (orderData) => {
    try {
        const {
            id,
            billId,
            customerName,
            items,
            totalAmount,
            transactionId,
            status,
            createdAt,
            cafeteriaId
        } = orderData;

        // Format items as a string: "2x Coffee, 1x Tea"
        const itemsString = items?.map(item => `${item.quantity || item.qty}x ${item.name}`).join(', ') || 'N/A';

        // Convert cafeteria ID to name (based on paymentController.js logic)
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
                new Date(createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), // Local India Time
                id,
                billId,
                customerName || 'Guest',
                getCafeteriaName(cafeteriaId),
                itemsString,
                totalAmount,
                transactionId || 'N/A',
                status || 'PAID'
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:I', // Append to the first sheet, columns A through I
            valueInputOption: 'USER_ENTERED',
            resource: { values: Values },
        });

        console.log(`📊 [GOOGLE SHEETS] Order #${id} synced successfully`);
    } catch (error) {
        console.error('❌ [GOOGLE SHEETS ERR]:', error.message);
        // Non-blocking: don't fail the order if sheets sync fails
    }
};
