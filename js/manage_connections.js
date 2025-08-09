// js/manage_connections.js
const { ipcRenderer } = require('electron');

const el = (id) => document.getElementById(id);
const googleList = el('googleList');
const oneDriveList = el('oneDriveList');
const defaultProviderSel = el('defaultProvider');
const defaultAccountSel = el('defaultAccount');
const btnSaveDefault = el('btnSaveDefault');

async function refreshAll() {
  const status = await ipcRenderer.invoke('cloud:get-status'); // {googleConnected, oneDriveConnected, defaultProvider}
  const gAccounts = await ipcRenderer.invoke('cloud:list-accounts', 'google');   // [{account, token}]
  const oAccounts = await ipcRenderer.invoke('cloud:list-accounts', 'onedrive'); // [{account, token}]

  // render google accounts
  googleList.innerHTML = '';
  if (gAccounts.length === 0) {
    googleList.innerHTML = '<div class="muted">No Google accounts connected.</div>';
  } else {
    gAccounts.forEach(({ account }) => {
      addAccountRow(googleList, 'google', account);
    });
  }

  // render onedrive accounts
  oneDriveList.innerHTML = '';
  if (oAccounts.length === 0) {
    oneDriveList.innerHTML = '<div class="muted">No OneDrive accounts connected.</div>';
  } else {
    oAccounts.forEach(({ account }) => {
      addAccountRow(oneDriveList, 'onedrive', account);
    });
  }

  // default provider/account UI
  defaultProviderSel.value = status.defaultProvider || '';
  await updateDefaultAccountsDropdown(); // refills account list based on provider
  const currentDefaultAccount = await ipcRenderer.invoke('cloud:get-default-account');
  if (currentDefaultAccount) defaultAccountSel.value = currentDefaultAccount;

  const note = [];
  if (status.defaultProvider) note.push(`Default provider: ${status.defaultProvider}`);
  if (currentDefaultAccount) note.push(`Default account: ${currentDefaultAccount}`);
  el('defaultNote').textContent = note.join(' | ') || 'No default set.';
}

function addAccountRow(container, provider, account) {
  // label
  const label = document.createElement('div');
  label.textContent = account;

  // actions
  const actions = document.createElement('div');
  const setBtn = document.createElement('button');
  setBtn.textContent = 'Set as Default';
  setBtn.onclick = async () => {
    await ipcRenderer.invoke('cloud:set-default', provider);
    await ipcRenderer.invoke('cloud:set-default-account', account);
    refreshAll();
  };

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Disconnect';
  delBtn.onclick = async () => {
    if (confirm(`Disconnect ${account} from ${provider}?`)) {
      await ipcRenderer.invoke('cloud:disconnect-account', provider, account);
      // if default was this account, clear it
      await ipcRenderer.invoke('cloud:clear-default-if-missing');
      refreshAll();
    }
  };

  actions.appendChild(setBtn);
  actions.appendChild(delBtn);

  container.appendChild(label);
  container.appendChild(actions);
}

async function updateDefaultAccountsDropdown() {
  const provider = defaultProviderSel.value;
  defaultAccountSel.innerHTML = '<option value="">-- Select account --</option>';
  if (!provider) return;
  const accounts = await ipcRenderer.invoke('cloud:list-accounts', provider);
  accounts.forEach(({ account }) => {
    const opt = document.createElement('option');
    opt.value = account;
    opt.textContent = account;
    defaultAccountSel.appendChild(opt);
  });
}

// connect buttons
document.getElementById('btnConnectGoogle').onclick = async () => {
  const ok = await ipcRenderer.invoke('oauth:google');
  if (!ok) alert('Google connection failed.');
  refreshAll();
};

document.getElementById('btnConnectOneDrive').onclick = async () => {
  const ok = await ipcRenderer.invoke('oauth:onedrive');
  if (!ok) alert('OneDrive connection failed.');
  refreshAll();
};

// default selectors
defaultProviderSel.onchange = updateDefaultAccountsDropdown;
btnSaveDefault.onclick = async () => {
  const provider = defaultProviderSel.value;
  const account = defaultAccountSel.value;
  if (!provider || !account) {
    alert('Select provider and account.');
    return;
  }
  await ipcRenderer.invoke('cloud:set-default', provider);
  await ipcRenderer.invoke('cloud:set-default-account', account);
  refreshAll();
};

// init
document.addEventListener('DOMContentLoaded', refreshAll);
