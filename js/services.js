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

// ======================= OneDrive wiring =======================
const onedriveConnectBtn = document.getElementById('onedriveConnectBtn');
const onedriveDisconnectBtn = document.getElementById('onedriveDisconnectBtn');
const onedriveStatus = document.getElementById('onedriveStatus');

// safe guards (page might not have the elements if HTML not updated yet)
if (onedriveConnectBtn && onedriveDisconnectBtn && onedriveStatus) {
  // Refresh OneDrive status using the same 'cloud:get-status' you already use for Google
  async function refreshOneDriveStatus() {
    try {
      const status = await ipcRenderer.invoke('cloud:get-status');
      const connected = !!status?.onedriveConnected; // treat missing as false

      if (connected) {
        onedriveStatus.textContent = 'OneDrive is connected.';
        onedriveConnectBtn.style.display = 'none';
        onedriveDisconnectBtn.style.display = 'inline-block';
      } else {
        onedriveStatus.textContent = 'OneDrive is not connected.';
        onedriveConnectBtn.style.display = 'inline-block';
        onedriveDisconnectBtn.style.display = 'none';
      }
    } catch (e) {
      onedriveStatus.textContent = 'Unable to determine OneDrive status.';
      onedriveConnectBtn.style.display = 'inline-block';
      onedriveDisconnectBtn.style.display = 'none';
      console.error('OneDrive status error:', e);
    }
  }

  // Initialize on load
  window.addEventListener('DOMContentLoaded', refreshOneDriveStatus);

  // Connect
  onedriveConnectBtn.addEventListener('click', async () => {
    try {
      // Opens the Microsoft login URL if not already connected
      const ok = await ipcRenderer.invoke('oauth:onedrive');
      if (ok) {
        onedriveStatus.textContent = 'If a browser opened, finish sign-in then return here.';
        // give the token writer a moment then refresh
        setTimeout(refreshOneDriveStatus, 1500);
      } else {
        onedriveStatus.textContent = 'Failed to start OneDrive sign-in.';
      }
    } catch (e) {
      console.error(e);
      onedriveStatus.textContent = 'Failed to start OneDrive sign-in.';
    }
  });

  // Disconnect
  onedriveDisconnectBtn.addEventListener('click', async () => {
    try {
      const res = await ipcRenderer.invoke('cloud:disconnect-onedrive');
      if (res?.ok) {
        onedriveStatus.textContent = 'OneDrive has been disconnected.';
        onedriveConnectBtn.style.display = 'inline-block';
        onedriveDisconnectBtn.style.display = 'none';
      } else {
        onedriveStatus.textContent = 'Failed to disconnect OneDrive.';
      }
    } catch (e) {
      console.error(e);
      onedriveStatus.textContent = 'Failed to disconnect OneDrive.';
    }
  });
}
