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

// Navigate to encryption page
safeAddListener('goToEncryptPageBtn', 'click', () => {
  ipcRenderer.send('navigate-to-encrypt-page');
});

// Navigate to file manager
safeAddListener('manageFilesBtn', 'click', () => {
  ipcRenderer.send('navigate-to-files');
});

// Navigate to connections page
safeAddListener('connectionsBtn', 'click', () => {
  ipcRenderer.send('navigate-to-services');
});

