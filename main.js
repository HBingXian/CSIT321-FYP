const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const { dialog } = require('electron');
// === OneDrive Services page wiring ===
const ONEDRIVE_TOKEN_PATH = path.join(__dirname, '.onedrive_token.json'); // token file used by js/onedrive_upload

const { encryptFile } = require('./js/file_encrypt');
const { decryptFile } = require('./js/file_decrypt');
const { uploadToDrive } = require('./js/drive_upload');

const { google } = require('googleapis');

//Google auth (keytar-based)
const gAuth = require('./auth/google_drive_auth');

//One drive auth
const { getAccessToken, getValidAccessToken, uploadFileToOneDrive } = require('./js/onedrive_upload');
const { getAuthUrl } = require('./scripts/init_onedrive_token');
const express = require('express');

const express = require('express');
const { getAccessToken } = require('./js/onedrive_upload');
const { getValidAccessToken, uploadFileToOneDrive } = require('./js/onedrive_upload');
const { getAuthUrl } = require('./scripts/init_onedrive_token');

let mainWindow;
let currentUser = null; // Track the currently logged-in user
let currentEncryptionKey = null;//same 
let pendingCloudDecrypt = null; // { provider, fileId, fileName }

// Create main application window
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

//app.whenReady().then(createWindow);
//One drive express server
function startAuthServer() {
  const ex = express();
  const PORT = 3000; // keep OneDrive on 3000

  ex.get('/callback', async (req, res) => {
    const authCode = req.query.code;
    res.send(`<h3>Authorization successful! You can close this window.</h3>`);
    try {
      await getAccessToken(authCode);
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
      // do nothing: OneDrive can still work if an instance is already running
    } else {
      console.error('[OneDrive OAuth] Server error:', err);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  startAuthServer(); // ← Add this
});

// MySQL connection
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

// Log action to activity_logs table
function logAction(username, action, description) {
  const sql = 'INSERT INTO activity_logs (username, action_type, description) VALUES (?, ?, ?)';
  db.query(sql, [username, action, description], (err) => {
    if (err) console.error('Failed to log action:', err);
  });
}

// Handle login
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

        currentUser = user.username; //  Set the logged-in user

        event.reply('login-response', { success: true, user: user.username });
        mainWindow.loadFile('pages/dashboard.html');
      }
    });
  });
});

// Handle logout
ipcMain.on('logout-request', () => {
  currentUser = null;
  if (mainWindow) {
    mainWindow.loadFile('pages/index.html');
  }
});

// Navigate to key generation
ipcMain.on('navigate-to-gen-key', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/gen_key.html').then(() => {
      mainWindow.focus();
    });
  }
});

//navigate to encrypt page
ipcMain.on('navigate-to-encrypt-page', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/encrypt.html');
  }
});


// Back to dashboard
ipcMain.on('home-request', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/dashboard.html').then(() => {
      mainWindow.focus();
    });
  }
});

//navigate to decrypt page
ipcMain.on('navigate-to-decrypt-page', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/decrypt.html');
  }
});

// Handle Encrypt & Upload request
/*
ipcMain.on('request-encrypt-upload', async () => {
    if (!currentUser) {
        console.log('User not logged in');
        return;
    }

    if (!currentEncryptionKey) {
        console.log('Encryption key not ready. Generate your key first.');
        return;
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length === 0) return;

    const inputPath = filePaths[0];
    const outputPath = inputPath + '_encrypted.dat';

    // You need to have the encryptionKey available (ensure it's stored after key generation)
    // Example assuming you store the key globally as currentEncryptionKey:
    encryptFile(inputPath, outputPath, currentEncryptionKey);

    // TODO: Add upload to cloud step here if needed  
});
*/

// Navigate to Decrypt page with context
// ==== Decrypt: context handoff (Files page -> Decrypt page) ====
ipcMain.on('nav:decrypt-with-cloud', (event, ctx) => {
  // ctx = { provider: 'google'|'onedrive', fileId, fileName }
  pendingCloudDecrypt = ctx;
  if (mainWindow) {
    const target = path.join(__dirname, 'pages', 'decrypt.html');
    mainWindow.loadFile(target);
  }
});

ipcMain.handle('decrypt:get-context', async () => pendingCloudDecrypt);

