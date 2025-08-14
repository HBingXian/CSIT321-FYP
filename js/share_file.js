console.log(" share_file.js loaded");

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('share-btn')) {
    const fileId = e.target.getAttribute('data-id');
    if (!fileId) {
      console.warn("⚠️ No data-id found on Share button");
      return;
    }
    console.log("🔗 Share button clicked:", fileId);
    ipcRenderer.send('share-google-drive-file', fileId);
  }
});

window.ipcRenderer.on('share-link-ready', (e, { fileId, link }) => {
  alert(` File is now public!\nShare link:\n${link}`);
});

