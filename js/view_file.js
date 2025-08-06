const { ipcRenderer } = require('electron');
window.ipcRenderer = ipcRenderer;
console.log("✅ view_file.js loaded");

// Store all files globally for searching/filtering
window.allFiles = [];

// Main render function
function renderTable(filesToShow) {
  const tbody = document.getElementById('fileTableBody');
  tbody.innerHTML = '';
  filesToShow.forEach(file => {
    const row = document.createElement('tr');
    row.setAttribute('data-description', file.description || '');

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
}

// Make renderTable globally accessible (for search_files.js)
window.renderTable = renderTable;

window.onload = () => {
  ipcRenderer.send('request-google-drive-files');
};

ipcRenderer.on('response-google-drive-files', (event, files) => {
  window.allFiles = files;         // Save all files for global access
  renderTable(files);              // Initial table render
});
