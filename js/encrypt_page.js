//current
// This module handles the encryption of files using a user-provided key.
// It uses Electron's IPC to communicate with the main process for file selection and encryption.
// Ensure you have the necessary modules installed: electron, crypto, fs, path 
const { ipcRenderer } = require('electron');

// === Select file and encrypt ===
document.getElementById('selectFileBtn').addEventListener('click', async () => {
  const keyEl = document.getElementById('encryptionKeyInput');
  const descEl = document.getElementById('fileDescriptionInput');
  const destEl = document.getElementById('uploadDest');

  const encryptionKey = (keyEl?.value || '').trim();
  const description = (descEl?.value || '').trim();
  const destination = (destEl?.value || 'google').trim();

  if (!encryptionKey) {
    alert('Please enter your encryption key first.');
    return;
  }

  // Send data to main process
  ipcRenderer.send('encrypt-file-from-page', {
    key: encryptionKey,
    description,
    destination,
  });
});

// === Import key from JSON ===
const keyInputEl   = document.getElementById('encryptionKeyInput');
const importBtn    = document.getElementById('importKeyBtn');
const importFileEl = document.getElementById('importKeyFile');

if (importBtn && importFileEl) {
  importBtn.addEventListener('click', () => {
    importFileEl.value = '';    // reset so selecting same file twice still triggers change
    importFileEl.click();       // opens native file picker (renderer-safe)
  });

  importFileEl.addEventListener('change', async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const text = await file.text();        // read file content
      const data = JSON.parse(text);

      // Your generator writes { "encryptionKey": "<base64>" }
      const key = data.encryptionKey || data.key || data.encryption_key;

      if (!key || typeof key !== 'string') {
        alert('No "encryptionKey" string found in JSON.');
        return;
      }

      // quick sanity: base64
      try { Buffer.from(key, 'base64'); } catch {
        alert('Key in JSON is not valid Base64.');
        return;
      }

      if (keyInputEl) keyInputEl.value = key;
      alert('Key imported.');
    } catch (err) {
      console.error('Import key error:', err);
      alert('Failed to import key from JSON.');
    }
  });
}

// === Handle back to dashboard ===
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('homeBtn').addEventListener('click', () => {
    ipcRenderer.send('home-request');
  });
});

// === Receive status from main ===
ipcRenderer.on('encryption-done', (event, message) => {
  document.getElementById('result').textContent = message;
});

// === Optional invalid key handler ===
function showPrompt() {
  const goToGen = confirm("Invalid key format.\nWould you like to go to the Key Generation page?");
  if (goToGen) {
    ipcRenderer.send('navigate-to-gen-key');
  }
}
