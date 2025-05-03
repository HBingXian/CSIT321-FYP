// Import ipcRenderer to communicate with main.js in Electron
const { ipcRenderer } = require('electron');

// Handle form submission
document.getElementById('keyForm').addEventListener('submit', (e) => {
  e.preventDefault();

  // Get the user-entered passphrase
  const passphrase = document.getElementById('passphrase').value;

  // 12 chars long, uppercase, lowercase, symbols, numbers
  // Validate passphrase using a regular expression:
  const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,}$/.test(passphrase);
  // If invalid, show a message and stop
  if (!isValid) {
    document.getElementById('result').textContent =
      "Passphrase must be 12+ chars with upper, lower, number & symbol.";
    return;
  }

  // If valid, send passphrase to main.js for hashing + storing
  ipcRenderer.send('generate-key', passphrase);
});

// Listen for a response back from main.js
ipcRenderer.on('key-status', (event, data) => {
  document.getElementById('result').textContent = data.message;
  if (data.encryptionKey) {
    document.getElementById('result').innerHTML += `<br>Encryption Key: ${data.encryptionKey}`;
  }
});
