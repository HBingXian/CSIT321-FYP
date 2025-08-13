const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const crypto = require('crypto');
const { dialog } = require('electron');

const { encryptFile } = require('./js/file_encrypt');
const { decryptFile } = require('./js/file_decrypt');
const { uploadToDrive } = require('./js/drive_upload');

const { google } = require('googleapis');

// NEW: per-user Google auth helpers (keytar-based)
const gAuth = require('./auth/google_drive_auth');

const express = require('express');
const { getAccessToken } = require('./js/onedrive_upload');
const { getValidAccessToken, uploadFileToOneDrive } = require('./js/onedrive_upload');
const { getAuthUrl } = require('./scripts/init_onedrive_token');
let mainWindow;
let currentUser = null; // Track the currently logged-in user
let currentEncryptionKey = null;//same 


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

// Start app
app.whenReady().then(() => {
  createWindow();
  startAuthServer(); // <- launch Express to listen for /callback
});

// Onedrive auth server
function startAuthServer() {
  const app = express();
  const PORT = 3000;

  app.get('/callback', async (req, res) => {
    const authCode = req.query.code;

    res.send(`<h3>Authorization successful! You can close this window.</h3>`);

    try {
      await getAccessToken(authCode); // exchanges code for access + refresh token and saves it
      mainWindow.webContents.send('onedrive-auth-success');
    } catch (err) {
      console.error('OAuth error:', err);
      mainWindow.webContents.send('onedrive-auth-failed', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`OAuth callback server running on http://localhost:${PORT}`);
  });
}

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

ipcMain.handle('upload-to-google-drive', async (event, filePath) => {
  try {
    await uploadFileToGoogleDrive(filePath); // your existing function
    return { status: 'success' };
  } catch (err) {
    console.error('Google Drive Upload Error:', err);
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('encrypt-file-from-page-to', async (event, { encryptionKey, destination }) => {
  try {
    // 1) Let user choose source file (same as your manual flow)
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length === 0) return { status: 'cancelled' };

    const inputPath = filePaths[0];
    const outputPath = inputPath + '_encrypted.dat';

    // 2) Encrypt with user-supplied key (same as your manual flow)
    await encryptFile(inputPath, outputPath, encryptionKey);

    // Ensure the file is really on disk before using it
    let waited = 0;
    while (!fs.existsSync(outputPath) && waited < 3000) {
      await new Promise(r => setTimeout(r, 100));
      waited += 100;
    }
    if (!fs.existsSync(outputPath)) {
      return { status: 'error', message: 'Encrypted file was not created.' };
    }

    // 3) Destination routing
    if (destination === 'local') {
      return { status: 'local_only', message: 'Encrypted locally.' };
    }

    if (destination === 'google') {
      await uploadToDrive(outputPath); // your existing function
      return { status: 'success', message: 'Uploaded to Google Drive.' };
    }

    if (destination === 'onedrive') {
      let accessToken = await getValidAccessToken();
      if (!accessToken) {
        // Kick off login; user clicks again after auth
        shell.openExternal(getAuthUrl());
        return { status: 'auth_required' };
      }
      await uploadFileToOneDrive(accessToken, outputPath);
      return { status: 'success', message: 'Uploaded to OneDrive.' };
    }

    // Fallback
    return { status: 'error', message: 'Unknown destination.' };
  } catch (err) {
    console.error('encrypt-file-from-page-to error:', err);
    return { status: 'error', message: err?.message || 'Unexpected error' };
  }
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
        currentUser = user.username; //Set the logged-in user
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
        console.log('Encryption key not ready. Generate or recover your key first.');
        return;
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length === 0) return;

    const inputPath = filePaths[0];
    const outputPath = inputPath + '_encrypted.dat';

    // You need to have the encryptionKey available (ensure it's stored after key generation or recovery)
    // Example assuming you store the key globally as currentEncryptionKey:
    encryptFile(inputPath, outputPath, currentEncryptionKey);

    // TODO: Add upload to cloud step here if needed  
});
*/

// Handle Download & Decrypt request
ipcMain.on('request-download-decrypt', async () => {
    if (!currentUser) {
        console.log('User not logged in');
        return;
    }

    if (!currentEncryptionKey) {
        console.log('Encryption key not ready. Generate or recover your key first.');
        return;
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length === 0) return;

    const encryptedPath = filePaths[0];

    // Show Save As dialog
    const { canceled: saveCanceled, filePath: savePath } = await dialog.showSaveDialog({
        title: 'Save Decrypted File As',
        defaultPath: encryptedPath.replace('_encrypted.dat', '_decrypted.txt'),
        buttonLabel: 'Save Decrypted File'
    });

    if (saveCanceled || !savePath) return;

    decryptFile(encryptedPath, savePath, currentEncryptionKey);

    console.log('Decrypted file saved to:', savePath);
});


// Handle key generation
ipcMain.on('generate-key', (event, passphrase) => {
  if (!currentUser) {
    event.reply('key-status', { message: 'No user logged in' });
    return;
  }

  // Retrieve salt from the database for the current user
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

    // Hash the passphrase using PBKDF2 and the retrieved salt
    crypto.pbkdf2(passphrase, salt, iterations, keyLength, digest, (err, derivedKey) => {
      if (err) {
        console.error('Error deriving key:', err);
        return event.reply('key-status', { message: 'Error generating key' });
      }

      // Store the hashed passphrase in the database
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

          const encryptionKey = derivedKey.toString('base64'); // Store encryption key
          currentEncryptionKey = encryptionKey;  // ✔ Store globally for later use
          event.reply('key-status', {
            message: 'Encryption key generated successfully. Please backup your key!',
            encryptionKey
          });
          
          // Logging for key generation
          logAction(currentUser, 'key_generation', 'Encryption key was generated successfully.');
        });
      });
    });
  });
});

