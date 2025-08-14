// ../js/view_file.js
const { ipcRenderer } = require('electron');

const tableBody = document.getElementById('fileTableBody');

// ---- helper: format bytes as B / KB / MB / GB ----
function humanSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

// Renders files into the table; expects objects with: id, name, sizeBytes, modifiedTime, description
function renderTable(files) {
  tableBody.innerHTML = '';
  (files || []).forEach(file => {
    const tr = document.createElement('tr');

    // File name
    const nameTd = document.createElement('td');
    nameTd.textContent = file.name || '—';
    tr.appendChild(nameTd);

    // Size (formatted)
    const sizeTd = document.createElement('td');
    // prefer sizeBytes (bytes); fall back to legacy 'size' if present
    const rawBytes = (file.sizeBytes != null) ? file.sizeBytes
                    : (file.size != null && !isNaN(Number(file.size)) ? Number(file.size) : null);
    sizeTd.textContent = humanSize(rawBytes);
    tr.appendChild(sizeTd);

    // Modified date
    const modTd = document.createElement('td');
    modTd.textContent = file.modifiedTime || '—';
    tr.appendChild(modTd);

    // Actions (decrypt/delete hooks you already have)
    const actTd = document.createElement('td');
    actTd.innerHTML = `
      <button class="decrypt-btn" data-id="${file.id}" data-name="${file.name}">Decrypt</button>
      <button class="delete-btn" data-id="${file.id}" data-name="${file.name}">Delete</button>
    `;
    tr.appendChild(actTd);

    tableBody.appendChild(tr);
  });

  // Re-bind your other button handlers if they rely on class names:
  if (typeof window.bindDeleteHandlers === 'function') window.bindDeleteHandlers();
  if (typeof window.bindViewHandlers === 'function') window.bindDecryptHandlers();
}

// Keep a copy for search_file.js live-filter
window.allFiles = [];

// Request files by provider
function requestFiles(provider) {
  if (provider === 'onedrive') {
    ipcRenderer.send('request-onedrive-files');
  } else {
    ipcRenderer.send('request-google-drive-files');
  }
}

// Initial load + listeners
window.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('providerSelect');
  const refreshBtn = document.getElementById('refreshFilesBtn');

  const provider = providerSelect ? providerSelect.value : 'google';
  requestFiles(provider);

  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      requestFiles(providerSelect.value);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const p = providerSelect ? providerSelect.value : 'google';
      requestFiles(p);
    });
  }
});

// Decrypt and delete listeners
document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('decrypt-btn')) return;
  const id = e.target.getAttribute('data-id');
  const name = e.target.getAttribute('data-name') || 'downloaded_encrypted.dat';
  const provider = document.getElementById('providerSelect')?.value || 'google';
  const base64Key = prompt('Enter your encryption key (Base64):');
  if (!base64Key) return;
  const res = await ipcRenderer.invoke('download-and-decrypt', { provider, fileId: id, fileName: name, base64Key });
  alert(res?.message || (res?.status === 'ok' ? 'Done' : 'Failed'));
});


// GOOGLE: existing path (leave as-is on main.js side), normalize to bytes for display
ipcRenderer.on('response-google-drive-files', (event, items) => {
  const files = (items || []).map(it => {
    // Google returns size in BYTES as a string (missing for native Docs)
    const bytes = (it && it.size != null && !isNaN(Number(it.size))) ? Number(it.size) : null;
    return {
      id: it.id,
      name: it.name || '—',
      sizeBytes: bytes, // bytes for formatter
      modifiedTime: it.modifiedTime || it.modified_at || it.modified || '—',
      description: it.description || ''
    };
  });

  window.allFiles = files || [];
  renderTable(window.allFiles);
});

// ONEDRIVE: normalize to bytes for display; ignore folders
// Microsoft Graph returns items with fields like: id, name, size, lastModifiedDateTime
ipcRenderer.on('response-onedrive-files', (event, items) => {
  const normalized = (items || [])
    .filter(i => !!i.file)
    .map(it => ({
      id: it.id,
      name: it.name || '—',
      sizeBytes: (typeof it.size === 'number') ? it.size : null, // bytes for formatter
      modifiedTime: it.lastModifiedDateTime || '—',
      description: '' // no custom description in OneDrive
    }));

  window.allFiles = normalized;
  renderTable(window.allFiles);
});

// Files page → Decrypt page, with selected cloud file info
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.decrypt-btn');
  if (!btn) return;

  const fileId = btn.getAttribute('data-id');
  const fileName = btn.getAttribute('data-name') || 'downloaded_encrypted.dat';
  const provider = document.getElementById('providerSelect')?.value || 'google';

  // Tell main to navigate to Decrypt page and cache this selection
  ipcRenderer.send('nav:decrypt-with-cloud', { provider, fileId, fileName });
});

