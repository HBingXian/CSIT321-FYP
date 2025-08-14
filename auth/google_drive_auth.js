// auth/google_drive_auth.js
const fs = require('fs');
const path = require('path');
const keytar = require('keytar');
const { google } = require('googleapis');
const http = require('http');
const { URL } = require('url');
const { shell } = require('electron');

const SERVICE = 'SecureCloud:GoogleDrive';
const CREDS_PATH = path.join(__dirname, '../credentials.json');

function newOAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = creds.installed;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

async function beginGoogleOAuth(appUserKey) {
  if (!appUserKey) throw new Error('beginGoogleOAuth: missing appUserKey');

  const oAuth2 = newOAuthClient();

  // Determine localhost port from credentials.json redirect_uris[0]
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const redirectUri = (creds.installed && creds.installed.redirect_uris && creds.installed.redirect_uris[0]) || '';
  if (!redirectUri.startsWith('http://localhost:')) {
    throw new Error('credentials.json must include a http://localhost:<port>/callback redirect URI');
  }
  const listenPort = Number(new URL(redirectUri).port);

  // Request Drive scope
  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  const authUrl = oAuth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });

  // local server to catch the code
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, `http://localhost:${listenPort}`);
        const codeParam = u.searchParams.get('code');
        const errParam = u.searchParams.get('error');

        if (errParam) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h3>Google sign-in failed.</h3>You can close this window.');
          server.close(); return reject(new Error(errParam));
        }
        if (codeParam) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h3>Google sign-in successful.</h3>You can close this window.');
          server.close(); return resolve(codeParam);
        }
        res.writeHead(404); res.end();
      } catch (e) {
        try { server.close(); } catch {}
        reject(e);
      }
    });

    server.listen(listenPort, () => shell.openExternal(authUrl).catch(reject));
    server.on('error', reject);
  });

  // Exchange code → tokens, save per user (reuses your existing helper)
  const { tokens } = await oAuth2.getToken(code);
  oAuth2.setCredentials(tokens);
  await saveGoogleTokens(oAuth2, appUserKey); // persists to keytar under this user

  // Keep tokens fresh if googleapis refreshes them later
  oAuth2.on('tokens', async (t) => {
    const merged = { ...(oAuth2.credentials || {}), ...t };
    await keytar.setPassword(SERVICE, `google_${appUserKey}`, JSON.stringify(merged));
  });

  return true;
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
  beginGoogleOAuth
};
