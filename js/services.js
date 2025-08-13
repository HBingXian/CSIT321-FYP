const { ipcRenderer } = require('electron');

const googleConnectBtn = document.getElementById('googleConnectBtn');
const googleDisconnectBtn = document.getElementById('googleDisconnectBtn');
const googleStatus = document.getElementById('googleStatus');

// Load initial connection status
window.addEventListener('DOMContentLoaded', async () => {
  const status = await ipcRenderer.invoke('cloud:get-status');

  if (status.googleConnected) {
    googleStatus.textContent = 'Google Drive is connected.';
    googleConnectBtn.style.display = 'none';
    googleDisconnectBtn.style.display = 'inline-block';
  } else {
    googleStatus.textContent = 'Google Drive is not connected.';
    googleConnectBtn.style.display = 'inline-block';
    googleDisconnectBtn.style.display = 'none';
  }
});

// Handle connect
googleConnectBtn.addEventListener('click', async () => {
  const success = await ipcRenderer.invoke('oauth:google');
  if (success) {
    googleStatus.textContent = 'Google Drive connected successfully.';
    googleConnectBtn.style.display = 'none';
    googleDisconnectBtn.style.display = 'inline-block';
  } else {
    googleStatus.textContent = 'Connection failed. Please try again.';
  }
});

// Handle disconnect
googleDisconnectBtn.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('cloud:disconnect-google');
  if (result.ok) {
    googleStatus.textContent = 'Google Drive has been disconnected.';
    googleConnectBtn.style.display = 'inline-block';
    googleDisconnectBtn.style.display = 'none';
  } else {
    googleStatus.textContent = 'Failed to disconnect.';
  }
});