// ==== Decrypt: Cloud -> Local -> Decrypt (invoked from Decrypt page) ====
ipcMain.handle('download-and-decrypt', async (_event, { provider, fileId, fileName, base64Key }) => {
  try {
    // 1) Download encrypted file to temp
    const tmpEncrypted = path.join(app.getPath('temp'), `${fileName || 'downloaded_encrypted.dat'}`);

    if (provider === 'onedrive') {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not connected to OneDrive');
      const resp = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer'
      });
      fs.writeFileSync(tmpEncrypted, Buffer.from(resp.data));
    } else {
      // Google Drive
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

    // 2) Ask where to save decrypted output
    const suggested =
      (fileName || 'file_encrypted.dat').replace(/_encrypted\.dat$/i, '') + '_decrypted';
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Decrypted File As',
      defaultPath: suggested
    });
    if (canceled || !filePath) return { status: 'cancelled' };

    // 3) Decrypt
    await decryptFile(tmpEncrypted, filePath, base64Key);

    return { status: 'ok', message: `Decrypted to ${filePath}` };
  } catch (e) {
    console.error('download-and-decrypt error:', e?.message || e);
    return { status: 'error', message: e?.message || 'Decrypt failed' };
  }
});

// ==== Decrypt: Local-only fallback (used when Decrypt page wasn't given a cloud file) ====
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


// Handle key generation
ipcMain.on('generate-key', (event, passphrase) => {
  if (!currentUser) {
    event.reply('key-status', { message: 'No user logged in' });
    return;
  }

// Generate new random salt
const newSalt = crypto.randomBytes(32);
const hexSalt = newSalt.toString('hex');

// Update salt in the database
const updateSaltSQL = 'UPDATE users SET kdf_salt = ? WHERE username = ?';
db.query(updateSaltSQL, [hexSalt, currentUser], (err) => {
  if (err) {
    console.error('Error updating salt:', err);
    event.reply('key-status', { message: 'Error updating salt' });
    return;
  }

  // Proceed to derive key using PBKDF2 with the new salt
  crypto.pbkdf2(passphrase, newSalt, 600000, 32, 'sha256', (err, derivedKey) => {
    if (err) {
      console.error('Error deriving key:', err);
      return event.reply('key-status', { message: 'Error generating key' });
    }

    const encryptionKey = derivedKey.toString('base64');
    currentEncryptionKey = encryptionKey;

    event.reply('key-status', {
      message: 'New encryption key generated successfully. Please backup your key!',
      encryptionKey
    });

    logAction(currentUser, 'key_generation', 'New encryption key and salt generated.');
  });
});
});

// Handle random key generation
ipcMain.on('generate-random-key', (event) => {
  if (!currentUser) {
    event.reply('key-status', { message: 'No user logged in' });
    return;
  }

  //Generate 32-byte random key
  const randomKey = crypto.randomBytes(32);
  const base64Key = randomKey.toString('base64');

  //Store in memory
  currentEncryptionKey = base64Key;

  //Send response back to frontend
  event.reply('key-status', {
    message: 'Random encryption key generated successfully. Please back it up!',
    encryptionKey: base64Key
  });

  //Log the action (optional)
  logAction(currentUser, 'key_generation', 'Random encryption key was generated.');
});

/* ---------- old encryption code ---------- 
ipcMain.on('encrypt-file-from-page', async (event, encryptionKey) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return;

  const inputPath = filePaths[0];
  const outputPath = inputPath + '_encrypted.dat';

  try {
    encryptFile(inputPath, outputPath, encryptionKey);
    event.sender.send('encryption-done', `File encrypted: ${outputPath}`);

    // Upload to Google Drive after encryption
    console.log("Uploading to Google Drive:", outputPath); // for testing
    uploadToDrive(outputPath);
  } catch (err) {
    console.error('Encryption or upload error:', err);
    event.sender.send('encryption-done', 'Encryption failed.');
  }
});
*/

/*//new encryption code with description
ipcMain.on('encrypt-file-from-page', async (event, data) => {
  const { key: encryptionKey, description } = data;

  console.log('ENCRYPTION KEY TYPE:', typeof encryptionKey, encryptionKey); // Debug

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return;

  const inputPath = filePaths[0];
  const outputPath = inputPath + '_encrypted.dat';

  try {
    encryptFile(inputPath, outputPath, encryptionKey); // Make sure this is using the correct var
    event.sender.send('encryption-done', `File encrypted: ${outputPath}`);

    // Upload to Google Drive with description
    uploadToDrive(outputPath, description);
  } catch (err) {
    console.error('Encryption or upload error:', err);
    event.sender.send('encryption-done', 'Encryption failed.');
  }
}); */  