// Handle key recovery
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

    // Compare entered password with stored password hash
    bcrypt.compare(password, user.password_hash, (err, isPasswordMatch) => {
      if (err || !isPasswordMatch) {
        return event.reply('recover-status', { success: false, message: 'Invalid password' });
      }

      // Compare entered passphrase with stored passphrase hash
      bcrypt.compare(passphrase, user.passphrase_hash, (err, isPassphraseMatch) => {
        if (err || !isPassphraseMatch) {
          return event.reply('recover-status', { success: false, message: 'Invalid passphrase' });
        }

        // Retrieve salt for key generation
        const salt = Buffer.from(user.kdf_salt, 'hex');
        const iterations = 100000;
        const keyLength = 32;
        const digest = 'sha256';

        // Generate encryption key using PBKDF2
        crypto.pbkdf2(passphrase, salt, iterations, keyLength, digest, (err, derivedKey) => {
          if (err) {
            console.error('Error deriving key:', err);
            return event.reply('recover-status', { success: false, message: 'Error deriving key' });
          }

          const encryptionKey = derivedKey.toString('base64');
          currentEncryptionKey = encryptionKey;  // ✔ Store globally for later use
          // Logging for key recovery
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
  const { key: encryptionKey, description } = data;

  console.log('ENCRYPTION KEY TYPE:', typeof encryptionKey, encryptionKey);

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled || filePaths.length === 0) return;

  const inputPath = filePaths[0];
  const outputPath = inputPath + '_encrypted.dat';

  try {
    encryptFile(inputPath, outputPath, encryptionKey);
    event.sender.send('encryption-done', `File encrypted: ${outputPath}`);

    //  Use new Google Drive auth flow
    const auth = await gAuth.authorizeGoogleFor(currentUser);
    await uploadToDrive(outputPath, description, auth);
  } catch (err) {
    console.error('Encryption or upload error:', err);
    event.sender.send('encryption-done', 'Encryption failed.');
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

//Delete files
ipcMain.on('delete-google-drive-file', async (event, { fileId, appUserKey }) => {
  try {
    const auth = await gAuth.authorizeGoogleFor(appUserKey || currentUser);
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.delete({ fileId });
    console.log(`File deleted: ${fileId}`);
    event.sender.send('file-deleted', fileId);
  } catch (err) {
    console.error('Delete error:', err.message);
  }
});

//Share files
ipcMain.on('share-google-drive-file', async (event, { fileId, appUserKey }) => {
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
});

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
  const googleConnected = key ? await gAuth.isGoogleConnected(key) : false;
  return {
    googleConnected,
    oneDriveConnected: false,  // later
    defaultProvider: ''        // add if you want to store one
  };
});

ipcMain.removeHandler('cloud:disconnect-google');
ipcMain.handle('cloud:disconnect-google', async (_e, appUserKey) => {
  const key = appUserKey || currentUser;
  if (!key) return { ok: false };
  await gAuth.disconnectGoogle(key);
  return { ok: true };
});


// Navigate to services.html (Manage Connections)
ipcMain.on('navigate-to-services', (event) => {
  console.log('IPC received: navigate-to-services');

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
