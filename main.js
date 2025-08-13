const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); 
const { dialog } = require('electron');
const { encryptFile } = require('./js/file_encrypt');
const { decryptFile } = require('./js/file_decrypt');
const { uploadToDrive } = require('./js/drive_upload');

const { google } = require('googleapis');
const { authorize } = require('./js/drive_auth');

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
app.whenReady().then(createWindow);

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
