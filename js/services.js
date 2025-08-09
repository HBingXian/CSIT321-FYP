// js/services.js
const { ipcRenderer } = require('electron');

const btnGoogle = document.getElementById('btnGoogle');
const btnOneDrive = document.getElementById('btnOneDrive');
const googleStatus = document.getElementById('googleStatus');
const oneDriveStatus = document.getElementById('oneDriveStatus');
const btnSaveDefault = document.getElementById('btnSaveDefault');
const defaultStatus = document.getElementById('defaultStatus');

function refreshStatuses() {
  ipcRenderer.invoke('cloud:get-status').then(status => {
    googleStatus.textContent = status.googleConnected ? 'Connected' : 'Not connected';
    oneDriveStatus.textContent = status.oneDriveConnected ? 'Connected' : 'Not connected';

    const radios = document.querySelectorAll('input[name="activeProvider"]');
    radios.forEach(r => r.checked = (r.value === status.defaultProvider));
    defaultStatus.textContent = status.defaultProvider
      ? `Default provider: ${status.defaultProvider}`
      : 'No default provider saved';
  });
}

btnGoogle.addEventListener('click', async () => {
  btnGoogle.disabled = true;
  googleStatus.textContent = 'Connecting...';
  try {
    const ok = await ipcRenderer.invoke('oauth:google');
    googleStatus.textContent = ok ? 'Connected' : 'Not connected';
  } catch (e) {
    console.error(e);
    googleStatus.textContent = 'Error';
  } finally {
    btnGoogle.disabled = false;
    refreshStatuses();
  }
});

btnOneDrive.addEventListener('click', async () => {
  btnOneDrive.disabled = true;
  oneDriveStatus.textContent = 'Connecting...';
  try {
    const ok = await ipcRenderer.invoke('oauth:onedrive');
    oneDriveStatus.textContent = ok ? 'Connected' : 'Not connected';
  } catch (e) {
    console.error(e);
    oneDriveStatus.textContent = 'Error';
  } finally {
    btnOneDrive.disabled = false;
    refreshStatuses();
  }
});

btnSaveDefault.addEventListener('click', async () => {
  const choice = document.querySelector('input[name="activeProvider"]:checked');
  if (!choice) {
    defaultStatus.textContent = 'Pick a provider first.';
    return;
  }
  await ipcRenderer.invoke('cloud:set-default', choice.value);
  refreshStatuses();
});

// initial
document.addEventListener('DOMContentLoaded', refreshStatuses); 
