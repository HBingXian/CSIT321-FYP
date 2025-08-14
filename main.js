const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const { dialog } = require('electron');
const ONEDRIVE_TOKEN_PATH = path.join(__dirname, '.onedrive_token.json');

const { encryptFile } = require('./js/file_encrypt');
const { decryptFile } = require('./js/file_decrypt');
const { uploadToDrive } = require('./js/drive_upload');

const { google } = require('googleapis');

const gAuth = require('./auth/google_drive_auth');

ipcMain.handle('oauth:google', async () => {
  try {
    await gAuth.beginGoogleOAuth(currentUser);
    return true;
  } catch (e) {
    console.error('oauth:google error:', e);
    return false;
  }
});

const { getAccessToken, getValidAccessToken, uploadFileToOneDrive, clearOneDriveToken } = require('./js/onedrive_upload');
const { getAuthUrl } = require('./scripts/init_onedrive_token');
const express = require('express');

let mainWindow;
let currentUser = null;
let currentEncryptionKey = null;
let pendingCloudDecrypt = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('pages/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function startAuthServer() {
  const ex = express();
  const PORT = 3000;

  ex.get('/callback', async (req, res) => {
    const authCode = req.query.code;
    res.send(`<h3>Authorization successful! You can close this window.</h3>`);
    try {
      await getAccessToken(authCode, currentUser);
      if (mainWindow) mainWindow.webContents.send('onedrive-auth-success');
    } catch (err) {
      console.error('OAuth error:', err);
      if (mainWindow) mainWindow.webContents.send('onedrive-auth-failed', err.message);
    }
  });

  const server = ex.listen(PORT, () => {
    console.log(`OAuth callback server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`[OneDrive OAuth] Port ${PORT} already in use. Not starting a second server.`);
    } else {
      console.error('[OneDrive OAuth] Server error:', err);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  startAuthServer();
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'crypterhelper_db'
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    return;
  }
  console.log('Connected to MySQL');
});

function logAction(username, action, description) {
  const sql = 'INSERT INTO activity_logs (username, action_type, description) VALUES (?, ?, ?)';
  db.query(sql, [username, action, description], (err) => {
    if (err) console.error('Failed to log action:', err);
  });
}

ipcMain.on('login-attempt', (event, { username, password }) => {
  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      event.reply('login-response', { success: false, error: 'Database error' });
      return;
    }

    if (results.length === 0) {
      event.reply('login-response', { success: false, error: 'User not found' });
      return;
    }

    const user = results[0];

    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) {
        console.error('Bcrypt error:', err);
        event.reply('login-response', { success: false, error: 'Hash error' });
        return;
      }

      if (!isMatch) {
        event.reply('login-response', { success: false, error: 'Invalid password' });
      } else {
        currentUser = user.username;
        event.reply('login-response', { success: true, user: user.username });
        mainWindow.loadFile('pages/dashboard.html');
      }
    });
  });
});

ipcMain.on('logout-request', () => {
  currentUser = null;
  if (mainWindow) {
    mainWindow.loadFile('pages/index.html');
  }
});

ipcMain.on('navigate-to-gen-key', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/gen_key.html').then(() => {
      mainWindow.focus();
    });
  }
});

ipcMain.on('navigate-to-rec-key', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/rec_key.html').then(() => {
      mainWindow.focus();
    });
  }
});

ipcMain.on('navigate-to-encrypt-page', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/encrypt.html');
  }
});

ipcMain.on('home-request', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/dashboard.html').then(() => {
      mainWindow.focus();
    });
  }
});

ipcMain.on('navigate-to-decrypt-page', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/decrypt.html');
  }
});

ipcMain.on('nav:decrypt-with-cloud', (event, ctx) => {
  pendingCloudDecrypt = ctx;
  if (mainWindow) {
    const target = path.join(__dirname, 'pages', 'decrypt.html');
    mainWindow.loadFile(target);
  }
});

ipcMain.handle('decrypt:get-context', async () => pendingCloudDecrypt);

ipcMain.handle('download-and-decrypt', async (_event, { provider, fileId, fileName, base64Key }) => {
  try {
    const tmpEncrypted = path.join(app.getPath('temp'), `${fileName || 'downloaded_encrypted.dat'}`);

    if (provider === 'onedrive') {
      const token = await getValidAccessToken(currentUser);
      if (!token) throw new Error('Not connected to OneDrive');
      const resp = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer'
      });
      fs.writeFileSync(tmpEncrypted, Buffer.from(resp.data));
    } else {
      const auth = await gAuth.authorizeGoogleFor(currentUser);
      const drive = google.drive({ version: 'v3', auth });
      const dest = fs.createWriteStream(tmpEncrypted);
      await new Promise((resolve, reject) => {
        drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' }, (err, res) => {
          if (err) return reject(err);
          res.data.pipe(dest);
          dest.on('finish', resolve);
          dest.on('error', reject);
        });
      });
    }

    const suggested =
      (fileName || 'file_encrypted.dat').replace(/_encrypted\.dat$/i, '') + '_decrypted';
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Decrypted File As',
      defaultPath: suggested
    });
    if (canceled || !filePath) return { status: 'cancelled' };

    await decryptFile(tmpEncrypted, filePath, base64Key);

    return { status: 'ok', message: `Decrypted to ${filePath}` };
  } catch (e) {
    console.error('download-and-decrypt error:', e?.message || e);
    return { status: 'error', message: e?.message || 'Decrypt failed' };
  }
});

ipcMain.on('decrypt-file-from-page', async (event, encryptionKey) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return;

  const encryptedPath = filePaths[0];

  const { canceled: saveCanceled, filePath: savePath } = await dialog.showSaveDialog({
    title: 'Save Decrypted File As',
    defaultPath: encryptedPath.replace('_encrypted.dat', '_decrypted.txt'),
    buttonLabel: 'Save Decrypted File'
  });
  if (saveCanceled || !savePath) return;

  try {
    await decryptFile(encryptedPath, savePath, encryptionKey);
    event.sender.send('decryption-done', `File decrypted and saved to: ${savePath}`);
  } catch (err) {
    console.error('Local decrypt error:', err);
    event.sender.send('decryption-done', `Decryption failed: ${err.message}`);
  }
});

ipcMain.on('generate-key', (event, passphrase) => {
  if (!currentUser) {
    event.reply('key-status', { message: 'No user logged in' });
    return;
  }

  const sql = 'SELECT kdf_salt FROM users WHERE username = ?';
  db.query(sql, [currentUser], (err, results) => {
    if (err || results.length === 0) {
      console.error('Error retrieving salt:', err);
      event.reply('key-status', { message: 'Error retrieving salt' });
      return;
    }

    const salt = Buffer.from(results[0].kdf_salt, 'hex');
    const iterations = 100000;
    const keyLength = 32;
    const digest = 'sha256';

    crypto.pbkdf2(passphrase, salt, iterations, keyLength, digest, (err, derivedKey) => {
      if (err) {
        console.error('Error deriving key:', err);
        return event.reply('key-status', { message: 'Error generating key' });
      }

      bcrypt.hash(passphrase, 10, (err, hashedPassphrase) => {
        if (err) {
          console.error('Error hashing passphrase:', err);
          return event.reply('key-status', { message: 'Error hashing passphrase' });
        }

        const sql = 'UPDATE users SET passphrase_hash = ? WHERE username = ?';
        db.query(sql, [hashedPassphrase, currentUser], (err) => {
          if (err) {
            console.error('DB error:', err);
            event.reply('key-status', { message: 'Error storing passphrase hash' });
            return;
          }

          const encryptionKey = derivedKey.toString('base64');
          currentEncryptionKey = encryptionKey;
          event.reply('key-status', {
            message: 'Encryption key generated successfully. Please backup your key!',
            encryptionKey
          });
          logAction(currentUser, 'key_generation', 'Encryption key was generated successfully.');
        });
      });
    });
  });
});

ipcMain.on('recover-key', (event, { username, password, passphrase }) => {
  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      event.reply('recover-status', { success: false, message: 'Database error' });
      return;
    }

    if (results.length === 0) {
      event.reply('recover-status', { success: false, message: 'User not found' });
      return;
    }

    const user = results[0];

    bcrypt.compare(password, user.password_hash, (err, isPasswordMatch) => {
      if (err || !isPasswordMatch) {
        return event.reply('recover-status', { success: false, message: 'Invalid password' });
      }

      bcrypt.compare(passphrase, user.passphrase_hash, (err, isPassphraseMatch) => {
        if (err || !isPassphraseMatch) {
          return event.reply('recover-status', { success: false, message: 'Invalid passphrase' });
        }

        const salt = Buffer.from(user.kdf_salt, 'hex');
        const iterations = 100000;
        const keyLength = 32;
        const digest = 'sha256';

        crypto.pbkdf2(passphrase, salt, iterations, keyLength, digest, (err, derivedKey) => {
          if (err) {
            console.error('Error deriving key:', err);
            return event.reply('recover-status', { success: false, message: 'Error deriving key' });
          }

          const encryptionKey = derivedKey.toString('base64');
          currentEncryptionKey = encryptionKey;
          logAction(username, 'key_recovery', 'Encryption key was recovered successfully.');
          event.reply('recover-status', {
            success: true,
            message: 'Encryption key recovered successfully',
            encryptionKey
          });
        });
      });
    });
  });
});

ipcMain.on('encrypt-file-from-page', async (event, data) => {
  const { key: encryptionKey, description, destination } = data;

  console.log('ENCRYPTION KEY TYPE:', typeof encryptionKey, encryptionKey);

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return;

  const inputPath = filePaths[0];
  const outputPath = inputPath + '_encrypted.dat';

  try {
    encryptFile(inputPath, outputPath, encryptionKey);

    if (destination === 'google') {
      const auth = await gAuth.authorizeGoogleFor(currentUser);
      await uploadToDrive(outputPath, description, auth);
      event.sender.send('encryption-done', `File encrypted and uploaded to Google Drive.`);
    } else if (destination === 'onedrive') {
      const accessToken = await getValidAccessToken(currentUser);
      if (!accessToken) {
        const authUrl = getAuthUrl();
        require('electron').shell.openExternal(authUrl);
        event.sender.send('encryption-done', 'Please sign in to OneDrive in browser and try again.');
        return;
      }

      await uploadFileToOneDrive(accessToken, outputPath);
      event.sender.send('encryption-done', `File encrypted and uploaded to OneDrive.`);
    } else {
      event.sender.send('encryption-done', `File encrypted locally at: ${outputPath}`);
    }

  } catch (err) {
    console.error('Encryption or upload error:', err);
    event.sender.send('encryption-done', 'Encryption or upload failed.');
  }
});

ipcMain.on('decrypt-file-from-page', async (event, encryptionKey) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length === 0) return;

    const encryptedPath = filePaths[0];

    const { canceled: saveCanceled, filePath: savePath } = await dialog.showSaveDialog({
        title: 'Save Decrypted File As',
        defaultPath: encryptedPath.replace('_encrypted.dat', '_decrypted.txt'),
        buttonLabel: 'Save Decrypted File'
    });

    if (saveCanceled || !savePath) return;

    try {
        decryptFile(encryptedPath, savePath, encryptionKey);
        event.sender.send('decryption-done', ` File decrypted and saved to: ${savePath}`);
    } catch (err) {
        event.sender.send('decryption-done', ` Decryption failed: ${err.message}`);
    }
});

ipcMain.on('navigate-to-files', () => {
  mainWindow.loadFile('pages/files.html');
});

ipcMain.on('request-google-drive-files', async (event, appUserKey) => {
  try {
    const auth = await gAuth.authorizeGoogleFor(appUserKey || currentUser);
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
      q: "'1MHjdMCbEyY393GZL-_N1f5VBfp8zK0m8' in parents and trashed = false",
      fields: 'files(id, name, size, modifiedTime, description)',
      spaces: 'drive',
      pageSize: 1000
    });

    event.reply('response-google-drive-files', res.data.files);
  } catch (err) {
    console.error('Drive List Error:', err);
    event.reply('response-google-drive-files', []);
  }
});

ipcMain.on('request-onedrive-files', async (event) => {
  try {
    const accessToken = await getValidAccessToken(currentUser);
    if (!accessToken) return event.sender.send('response-onedrive-files', []);

    const resp = await axios.get('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    event.sender.send('response-onedrive-files', resp.data && resp.data.value || []);
  } catch (e) {
    console.error('OneDrive list error:', e?.response?.data || e.message);
    event.sender.send('response-onedrive-files', []);
  }
});

ipcMain.on('delete-google-drive-file', async (event, fileId) => {
  if (!fileId) return console.error('Missing fileId for Google delete');
  const auth = await gAuth.authorizeGoogleFor(currentUser);
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId });
  event.sender.send('file-deleted', fileId);
});

ipcMain.on('delete-onedrive-file', async (event, fileId) => {
  if (!fileId) return console.error('Missing fileId for OneDrive delete');
  const token = await getValidAccessToken(currentUser);
  await axios.delete(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  event.sender.send('file-deleted', fileId);
});

async function runGoogleOAuthFor(appUserKey) {
  if (!appUserKey) throw new Error('No app user is logged in.');

  const oAuth2 = gAuth.newOAuthClient();

  const redirectUri =
    oAuth2.redirectUri || oAuth2.redirect_uris?.[0] || oAuth2.redirectUri_;
  if (!redirectUri || !redirectUri.startsWith('http://localhost:')) {
    throw new Error('credentials.json must have a http://localhost:<port> redirect URI');
  }
  const urlObj = new URL(redirectUri);
  const listenPort = Number(urlObj.port);

  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  const authUrl = oAuth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${listenPort}`);
      const codeParam = reqUrl.searchParams.get('code');
      const errorParam = reqUrl.searchParams.get('error');

      if (errorParam) {
        res.writeHead(400, {'Content-Type': 'text/html'});
        res.end('<h3>Google sign-in failed.</h3>You can close this window.');
        server.close();
        return reject(new Error(`OAuth error: ${errorParam}`));
      }

      if (codeParam) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<h3>Google sign-in successful.</h3>You can close this window.');
        server.close();
        return resolve(codeParam);
      }

      res.writeHead(404); res.end();
    });

    server.listen(listenPort, () => {
      shell.openExternal(authUrl).catch(reject);
    });
    server.on('error', reject);
  });

  const { tokens } = await oAuth2.getToken(code);
  oAuth2.setCredentials(tokens);
  await gAuth.saveGoogleTokens(oAuth2, appUserKey);
  return true;
}

