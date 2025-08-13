// js/drive_upload.js
const { google } = require('googleapis');
const fs = require('fs');

async function uploadToDrive(filePath, description, auth) {
  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: require('path').basename(filePath),
    description: description || '',
  };

  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(filePath),
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });

  console.log('Uploaded file ID:', res.data.id);
  return res.data.id;
}

module.exports = { uploadToDrive };
