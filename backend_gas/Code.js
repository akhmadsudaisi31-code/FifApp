const SPREADSHEET_ID = '1pO_ZyP-iDr0I2EKfWfCv5kNJ5KesVPOdaSCIHC53Ejs';
const CACHE_EXPIRATION_SEC = 300; // 5 minutes cache

function doGet(e) {
    const action = e.parameter.action;

    if (action === 'dashboard_init') {
        return handleDashboardInit();
    } else if (action === 'get_records') {
        // get_records is usually GET, but if we want to pass body for room_id, we might need POST or query param
        // Let's support both. If query param has room_id, use it.
        // But handleGetRecords signature in my previous edit was handleGetRecords(body).
        // Let's make handleGetRecords accept an object.
        const room_id = e.parameter.room_id;
        return handleGetRecords({ room_id });
    }

    return responseJSON({ error: "Invalid action" });
}

function doPost(e) {
    const action = e.parameter.action;
    let body = {};

    try {
        if (e.postData && e.postData.contents) {
            body = JSON.parse(e.postData.contents);
        }
    } catch (err) {
        // ignore
    }

    if (action === 'enter_room') {
        return handleEnterRoom(e.parameter.roomId, body);
    } else if (action === 'update_record') {
        return handleUpdateRecord(e.parameter.rowRef, body);
    }

    return responseJSON({ error: "Invalid action" });
}

function responseJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// --- HANDLERS ---

function handleDashboardInit() {
    const rooms = [
        { room_id: "nbot", label: "NBOT", occupancy: 0 },
        { room_id: "ba", label: "BA", occupancy: 0 }
    ];

    // Use cached data
    const defaultData = getDataWithCache('Sheet1', 'A2:K'); // Assuming Sheet1 is default
    const baData = getDataWithCache('BA', 'B2:M');

    // Count complete records
    const completeDefault = defaultData.filter(isDefaultRecordComplete).length;
    const completeBA = baData.filter(isBARecordComplete).length;

    rooms[0].occupancy = completeDefault;
    rooms[1].occupancy = completeBA;

    return responseJSON({
        rooms: rooms,
        config: { polling_interval_seconds: 7 }
    });
}

