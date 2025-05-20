const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // ✅ Added crypto module
const { dialog } = require('electron');
const { encryptFile } = require('./js/file_encrypt');
const { decryptFile } = require('./js/file_decrypt');
const { uploadToDrive } = require('./js/drive_upload');

let mainWindow;
let currentUser = null; // ✅ Track the currently logged-in user
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
        currentUser = user.username; // ✅ Set the logged-in user
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

// Navigate to key recovery
ipcMain.on('navigate-to-rec-key', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/rec_key.html').then(() => {
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
//SuperBad123*
//tOhWYxBWEAAHFNoYzgaRCUo7EoTCFfvwY0DjLGrfXmA=

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

  // Close app
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
