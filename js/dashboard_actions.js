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

// Onedrive upload
//async function uploadToOneDrive() {
// const result = await ipcRenderer.invoke('start-onedrive-upload');

//  if (result.status === 'auth_required') {
//    alert('Please log in to OneDrive in your browser and return.');
//  } else if (result.status === 'success') {
//    alert(`Encrypted file uploaded as ${result.fileName}`);
//  } else if (result.status === 'cancelled') {
//   alert('Upload cancelled.');
//  } else {
//    alert('An error occurred.');
//  }
//}