// js/onedrive_upload.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { setOneDriveToken, getOneDriveToken, deleteOneDriveToken } = require('./token_store');

const creds = require('../credentials.json'); // must contain your MS app creds
const { onedrive } = creds || {};
if (!onedrive || !onedrive.client_id || !onedrive.client_secret || !onedrive.redirect_uri) {
  throw new Error('credentials.json must have { onedrive: { client_id, client_secret, redirect_uri } }');
}
const { client_id, client_secret, redirect_uri } = onedrive;

function withExpiry(token) {
  const expires_at = Date.now() + ((token.expires_in || 3600) - 60) * 1000;
  return { ...token, expires_at };
}

async function getAccessToken(authCode, userKey) {
  if (!userKey) throw new Error('getAccessToken requires userKey');
  const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const params = new URLSearchParams({
    client_id, client_secret, redirect_uri,
    code: authCode, grant_type: 'authorization_code'
  });
  const { data } = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const tok = withExpiry(data);
  await setOneDriveToken(userKey, tok);
  return tok.access_token;
}

async function getValidAccessToken(userKey) {
  if (!userKey) throw new Error('getValidAccessToken requires userKey');
  let tok = await getOneDriveToken(userKey);
  if (tok && tok.expires_at && tok.expires_at > Date.now()) return tok.access_token;

  if (tok && tok.refresh_token) {
    const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams({
      client_id, client_secret, redirect_uri,
      refresh_token: tok.refresh_token, grant_type: 'refresh_token'
    });
    const { data } = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    tok = withExpiry({ ...tok, ...data });
    await setOneDriveToken(userKey, tok);
    return tok.access_token;
  }
  return null;
}

async function clearOneDriveToken(userKey) {
  await deleteOneDriveToken(userKey);
}

async function uploadFileToOneDrive(accessToken, filePath) {
  const fileName = path.basename(filePath);
  const stream = fs.createReadStream(filePath);
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`;
  const { data } = await axios.put(url, stream, { headers: { Authorization: `Bearer ${accessToken}` } });
  return data; // includes { id, name, ... }
}

module.exports = { getAccessToken, getValidAccessToken, clearOneDriveToken, uploadFileToOneDrive };
