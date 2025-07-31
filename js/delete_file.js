console.log(" delete_file.js loaded");

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const fileId = e.target.getAttribute('data-id');
    if (!fileId) {
      console.warn("⚠️ No data-id found on Delete button");
      return;
    }
    console.log("🗑️ Delete button clicked:", fileId);
    ipcRenderer.send('delete-google-drive-file', fileId);
  }
});

window.ipcRenderer.on('file-deleted', (event, fileId) => {
  const button = document.querySelector(`.delete-btn[data-id="${fileId}"]`);
  if (button) {
    const row = button.closest('tr');
    if (row) row.remove();
    console.log(`🧹 Removed row for deleted file: ${fileId}`);
  }
});

