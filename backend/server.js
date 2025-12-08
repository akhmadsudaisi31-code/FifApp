const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Debug Middleware
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send('Server is running'));

// --- CONFIGURATION ---
// TODO: User must provide these
const SPREADSHEET_ID = '1pO_ZyP-iDr0I2EKfWfCv5kNJ5KesVPOdaSCIHC53Ejs';

// --- GOOGLE SHEETS SETUP ---
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Support credentials from Env Var (for Render/Deployment) or local file
let credentials;
if (process.env.GOOGLE_CREDENTIALS) {
    try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
        console.error("Failed to parse GOOGLE_CREDENTIALS env var");
    }
} else {
    try {
        credentials = require(path.join(__dirname, 'credentials.json'));
    } catch (e) {
        console.warn("No credentials.json found and GOOGLE_CREDENTIALS not set.");
    }
}

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
});

// --- GOOGLE SHEETS CLIENT ---
let sheets = null;

async function initGoogleSheets() {
    try {
        const authClient = await auth.getClient();
        sheets = google.sheets({ version: 'v4', auth: authClient });
        console.log("✅ Google Sheets API Authenticated");
        return true;
    } catch (error) {
        console.error("❌ ERROR: Failed to authenticate with Google Sheets:", error.message);
        return false;
    }
}

// Initialize on start
initGoogleSheets();

// --- DATA HELPERS ---

// 1. Default Schema (Sheet1)
// A=Rute, B=ID1, C=ID2, D=Tanggal, E=Contract, F=Customer, G=Due, H=Amt, I=Ke, J=LOB, K=Reason
const mapRowDefault = (row, index) => {
    const row_ref = String(index + 2);
    return {
        row_ref,
        type: 'default',
        A: row[0] || "", // Rute
        B: row[1] || "", // ID1
        C: row[2] || "", // ID2
        D: row[3] || "", // Tanggal
        E: row[4] || "", // Contract
        F: row[5] || "", // Customer
        G: row[6] || "", // Due Date
        H: row[7] || "", // Install Amt
        I: row[8] || "", // Ke
        J: row[9] || "", // LOB
        K: row[10] || "", // Reason
        // Normalized fields for frontend
        contract: row[4] || "",
        customer: row[5] || "",
        due_date: row[6] || "",
        install_amt: row[7] || "",
        lob: row[9] || "",
        reason: row[10] || "",
        date_filter: row[3] || ""
    };
};

// 2. BA Schema (Sheet BA)
// B=ID1, C=ID2, D=Beban, E=Cabang, F=Contract, G=Nama, H=Alamat, I=Jatuh Tempo, J=Install_Amt, K=KE, L=LOB, M=Reason
const mapRowBA = (row, index) => {
    const row_ref = String(index + 2);
    return {
        row_ref,
        type: 'ba',
        // Raw mapping (0-based index from range B:M)
        B: row[0] || "", // ID1
        C: row[1] || "", // ID2
        D: row[2] || "", // Beban
        E: row[3] || "", // Cabang
        F: row[4] || "", // Contract
        G: row[5] || "", // Nama
        H: row[6] || "", // Alamat
        I: row[7] || "", // Jatuh Tempo
        J: row[8] || "", // Install Amt
        K: row[9] || "", // KE
        L: row[10] || "", // LOB
        M: row[11] || "", // Reason
        // Normalized fields for frontend
        contract: row[4] || "",
        customer: row[5] || "",
        due_date: row[7] || "",
        install_amt: row[8] || "",
        lob: row[10] || "",
        reason: row[11] || "",
        date_filter: row[7] || "", // Use Jatuh Tempo as date filter? Or is there another date? User said "I=jatuh tempo".
        // Extra fields
        beban: row[2] || "",
        cabang: row[3] || "",
        alamat: row[6] || "",
        ke: row[9] || ""
    };
};

async function getSheetName() {
    if (!sheets) return 'Sheet1';
    try {
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        return meta.data.sheets[0].properties.title;
    } catch (error) {
        console.error("Error getting sheet name:", error.message);
        return 'Sheet1';
    }
}

async function fetchData(sheetName, range) {
    if (!sheets) return [];
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
        });
        const rows = res.data.values;
        if (!rows || rows.length === 0) return [];
        return rows;
    } catch (error) {
        console.error(`Error fetching data from ${sheetName}:`, error.message);
        return [];
    }
}

