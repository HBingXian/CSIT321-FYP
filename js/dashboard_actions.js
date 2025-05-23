const { ipcRenderer } = require('electron');

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    ipcRenderer.send('logout-request');
});

// Navigate to gen_key.html 
document.getElementById('generateKeyBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-gen-key');
});

// Navigate to rec_key.html 
document.getElementById('recoverKeyBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-rec-key');
});

// Encrypt & Upload
document.getElementById('encryptUploadBtn').addEventListener('click', () => {
    ipcRenderer.send('request-encrypt-upload');
});

// Download & Decrypt
document.getElementById('downloadDecryptBtn').addEventListener('click', () => {
    ipcRenderer.send('request-download-decrypt');
});


document.getElementById('encryptUploadBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-encrypt-page');
});

//navigate to encryption page
document.getElementById('goToEncryptPageBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-encrypt-page');
});

//navigate to decryption page
document.getElementById('goToDecryptPageBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-decrypt-page');
});

