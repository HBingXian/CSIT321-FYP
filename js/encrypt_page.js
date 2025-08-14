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
document.getElementById('importKeyBtn').addEventListener('click', async () => {
  const keyInputEl = document.getElementById('encryptionKeyInput');
  const res = await ipcRenderer.invoke('import-key-json');
  if (res?.status === 'success' && res.key) {
    keyInputEl.value = res.key;
    alert('Key imported.');
  } else if (res?.status === 'cancelled') {
    // user cancelled file dialog — do nothing
  } else {
    alert(res?.message || 'Failed to import key from JSON.');
  }
});

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