async function updateReason(sheetName, cellColumn, row_ref, newValue) {
    if (!sheets) throw new Error("Google Sheets not initialized");

    const range = `${sheetName}!${cellColumn}${row_ref}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'RAW',
        resource: {
            values: [[newValue]]
        }
    });
}

const ROOMS = [
    { room_id: "nbot", label: "NBOT", occupancy: 0 },
    { room_id: "ba", label: "BA", occupancy: 0 }
];

// --- API ENDPOINTS ---

// 1. Dashboard Init
app.get('/api/dashboard/init', async (req, res) => {
    // For occupancy, we might need to fetch both sheets or just keep it simple for now.
    // Let's just fetch default sheet for now to avoid delay, or fetch both in parallel.
    // Since user removed routing, occupancy is less critical.

    // Calculate occupancy (Disable routing filter for occupancy too if needed, but let's keep it for now or set to total)
    // User said "hilangkan kolom A", so maybe occupancy should just be total count? 
    // Or maybe they just want search to work across rooms.
    // Let's keep occupancy logic for now but fix the search endpoint.
    const sheetName = await getSheetName();
    const defaultRawData = await fetchData(sheetName, 'A2:K');
    const baRawData = await fetchData('BA', 'B2:M');

    // Helper function to check if a default record is complete (all fields except reason)
    const isDefaultRecordComplete = (row) => {
        // Required fields: A, B, C, D, E, F, G, H, I, J (not K/reason)
        return row[0] && row[1] && row[2] && row[3] && row[4] &&
            row[5] && row[6] && row[7] && row[8] && row[9];
    };

    // Helper function to check if a BA record is complete (all fields except reason)
    const isBARecordComplete = (row) => {
        // Required fields: B-L (indices 0-10, not M/reason which is index 11)
        return row[0] && row[1] && row[2] && row[3] && row[4] &&
            row[5] && row[6] && row[7] && row[8] && row[9] && row[10];
    };

    // Count only complete records
    const completeDefaultData = defaultRawData.filter(isDefaultRecordComplete);
    const completeBAData = baRawData.filter(isBARecordComplete);

    ROOMS.forEach(room => {
        if (room.room_id === 'ba') {
            room.occupancy = completeBAData.length;
        } else {
            room.occupancy = completeDefaultData.length;
        }
    });

    res.json({
        rooms: ROOMS,
        config: {
            polling_interval_seconds: 7
        }
    });
});

// 2. Enter Room / Search
app.post('/api/rooms/:room_id/enter', async (req, res) => {
    const { query_by, value, date_filter } = req.body;
    const { room_id } = req.params;

    console.log(`[${room_id}] Search by ${query_by}: ${value}, Date: ${date_filter}`);

    let matched = [];

    if (room_id === 'ba') {
        // --- BA ROOM LOGIC ---
        const rawRows = await fetchData('BA', 'B2:M');
        const data = rawRows.map(mapRowBA);

        matched = data;

        // Filter by Search (Name in G, IDs in B, C)
        if (value && value.trim() !== '') {
            const lowerVal = value.toLowerCase();
            matched = matched.filter(row =>
                (row.G && row.G.toLowerCase().includes(lowerVal)) || // Nama
                (row.B && row.B.toLowerCase().includes(lowerVal)) || // ID 1
                (row.C && row.C.toLowerCase().includes(lowerVal))    // ID 2
            );
        }

        // Filter by Date (Column I - Jatuh Tempo)
        if (date_filter) {
            // Normalize date filter (YYYY-MM-DD -> DD/MM/YYYY)
            const [y, m, d] = date_filter.split('-');
            const targetDate = `${d}/${m}/${y}`;
            matched = matched.filter(row => row.I === targetDate);
        }

    } else {
        // --- DEFAULT ROOM LOGIC (NBOT, etc) ---
        const sheetName = await getSheetName();
        const rawRows = await fetchData(sheetName, 'A2:K');
        const data = rawRows.map(mapRowDefault);

        matched = data;

        // Filter by Search (Name in F, IDs in B, C)
        if (value && value.trim() !== '') {
            const lowerVal = value.toLowerCase();
            matched = matched.filter(row =>
                (row.F && row.F.toLowerCase().includes(lowerVal)) || // Customer
                (row.B && row.B.toLowerCase().includes(lowerVal)) || // ID 1
                (row.C && row.C.toLowerCase().includes(lowerVal))    // ID 2
            );
        }

        // Filter by Date (Column G - Due Date)
        if (date_filter) {
            const [y, m, d] = date_filter.split('-');
            const targetDate = `${d}/${m}/${y}`;
            matched = matched.filter(row => row.G === targetDate);
        }
    }

    res.json({
        room_id,
        matched_records: matched
    });
});

// 3. Update Record
app.put('/api/records/:row_ref/user-input', async (req, res) => {
    const { row_ref } = req.params;
    const { new_value, room_id } = req.body; // Require room_id to know which sheet

    if (room_id === 'default' && req.body.field !== 'K') { // Assuming 'default' is the type for the original sheet
        return res.status(403).json({
            error: "Forbidden",
            message: "Edit only allowed on column K (REASON) for default sheet."
        });
    }
    // No explicit field check for BA, assuming it's always 'M' for reason

    try {
        if (room_id === 'ba') {
            // Update BA Sheet, Column M
            await updateReason('BA', 'M', row_ref, new_value);
        } else {
            // Update Default Sheet, Column K
            const sheetName = await getSheetName();
            await updateReason(sheetName, 'K', row_ref, new_value);
        }

        console.log(`Audit: [${room_id || 'default'}] Row ${row_ref} updated to "${new_value}"`);

        res.json({
            status: "ok",
            row_ref,
            reason: new_value
        });
    } catch (err) {
        console.error("Update failed:", err);
        res.status(500).json({ error: "Failed to update spreadsheet" });
    }
});

// 4. Get All Records (Laporan) - Default Sheet only for now
app.get('/api/records', async (req, res) => {
    const sheetName = await getSheetName();
    const rawRows = await fetchData(sheetName, 'A2:K');
    const data = rawRows.map(mapRowDefault);
    res.json({ records: data });
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
