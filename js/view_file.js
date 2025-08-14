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

    const nameTd = document.createElement('td');
    nameTd.textContent = file.name || '—';
    tr.appendChild(nameTd);

    const sizeTd = document.createElement('td');
    const rawBytes = (file.sizeBytes != null) ? file.sizeBytes
                    : (file.size != null && !isNaN(Number(file.size)) ? Number(file.size) : null);
    sizeTd.textContent = humanSize(rawBytes);
    tr.appendChild(sizeTd);

    const modTd = document.createElement('td');
    modTd.textContent = file.modifiedTime || '—';
    tr.appendChild(modTd);

    const actTd = document.createElement('td');
    actTd.innerHTML = `
      <button class="decrypt-btn" data-id="${file.id}" data-name="${file.name}">Decrypt</button>
      <button class="delete-btn"  data-id="${file.id}" data-name="${file.name}">Delete</button>
    `;
    tr.appendChild(actTd);

    tableBody.appendChild(tr);
  });

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

// Files page → Decrypt page, with selected cloud file info
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.decrypt-btn');
  if (!btn) return;

  const fileId = btn.getAttribute('data-id');
  const fileName = btn.getAttribute('data-name') || 'downloaded_encrypted.dat';
  const provider = document.getElementById('providerSelect')?.value || 'google';

  if (!fileId) {
    console.warn('Decrypt clicked but missing data-id on button');
    return;
  }

  ipcRenderer.send('nav:decrypt-with-cloud', { provider, fileId, fileName });
});

// GOOGLE: normalize to bytes for display
ipcRenderer.on('response-google-drive-files', (event, items) => {
  const files = (items || []).map(it => {
    const bytes = (it && it.size != null && !isNaN(Number(it.size))) ? Number(it.size) : null;
    return {
      id: it.id,
      name: it.name || '—',
      sizeBytes: bytes,
      modifiedTime: it.modifiedTime || it.modified_at || it.modified || '—',
      description: it.description || ''
    };
  });
  window.allFiles = files || [];
  renderTable(window.allFiles);
});

// ONEDRIVE: normalize to bytes for display; ignore folders
ipcRenderer.on('response-onedrive-files', (event, items) => {
  const normalized = (items || [])
    .filter(i => !!i.file)
    .map(it => ({
      id: it.id,
      name: it.name || '—',
      sizeBytes: (typeof it.size === 'number') ? it.size : null,
      modifiedTime: it.lastModifiedDateTime || '—',
      description: ''
    }));
  window.allFiles = normalized;
  renderTable(window.allFiles);
});
