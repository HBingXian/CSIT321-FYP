const { ipcRenderer } = require('electron');

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    ipcRenderer.send('logout-request');
});

// Navigate to key generation
document.getElementById('generateKeyBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-gen-key');
});

// Encrypt & Upload
document.getElementById('encryptUploadBtn').addEventListener('click', () => {
    ipcRenderer.send('request-encrypt-upload');
});

// Download & Decrypt
document.getElementById('downloadDecryptBtn').addEventListener('click', () => {
    ipcRenderer.send('request-download-decrypt');
});

// Navigate to manual encryption page
document.getElementById('goToEncryptPageBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-encrypt-page');
});

// Navigate to manual decryption page
document.getElementById('goToDecryptPageBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-decrypt-page');
});

// Navigate to manage files
document.getElementById('manageFilesBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-files');
});
