// Import ipcRenderer to communicate with main.js in 
const { ipcRenderer } = require('electron');

const result = document.getElementById('result');
const downloadBtn = document.getElementById('downloadKeyBtn');

let latestKey = null;

// Handle form submission for passphrase-based key
document.getElementById('keyForm').addEventListener('submit', (e) => {
  e.preventDefault();

  // Validate passphrase: 12+ chars, upper, lower, number, symbol
  const passphrase = document.getElementById('passphrase').value;
  const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,}$/.test(passphrase);

  if (!isValid) {
    result.textContent = "Passphrase must be 12+ chars with upper, lower, number & symbol.";
    downloadBtn.style.display = 'none';
    return;
  }
   // Send passphrase to main.js
  ipcRenderer.send('generate-key', passphrase);
});

// Handle "Generate Key Randomly" button click
document.getElementById('randomKeyBtn').addEventListener('click', () => {
  ipcRenderer.send('generate-random-key');
});

// Listen for key generation response
ipcRenderer.on('key-status', (event, data) => {
  result.innerHTML = `${data.message}`;
  if (data.encryptionKey) {
    latestKey = data.encryptionKey;
    result.innerHTML += `<br><strong>Encryption Key:</strong> ${latestKey}`;
    downloadBtn.style.display = 'inline-block'; // show button
  } else {
    latestKey = null;
    downloadBtn.style.display = 'none';
  }
});

// Download button click handler - save key as JSON file
downloadBtn.addEventListener('click', () => {
  if (!latestKey) return;

  const jsonData = JSON.stringify({ encryptionKey: latestKey }, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'crypterhelper_key.json';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
});
