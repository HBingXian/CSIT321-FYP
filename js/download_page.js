const { ipcRenderer } = require('electron');
console.log("Loaded download_page.js");
let selectedFileId = null;

ipcRenderer.send('request-drive-file-list');

ipcRenderer.on('drive-file-list', (event, files) => {
  const listDiv = document.getElementById('fileList');
  listDiv.innerHTML = `
    <table>
      <tr><th>File Name</th></tr>
      ${files.map(f => `
        <tr class="file-row" data-id="${f.id}">
          <td>${f.name}</td>
        </tr>
      `).join('')}
    </table>
  `;

  document.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click', () => {
      selectedFileId = row.getAttribute('data-id');
      document.getElementById('downloadBtn').disabled = false;
      row.classList.add('selected');
    });
  });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const key = document.getElementById('decryptKeyInput').value.trim();
  if (!key || !selectedFileId) {
    alert('Select a file and enter your encryption key.');
    return;
  }

  ipcRenderer.send('download-and-decrypt', { fileId: selectedFileId, encryptionKey: key });
});

document.getElementById('homeBtn').addEventListener('click', () => {
  ipcRenderer.send('home-request');
});

ipcRenderer.on('download-complete', (event, message) => {
  document.getElementById('result').textContent = message;
});
