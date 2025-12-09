# Migration to Google Apps Script (GAS)

This guide explains how to migrate your backend from Node.js/Railway to Google Apps Script.

## 1. Create Google Apps Script Project

1.  Go to [script.google.com](https://script.google.com/).
2.  Click **New Project**.
3.  Name it "FIF App Backend" (or similar).
4.  Rename `Code.gs` to `Code` (it usually is by default).
5.  Copy the content of `backend_gas/Code.js` from this project and paste it into the script editor's `Code.gs`.

## 2. Deploy as Web App

1.  In the GAS editor, click **Deploy** > **New deployment**.
2.  Select type: **Web app**.
3.  Description: "v1".
4.  **Execute as**: "Me" (your email).
5.  **Who has access**: "Anyone" (IMPORTANT: This allows your PWA to access the script without Google Login prompts).
6.  Click **Deploy**.
7.  **Copy the Web App URL** (it starts with `https://script.google.com/macros/s/.../exec`).

## 3. Update Frontend Configuration

1.  Open `frontend/src/config.js`.
2.  Replace the `API_BASE` value with your new Web App URL.
    ```javascript
    export const API_BASE = 'https://script.google.com/macros/s/YOUR_NEW_ID/exec';
    ```

## 4. Re-deploy Frontend

1.  Commit your changes.
2.  Push to your repository.
3.  Trigger a new build on your frontend host (Netlify, Vercel, etc.).

## Notes

- The new backend uses Google Sheets directly. Ensure the `SPREADSHEET_ID` in `Code.gs` matches your actual spreadsheet ID.
- The API now uses `?action=...` query parameters to route requests.
- `POST` requests are sent as `text/plain` to avoid CORS preflight issues, which GAS handles better.