function handleEnterRoom(roomId, body) {
    const { value, date_filter, page = 1, pageSize = 10, reason_filter = 'all' } = body;
    let matched = [];

    // Requirement: If no search query (value), return empty immediately
    if (!value || value.trim() === '') {
        return responseJSON({
            room_id: roomId,
            matched_records: [],
            pagination: {
                total_records: 0,
                total_pages: 0,
                current_page: 1,
                page_size: pageSize
            }
        });
    }

    if (roomId === 'ba') {
        const rawRows = getDataWithCache('BA', 'B2:M');
        matched = rawRows.map(mapRowBA);

        // Filter by Search (Columns B and C ONLY)
        if (value && value.trim() !== '') {
            const lowerVal = value.toLowerCase();
            matched = matched.filter(row =>
                (row.B && row.B.toLowerCase().includes(lowerVal)) ||
                (row.C && row.C.toLowerCase().includes(lowerVal))
            );
        }

        // Filter by Date
        if (date_filter) {
            const [y, m, d] = date_filter.split('-');
            const targetDate = `${d}/${m}/${y}`;
            matched = matched.filter(row => row.I == targetDate);
        }
    } else {
        // Default Room
        const rawRows = getDataWithCache('Sheet1', 'A2:K');
        matched = rawRows.map(mapRowDefault);

        // Filter by Search (Columns B and C ONLY)
        if (value && value.trim() !== '') {
            const lowerVal = value.toLowerCase();
            matched = matched.filter(row =>
                (row.B && row.B.toLowerCase().includes(lowerVal)) ||
                (row.C && row.C.toLowerCase().includes(lowerVal))
            );
        }

        // Filter by Date
        if (date_filter) {
            const [y, m, d] = date_filter.split('-');
            const targetDate = `${d}/${m}/${y}`;
            matched = matched.filter(row => row.G == targetDate);
        }
    }

    // Filter by Reason
    if (reason_filter === 'filled') {
        matched = matched.filter(row => row.reason && row.reason.trim() !== '');
    } else if (reason_filter === 'empty') {
        matched = matched.filter(row => !row.reason || row.reason.trim() === '');
    }

    // Pagination
    const total_records = matched.length;
    const total_pages = Math.ceil(total_records / pageSize);
    const current_page = Math.max(1, Math.min(page, total_pages || 1));

    const startIndex = (current_page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const paginated_records = matched.slice(startIndex, endIndex);

    return responseJSON({
        room_id: roomId,
        matched_records: paginated_records,
        pagination: {
            total_records,
            total_pages,
            current_page,
            page_size: pageSize
        }
    });
}

function handleUpdateRecord(rowRef, body) {
    const { new_value, room_id } = body;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (room_id === 'ba') {
        const sheet = ss.getSheetByName("BA");
        // Column M is 12th column (if A=1).
        // Wait, range B:M.
        // A=1, B=2, ... M=13.
        // updateReason in server.js said 'M'.
        // In server.js updateReason: `range = ${sheetName}!${cellColumn}${row_ref}`
        // If cellColumn is 'M', that's column 13.
        sheet.getRange(parseInt(rowRef), 13).setValue(new_value);
        invalidateCache('BA');
    } else {
        // Default
        const sheet = ss.getSheets()[0];
        // Column K is 11.
        sheet.getRange(parseInt(rowRef), 11).setValue(new_value);
        invalidateCache('Sheet1');
    }

    return responseJSON({
        status: "ok",
        row_ref: rowRef,
        reason: new_value
    });
}

function handleGetRecords(body) {
    const { room_id } = body || {}; // Optional room_id

    let rawRows = [];
    let data = [];

    if (room_id === 'ba') {
        rawRows = getDataWithCache('BA', 'B2:M');
        data = rawRows.map(mapRowBA);
    } else {
        // Default to NBOT (Sheet1)
        rawRows = getDataWithCache('Sheet1', 'A2:K');
        data = rawRows.map(mapRowDefault);
    }

    return responseJSON({ records: data });
}

// --- CACHE HELPERS ---

function getDataWithCache(sheetName, rangeA1) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `DATA_${sheetName}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    // Cache miss
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet;
    if (sheetName === 'Sheet1') {
        sheet = ss.getSheets()[0];
    } else {
        sheet = ss.getSheetByName(sheetName);
    }

    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Construct range dynamically based on last row to avoid empty rows
    // rangeA1 input is like "A2:K", we need to append lastRow
    // Actually, let's just use the columns from input and append lastRow
    const startColChar = rangeA1.split(':')[0].replace(/[0-9]/g, '');
    const endColChar = rangeA1.split(':')[1].replace(/[0-9]/g, '');
    const actualRange = `${startColChar}2:${endColChar}${lastRow}`;

    const values = sheet.getRange(actualRange).getValues();

    try {
        // Cache for 5 minutes
        cache.put(cacheKey, JSON.stringify(values), CACHE_EXPIRATION_SEC);
    } catch (e) {
        // Ignore cache errors (e.g. size limit)
        console.error("Cache put failed: " + e.message);
    }

    return values;
}

function invalidateCache(sheetName) {
    const cache = CacheService.getScriptCache();
    cache.remove(`DATA_${sheetName}`);
}

// --- HELPERS ---

function isDefaultRecordComplete(row) {
    // Required: A-J (indices 0-9)
    for (let i = 0; i <= 9; i++) {
        if (row[i] === "" || row[i] === null || row[i] === undefined) return false;
    }
    return true;
}

function isBARecordComplete(row) {
    // Required: B-L (indices 0-10 in the B:M range)
    for (let i = 0; i <= 10; i++) {
        if (row[i] === "" || row[i] === null || row[i] === undefined) return false;
    }
    return true;
}

function mapRowDefault(row, index) {
    const row_ref = String(index + 2);
    // row is array [A, B, C, ...]
    return {
        row_ref,
        type: 'default',
        A: row[0],
        B: row[1],
        C: row[2],
        D: formatDate(row[3]),
        E: row[4],
        F: row[5],
        G: formatDate(row[6]),
        H: row[7],
        I: row[8],
        J: row[9],
        K: row[10],
        // Normalized
        contract: row[4],
        customer: row[5],
        due_date: formatDate(row[6]),
        install_amt: row[7],
        lob: row[9],
        reason: row[10],
        date_filter: formatDate(row[3])
    };
}

function mapRowBA(row, index) {
    const row_ref = String(index + 2);
    // row is array from B:M. So index 0 is B.
    return {
        row_ref,
        type: 'ba',
        B: row[0],
        C: row[1],
        D: row[2],
        E: row[3],
        F: row[4],
        G: row[5],
        H: row[6],
        I: formatDate(row[7]),
        J: row[8],
        K: row[9],
        L: row[10],
        M: row[11],
        // Normalized
        contract: row[4],
        customer: row[5],
        due_date: formatDate(row[7]),
        install_amt: row[8],
        lob: row[10],
        reason: row[11],
        date_filter: formatDate(row[7]),
        beban: row[2],
        cabang: row[3],
        alamat: row[6],
        ke: row[9]
    };
}

function formatDate(val) {
    if (val instanceof Date) {
        // Return DD/MM/YYYY
        const d = val.getDate().toString().padStart(2, '0');
        const m = (val.getMonth() + 1).toString().padStart(2, '0');
        const y = val.getFullYear();
        return `${d}/${m}/${y}`;
    }
    return val || "";
}
