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

// Onedrive upload
async function uploadToOneDrive() {
  const result = await ipcRenderer.invoke('start-onedrive-upload');

  if (result.status === 'auth_required') {
    alert('Please log in to OneDrive in your browser and return.');
  } else if (result.status === 'success') {
    alert(`Encrypted file uploaded as ${result.fileName}`);
  } else if (result.status === 'cancelled') {
    alert('Upload cancelled.');
  } else {
    alert('An error occurred.');
  }
}