const { ipcRenderer } = require('electron');
window.ipcRenderer = ipcRenderer;
console.log("✅ view_file.js loaded");

window.onload = () => {
  ipcRenderer.send('request-google-drive-files');
};

ipcRenderer.on('response-google-drive-files', (event, files) => {
  const tbody = document.getElementById('fileTableBody');
  tbody.innerHTML = '';
  console.log("📁 Received files:", files);
  files.forEach(file => {
    const row = document.createElement('tr');

    row.innerHTML = `
        <td>${file.name}</td>
        <td>${file.size || '—'}</td>
        <td>${file.modifiedTime}</td>
        <td>
          <button class="share-btn" data-id="${file.id}">Share</button>
          <button class="delete-btn" data-id="${file.id}">Delete</button>
          <button class="decrypt-btn" data-id="${file.id}">Decrypt</button>
        </td>
    `;

    tbody.appendChild(row);
  });
});
