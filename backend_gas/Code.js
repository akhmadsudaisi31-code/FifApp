const SPREADSHEET_ID = '1pO_ZyP-iDr0I2EKfWfCv5kNJ5KesVPOdaSCIHC53Ejs';

function doGet(e) {
    const action = e.parameter.action;

    if (action === 'dashboard_init') {
        return handleDashboardInit();
    } else if (action === 'get_records') {
        return handleGetRecords();
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

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Default Sheet (NBOT)
    const defaultSheet = ss.getSheets()[0]; // Assuming first sheet
    let defaultData = [];
    if (defaultSheet.getLastRow() >= 2) {
        defaultData = defaultSheet.getRange("A2:K" + defaultSheet.getLastRow()).getValues();
    }

    // BA Sheet
    const baSheet = ss.getSheetByName("BA");
    let baData = [];
    if (baSheet && baSheet.getLastRow() >= 2) {
        baData = baSheet.getRange("B2:M" + baSheet.getLastRow()).getValues();
    }

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
    const { value, date_filter } = body;
    let matched = [];

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (roomId === 'ba') {
        const sheet = ss.getSheetByName("BA");
        if (sheet) {
            const lastRow = sheet.getLastRow();
            if (lastRow >= 2) {
                const rawRows = sheet.getRange("B2:M" + lastRow).getValues();
                matched = rawRows.map(mapRowBA);

                // Filter
                if (value && value.trim() !== '') {
                    const lowerVal = value.toLowerCase();
                    matched = matched.filter(row =>
                        (row.G && row.G.toLowerCase().includes(lowerVal)) ||
                        (row.B && row.B.toLowerCase().includes(lowerVal)) ||
                        (row.C && row.C.toLowerCase().includes(lowerVal))
                    );
                }

                if (date_filter) {
                    // date_filter is YYYY-MM-DD
                    // row.I is Jatuh Tempo (DD/MM/YYYY)
                    const [y, m, d] = date_filter.split('-');
                    const targetDate = `${d}/${m}/${y}`;
                    matched = matched.filter(row => row.I == targetDate); // Loose equality in case of type diff
                }
            }
        }
    } else {
        // Default Room
        const sheet = ss.getSheets()[0];
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
            const rawRows = sheet.getRange("A2:K" + lastRow).getValues();
            matched = rawRows.map(mapRowDefault);

            // Filter
            if (value && value.trim() !== '') {
                const lowerVal = value.toLowerCase();
                matched = matched.filter(row =>
                    (row.F && row.F.toLowerCase().includes(lowerVal)) ||
                    (row.B && row.B.toLowerCase().includes(lowerVal)) ||
                    (row.C && row.C.toLowerCase().includes(lowerVal))
                );
            }

            if (date_filter) {
                // date_filter is YYYY-MM-DD
                // row.G is Due Date (DD/MM/YYYY)
                const [y, m, d] = date_filter.split('-');
                const targetDate = `${d}/${m}/${y}`;
                matched = matched.filter(row => row.G == targetDate);
            }
        }
    }

    return responseJSON({
        room_id: roomId,
        matched_records: matched
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
    } else {
        // Default
        const sheet = ss.getSheets()[0];
        // Column K is 11.
        sheet.getRange(parseInt(rowRef), 11).setValue(new_value);
    }

    return responseJSON({
        status: "ok",
        row_ref: rowRef,
        reason: new_value
    });
}

function handleGetRecords() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const lastRow = sheet.getLastRow();
    let data = [];
    if (lastRow >= 2) {
        const rawRows = sheet.getRange("A2:K" + lastRow).getValues();
        data = rawRows.map(mapRowDefault);
    }

    return responseJSON({ records: data });
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