ipcMain.removeHandler('oauth:google');
ipcMain.handle('oauth:google', async (_e, appUserKey) => {
  try {
    const key = appUserKey || currentUser;
    const ok = await runGoogleOAuthFor(key);
    return !!ok;
  } catch (err) {
    console.error('[oauth:google] error:', err);
    return false;
  }
});

ipcMain.removeHandler('cloud:get-status');
ipcMain.handle('cloud:get-status', async (_e, appUserKey) => {
  const key = appUserKey || currentUser;

  const googleConnected = key ? await gAuth.isGoogleConnected(key) : false;

  let oneDriveConnected = false;
  try {
    const token = await getValidAccessToken(key);
    oneDriveConnected = !!token;
  } catch {
    oneDriveConnected = false;
  }

  return {
    googleConnected,
    oneDriveConnected,
    onedriveConnected: oneDriveConnected,
    defaultProvider: ''
  };
});

ipcMain.removeHandler('cloud:disconnect-google');
ipcMain.handle('cloud:disconnect-google', async (_e, appUserKey) => {
  const key = appUserKey || currentUser;
  if (!key) return { ok: false };
  await gAuth.disconnectGoogle(key);
  return { ok: true };
});

ipcMain.handle('start-onedrive-upload', async (event) => {
  let accessToken = await getValidAccessToken(currentUser);

  if (!accessToken) {
    const authUrl = getAuthUrl();
    require('electron').shell.openExternal(authUrl);
    return { status: 'auth_required' };
  }

  const result = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'cancelled' };
  }

  const selectedFile = result.filePaths[0];
  const outputPath = selectedFile + '_encrypted.dat';
  if (!currentEncryptionKey) {
    return { status: 'no_key', message: 'Encryption key not available. Generate or load a key first.' };
  }

  await encryptFile(selectedFile, outputPath, currentEncryptionKey);
  const uploadResponse = await uploadFileToOneDrive(accessToken, outputPath);
  return { status: 'success', fileName: uploadResponse.name };
});

ipcMain.removeHandler('oauth:onedrive');
ipcMain.handle('oauth:onedrive', async () => {
  try {
    const token = await getValidAccessToken(currentUser);
    if (token) return true;
    const authUrl = getAuthUrl();
    await shell.openExternal(authUrl);
    return true;
  } catch (e) {
    console.error('oauth:onedrive error:', e);
    return false;
  }
});

ipcMain.removeHandler('cloud:disconnect-onedrive');
ipcMain.handle('cloud:disconnect-onedrive', async () => {
  try {
    await clearOneDriveToken(currentUser);
    return { ok: true };
  } catch (e) {
    console.error('disconnect onedrive error:', e);
    return { ok: false, error: e.message };
  }
});

ipcMain.on('navigate-to-services', (event) => {
  console.log('🔁 IPC received: navigate-to-services');

  if (mainWindow) {
    mainWindow.loadFile('pages/services.html')
      .then(() => {
        console.log('Loaded: services.html');
        mainWindow.focus();
      })
      .catch(err => {
        console.error('Failed to load services.html:', err);
        event.sender.send('navigation-error', 'Failed to load services page');
      });
  } else {
    console.warn('mainWindow not defined when trying to navigate to services');
    event.sender.send('navigation-error', 'Main window is not available');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
