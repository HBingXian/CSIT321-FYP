const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const crypto = require('crypto'); 
const { dialog } = require('electron');
const { encryptFile } = require('./js/file_encrypt');
const { decryptFile } = require('./js/file_decrypt');
const { uploadToDrive } = require('./js/drive_upload');

const { google } = require('googleapis');
const { authorize } = require('./js/drive_auth');

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
        currentUser = user.username; // Set the logged-in user
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
//SuperBad123*
//tOhWYxBWEAAHFNoYzgaRCUo7EoTCFfvwY0DjLGrfXmA=

// Handle Download & Decrypt request
ipcMain.on('request-download-decrypt', async () => {
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


//Superbad123!
//eMIAjg1Yx1Ub9ve4HisjKPlKjKNqQlmwnIBsLFxobPw=
//handler to encrypt with manual key input
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

// Handle import key from JSON in the encrypt page
ipcMain.handle('import-key-json', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select key JSON file',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { status: 'cancelled' };
    }

    const raw = fs.readFileSync(filePaths[0], 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { status: 'error', message: 'Invalid JSON file.' };
    }

    // Accept common field names, but your generator uses "encryptionKey"
    const key = data.encryptionKey || data.key || data.encryption_key;

    if (!key || typeof key !== 'string') {
      return { status: 'error', message: 'No "encryptionKey" found in JSON.' };
    }

    // (Optional) quick sanity check that it’s base64
    try { Buffer.from(key, 'base64'); } catch {
      return { status: 'error', message: 'Key in JSON is not valid Base64.' };
    }

    return { status: 'success', key };
  } catch (err) {
    console.error('import-key-json error:', err);
    return { status: 'error', message: err.message || 'Unexpected error' };
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

// List/View files
ipcMain.on('request-google-drive-files', (event) => {
  authorize(async (auth) => {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.files.list({
        q: "'root' in parents and trashed = false",
        fields: 'files(id, name, size, modifiedTime)',
        spaces: 'drive',
        pageSize: 1000
      });
      //////////////
      event.reply('response-google-drive-files', res.data.files);
    } catch (err) {
      console.error('Drive List Error:', err);
      event.reply('response-google-drive-files', []);
    }
  });
});

// Delete files
ipcMain.on('delete-google-drive-file', async (event, fileId) => {
  console.log("🗑️ IPC received: delete-google-drive-file", fileId);

  authorize(async (auth) => {
    const drive = google.drive({ version: 'v3', auth });

    try {
      await drive.files.delete({ fileId });
      console.log(`🗑️ File deleted: ${fileId}`);
      event.sender.send('file-deleted', fileId);  // ✅ tell frontend to remove it
    } catch (err) {
      console.error("❌ Delete error:", err.message);
    }
  });
});


// Share files
ipcMain.on('share-google-drive-file', async (event, fileId) => {
  console.log("🔗 IPC received: share-google-drive-file", fileId);

  authorize(async (auth) => {
    const drive = google.drive({ version: 'v3', auth });

    try {
      // Create public permission
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get the file metadata to retrieve the webViewLink
      const { data } = await drive.files.get({
        fileId,
        fields: 'webViewLink'
      });

      console.log(`✅ File shared: ${fileId} → ${data.webViewLink}`);
      event.sender.send('share-link-ready', { fileId, link: data.webViewLink });

    } catch (err) {
      console.error("❌ Share error:", err.message);
    }
  });
});


  // Close app
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
