const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // ✅ Added crypto module

let mainWindow;
let currentUser = null; // ✅ Track the currently logged-in user

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

// Back to dashboard
ipcMain.on('home-request', () => {
  if (mainWindow) {
    mainWindow.loadFile('pages/dashboard.html').then(() => {
      mainWindow.focus();
    });
  }
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
          event.reply('key-status', {
            message: 'Encryption key generated successfully. Please backup your key!',
            encryptionKey
          });
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

  // Close app
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
