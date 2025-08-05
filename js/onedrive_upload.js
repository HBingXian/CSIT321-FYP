const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOKEN_PATH = path.join(__dirname, '../.onedrive_token.json');

const CLIENT_ID = 'cca1ab0b-d9ac-49a7-888c-1ccb40568d6b';
const CLIENT_SECRET = 'Zwl8Q~sefTJE3jQ50sAqBpFYMBg_cAcKRWn8PbmA';
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'Files.ReadWrite.All offline_access User.Read';

// Save token to disk
function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}

// Load token from disk
function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH));
}

// Exchange auth code for token (after user logs in)
async function getAccessToken(authCode) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('scope', SCOPES);
  params.append('code', authCode);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('grant_type', 'authorization_code');
  params.append('client_secret', CLIENT_SECRET);

  const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  saveToken(response.data);
  return response.data.access_token;
}

// Refresh token
async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('scope', SCOPES);
  params.append('refresh_token', refreshToken);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('grant_type', 'refresh_token');
  params.append('client_secret', CLIENT_SECRET);

  const res = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  saveToken(res.data);
  return res.data.access_token;
}

// Get access token (valid or freshly refreshed)
async function getValidAccessToken() {
  const tokenData = loadToken();
  if (!tokenData || !tokenData.refresh_token) return null;

  try {
    return await refreshAccessToken(tokenData.refresh_token);
  } catch (err) {
    console.error('Token refresh failed:', err.message);
    return null;
  }
}

// Upload encrypted file
async function uploadFileToOneDrive(accessToken, filePath) {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);

  const response = await axios.put(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`,
    fileData,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      }
    }
  );

  return response.data;
}

module.exports = {
  getAccessToken,
  getValidAccessToken,
  uploadFileToOneDrive
};