//New ipc call for new auth flow
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
      const accessToken = await getValidAccessToken();
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

    // Show save location dialog
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

// Navigate to files.html 
ipcMain.on('navigate-to-files', () => {
  mainWindow.loadFile('pages/files.html');  // or adjust path as needed
});

//List / View files ggdrive
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
//List / View files onedrive
ipcMain.on('request-onedrive-files', async (event) => {
  try {
    const accessToken = await getValidAccessToken(); // from ./js/onedrive_upload
    if (!accessToken) return event.sender.send('response-onedrive-files', []);

    // Root listing (change to your folder if needed)
    const resp = await axios.get('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Send raw items; renderer normalizes to table shape
    event.sender.send('response-onedrive-files', resp.data && resp.data.value || []);
  } catch (e) {
    console.error('OneDrive list error:', e?.response?.data || e.message);
    event.sender.send('response-onedrive-files', []);
  }
});

// Google Drive delete
ipcMain.on('delete-google-drive-file', async (event, fileId) => {
  if (!fileId) return console.error('Missing fileId for Google delete');
  const auth = await gAuth.authorizeGoogleFor(currentUser);
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId });
  event.sender.send('file-deleted', fileId);
});

// OneDrive delete
ipcMain.on('delete-onedrive-file', async (event, fileId) => {
  if (!fileId) return console.error('Missing fileId for OneDrive delete');
  const token = await getValidAccessToken();
  await axios.delete(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  event.sender.send('file-deleted', fileId);
});

// Share files
/*ipcMain.on('share-google-drive-file', async (event, { fileId, appUserKey }) => {
  try {
    const auth = await gAuth.authorizeGoogleFor(appUserKey || currentUser);
    const drive = google.drive({ version: 'v3', auth });

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const { data } = await drive.files.get({
      fileId,
      fields: 'webViewLink'
    });

    console.log(`File shared: ${fileId} → ${data.webViewLink}`);
    event.sender.send('share-link-ready', { fileId, link: data.webViewLink });

  } catch (err) {
    console.error('Share error:', err.message);
  }
});    */

// New ipc for google drive consent page.
// Runs full Google OAuth for the current user and persists tokens via keytar
async function runGoogleOAuthFor(appUserKey) {
  if (!appUserKey) throw new Error('No app user is logged in.');

  const oAuth2 = gAuth.newOAuthClient();

  // Grab the localhost redirect from credentials.json
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

  // Spin up a tiny local server to catch the OAuth redirect
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

  // Exchange code for tokens and save them per user
  const { tokens } = await oAuth2.getToken(code);
  oAuth2.setCredentials(tokens);
  await gAuth.saveGoogleTokens(oAuth2, appUserKey);
  return true;
}

// IPC: start OAuth for the current user (or explicit key)
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

  // Google (keep your existing logic)
  const googleConnected = key ? await gAuth.isGoogleConnected(key) : false;

  // OneDrive: try a silent refresh; if that fails, fall back to token file presence
  let oneDriveConnected = false;
  try {
    const token = await getValidAccessToken();
    oneDriveConnected = !!token;
  } catch {
    oneDriveConnected = fs.existsSync(ONEDRIVE_TOKEN_PATH);
  }

  return {
    googleConnected,
    oneDriveConnected,
    onedriveConnected: oneDriveConnected, // alias for renderer code using a different casing
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

//IPc block for one drive 
ipcMain.handle('start-onedrive-upload', async (event) => {
  let accessToken = await getValidAccessToken();

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

//Services page One Drive 
// Start OneDrive OAuth (Connect)
ipcMain.removeHandler('oauth:onedrive');
ipcMain.handle('oauth:onedrive', async () => {
  try {
    // already connected?
    const token = await getValidAccessToken();
    if (token) return true;

    // open browser to start login
    const authUrl = getAuthUrl();
    await shell.openExternal(authUrl);
    return true;
  } catch (e) {
    console.error('oauth:onedrive error:', e);
    return false;
  }
});

// Disconnect OneDrive (delete token file)
ipcMain.removeHandler('cloud:disconnect-onedrive');
ipcMain.handle('cloud:disconnect-onedrive', async () => {
  try {
    if (fs.existsSync(ONEDRIVE_TOKEN_PATH)) fs.unlinkSync(ONEDRIVE_TOKEN_PATH);
    return { ok: true };
  } catch (e) {
    console.error('disconnect onedrive error:', e);
    return { ok: false, error: e.message };
  }
});

// Navigate to services.html (Manage Connections)
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

  // Close app
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
