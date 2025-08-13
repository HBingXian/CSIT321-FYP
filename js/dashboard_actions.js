const { ipcRenderer } = require('electron');

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    ipcRenderer.send('logout-request');
});

// Navigate to gen_key.html 
document.getElementById('generateKeyBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-gen-key');
});

//navigate to encryption page
document.getElementById('goToEncryptPageBtn').addEventListener('click', () => {
    ipcRenderer.send('navigate-to-encrypt-page');
});

//navigate to files page
document.getElementById('manageFilesBtn').addEventListener('click', () => {
  ipcRenderer.send('navigate-to-files');  // custom IPC event
});

//navigate to services page
document.getElementById('connectionsBtn').addEventListener('click', () => {
  ipcRenderer.send('navigate-to-services');  // custom IPC event
});



