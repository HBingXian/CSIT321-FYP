// auth/google_drive_auth.js
const fs = require('fs');
const path = require('path');
const keytar = require('keytar');
const { google } = require('googleapis');

const SERVICE = 'SecureCloud:GoogleDrive';
const CREDS_PATH = path.join(__dirname, '../credentials.json');

function newOAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = creds.installed;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

async function saveGoogleTokens(auth, appUserKey) {
  const tokens = auth.credentials || {};
  await keytar.setPassword(SERVICE, `google_${appUserKey}`, JSON.stringify(tokens));
  return true;
}

async function authorizeGoogleFor(appUserKey) {
  const json = await keytar.getPassword(SERVICE, `google_${appUserKey}`);
  if (!json) throw new Error('Google Drive not connected for this user');
  const tokens = JSON.parse(json);

  const oAuth2 = newOAuthClient();
  oAuth2.setCredentials(tokens);
  oAuth2.on('tokens', async (t) => {
    const merged = { ...tokens, ...t };
    await keytar.setPassword(SERVICE, `google_${appUserKey}`, JSON.stringify(merged));
  });
  return oAuth2;
}

async function isGoogleConnected(appUserKey) {
  return !!(await keytar.getPassword(SERVICE, `google_${appUserKey}`));
}
async function disconnectGoogle(appUserKey) {
  await keytar.deletePassword(SERVICE, `google_${appUserKey}`);
  return true;
}

module.exports = {
  newOAuthClient,
  saveGoogleTokens,
  authorizeGoogleFor,
  isGoogleConnected,
  disconnectGoogle,
};
