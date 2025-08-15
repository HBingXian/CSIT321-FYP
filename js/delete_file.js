console.log(" delete_file.js loaded");

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const fileId = e.target.getAttribute('data-id');
    if (!fileId) {
      console.warn("No data-id found on Delete button");
      return;
    }
    console.log("Delete button clicked:", fileId);
    ipcRenderer.send('delete-google-drive-file', fileId);console.log("✅ delete_file.js loaded");

const ipc = (window && window.ipcRenderer) || require('electron').ipcRenderer;

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('delete-btn')) return;

  const fileId = e.target.getAttribute('data-id');
  if (!fileId) {
    console.warn("No data-id found on Delete button");
    return;
  }

  // Read the current provider from the Files page selector
  const provider = document.getElementById('providerSelect')?.value || 'google';

  console.log("Delete button clicked:", { provider, fileId });

  if (provider === 'onedrive') {
    ipc.send('delete-onedrive-file', fileId);         // NEW
  } else {
    ipc.send('delete-google-drive-file', fileId);     // existing
  }
});

// Use one common acknowledgement event for both providers
ipc.on('file-deleted', (_event, fileId) => {
  const button = document.querySelector(`.delete-btn[data-id="${fileId}"]`);
  if (button) {
    const row = button.closest('tr');
    if (row) row.remove();
    console.log(`Removed row for deleted file: ${fileId}`);
  }
});

  }
});

window.ipcRenderer.on('file-deleted', (event, fileId) => {
  const button = document.querySelector(`.delete-btn[data-id="${fileId}"]`);
  if (button) {
    const row = button.closest('tr');
    if (row) row.remove();
    console.log(`Removed row for deleted file: ${fileId}`);
  }
});

