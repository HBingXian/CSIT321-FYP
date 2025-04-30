const { app, BrowserWindow, ipcMain } = require('electron'); // Create main window of app
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Create the window 
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // optional
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('pages/index.html'); // Create an HTML file for app's UI
}

app.whenReady().then(createWindow);

// Connect to MySQL (XAMPP)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // default for XAMPP
  database: 'crypterhelper_db'
});

// Check for db errors
db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// Handle login from frontend 
ipcMain.on('login-attempt', (event, { username, password }) => {
  console.log('Login attempt for:', username);

  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      event.reply('login-response', { success: false, error: 'Database error' });
      return;
    }

    console.log('User query result:', results);

    if (results.length === 0) {
      event.reply('login-response', { success: false, error: 'User not found' });
      return;
    }

    const user = results[0];

    // Compare the passwords and checks if it matches DB
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) {
        console.error('Bcrypt error:', err);
        event.reply('login-response', { success: false, error: 'Hash error' });
        return;
      }

      console.log('Password match:', isMatch);

      if (!isMatch) {
        event.reply('login-response', { success: false, error: 'Invalid password' });
      } else {
        event.reply('login-response', { success: true, user: user.username });
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
