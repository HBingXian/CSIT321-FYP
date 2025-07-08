const { ipcRenderer } = require('electron');

// Helper function to safely add event listeners
function safeAddListener(id, event, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener(event, handler);
  } else {
    console.warn(`Element with ID '${id}' not found.`);
  }
}

// Logout functionality
safeAddListener('logoutBtn', 'click', () => {
  ipcRenderer.send('logout-request');
});

// Navigate to gen_key.html
safeAddListener('generateKeyBtn', 'click', () => {
  ipcRenderer.send('navigate-to-gen-key');
});

// Navigate to rec_key.html
safeAddListener('recoverKeyBtn', 'click', () => {
  ipcRenderer.send('navigate-to-rec-key');
});

// Encrypt & Upload
safeAddListener('encryptUploadBtn', 'click', () => {
  ipcRenderer.send('request-encrypt-upload');
});

// Also navigate to encrypt page on Encrypt & Upload button
safeAddListener('encryptUploadBtn', 'click', () => {
  ipcRenderer.send('navigate-to-encrypt-page');
});

// Navigate to encryption page
safeAddListener('goToEncryptPageBtn', 'click', () => {
  ipcRenderer.send('navigate-to-encrypt-page');
});

// Navigate to decryption page
safeAddListener('goToDecryptPageBtn', 'click', () => {
  ipcRenderer.send('navigate-to-decrypt-page');
});

// Navigate to file manager
safeAddListener('manageFilesBtn', 'click', () => {
  ipcRenderer.send('navigate-to-files');
});

// Download & Decrypt
safeAddListener('downloadDecryptBtn', 'click', () => {
  ipcRenderer.send('request-download-decrypt');
});
