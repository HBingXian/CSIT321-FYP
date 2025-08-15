// js/drive_upload.js
const { google } = require('googleapis');

// This module handles uploading files to Google Drive.
// It uses the Google Drive API and requires OAuth2 authentication.
// Make sure to have 'credentials.json' in the same directory as this file.

const fs = require('fs');
const path = require('path');

const FOLDER_NAME = 'CrypterHelperUploads';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Ensure a folder named CrypterHelperUploads exists in the user's My Drive root.
 * Returns the folderId.
 */
async function ensureUploadFolder(drive) {
  // Look for an existing folder in the root named CrypterHelperUploads
  const { data } = await drive.files.list({
    q: [
      `name='${FOLDER_NAME}'`,
      `mimeType='${FOLDER_MIME}'`,
      `'root' in parents`,
      'trashed=false'
    ].join(' and '),
    fields: 'files(id, name)',
    pageSize: 1,
    // If you later need Shared Drives, add: includeItemsFromAllDrives: true, supportsAllDrives: true
  });

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create the folder in the root if not found
  const createRes = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: FOLDER_MIME,
      parents: ['root'],
    },
    fields: 'id, name',
  });

  return createRes.data.id;
}

async function uploadToDrive(filePath, description, auth) {
  const drive = google.drive({ version: 'v3', auth });

  // Ensure destination folder exists (or create it)
  const folderId = await ensureUploadFolder(drive);

  const fileMetadata = {
    name: path.basename(filePath),
    description: description || '',
    parents: [folderId], // <-- upload into CrypterHelperUploads
  };

  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(filePath),
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, parents',
  });

  console.log('Uploaded file ID:', res.data.id, '→ folder:', folderId);
  return res.data.id;
}

module.exports = { uploadToDrive };
