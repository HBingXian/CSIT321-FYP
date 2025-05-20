const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const open = require('open');

const TOKEN_PATH = path.join(__dirname, 'token.json'); // will be created after login

function authorize(callback) {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check for existing token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    callback(oAuth2Client);
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });

    // Open browser for login
    open(authUrl);
    console.log('Authorize this app and paste the code below.');

    // Prompt user to paste code
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('Enter the code from that page here: ', (code) => {
      readline.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        callback(oAuth2Client);
      });
    });
  }
}

function uploadFile(auth, filePath) {
  const drive = google.drive({ version: 'v3', auth });
  const fileMetadata = {
    name: path.basename(filePath),
  };
  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(filePath),
  };

  drive.files.create(
    {
      resource: fileMetadata,
      media: media,
      fields: 'id',
    },
    (err, file) => {
      if (err) {
        console.error('Upload error:', err);
      } else {
        console.log(`File uploaded. File ID: ${file.data.id}`);
      }
    }
  );
}

// Public function to use from main.js
function uploadToDrive(filePath) {
    console.log("uploadToDrive() called with:", filePath);  // Add this
  authorize((auth) => uploadFile(auth, filePath));
}

module.exports = { uploadToDrive };
