// ../js/decrypt_page.js
const { ipcRenderer } = require('electron');

let cloudCtx = null; // { provider, fileId, fileName } if coming from Files page

// Get selected cloud file (if any) when this page loads
ipcRenderer.invoke('decrypt:get-context').then((ctx) => {
  cloudCtx = ctx || null;
  const resEl = document.getElementById('result');
  if (cloudCtx && resEl) {
    resEl.textContent = `Ready to decrypt from ${cloudCtx.provider}: ${cloudCtx.fileName}`;
  }
});

document.getElementById('selectFileBtn').addEventListener('click', async () => {
  const keyInput = (document.getElementById('decryptionKeyInput')?.value || '').trim();

  let decodedKey;
  try {
    decodedKey = Buffer.from(keyInput, 'base64');
  } catch {
    return showPrompt();
  }
  if (decodedKey.length !== 32) return showPrompt();

  // If a cloud file was selected on Files page, download+decrypt it
  if (cloudCtx && cloudCtx.provider && cloudCtx.fileId) {
    const res = await ipcRenderer.invoke('download-and-decrypt', {
      provider: cloudCtx.provider,
      fileId: cloudCtx.fileId,
      fileName: cloudCtx.fileName || 'downloaded_encrypted.dat',
      base64Key: keyInput
    });
    document.getElementById('result').textContent =
      res?.message || (res?.status === 'ok' ? 'Done.' : 'Failed.');
    return;
  }

  // Otherwise fall back to local-file decrypt (user picks encrypted file)
  ipcRenderer.send('decrypt-file-from-page', keyInput);
});

document.getElementById('homeBtn').addEventListener('click', () => {
  ipcRenderer.send('home-request');
});

function showPrompt() {
  const goToGen = confirm("Invalid key format.\nWould you like to go to the Key Generation page?");
  if (goToGen) ipcRenderer.send('navigate-to-gen-key');
}

ipcRenderer.on('decryption-done', (_event, message) => {
  document.getElementById('result').textContent = message;
});

(() => {
  const keyInputEl   = document.getElementById('decryptionKeyInput');
  const importBtn    = document.getElementById('importDecryptKeyBtn');
  const importFileEl = document.getElementById('importDecryptKeyFile');

  if (!importBtn || !importFileEl || !keyInputEl) return;

  importBtn.addEventListener('click', () => {
    importFileEl.value = '';   // allow re-selecting the same file
    importFileEl.click();      // open native file picker
  });

  importFileEl.addEventListener('change', async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        alert('Invalid JSON file.');
        return;
      }

      // Your generator writes { "encryptionKey": "<base64>" }
      const key = data.encryptionKey || data.key || data.encryption_key;

      if (!key || typeof key !== 'string') {
        alert('No "encryptionKey" string found in JSON.');
        return;
      }

      // quick sanity check: base64
      try { Buffer.from(key, 'base64'); } catch {
        alert('Key in JSON is not valid Base64.');
        return;
      }

      keyInputEl.value = key;
      alert('Key imported for decryption.');
    } catch (err) {
      console.error('Import decrypt key error:', err);
      alert('Failed to import key from JSON.');
    }
  });
})();

//home functions
    window.addEventListener('DOMContentLoaded', () => {
      const { ipcRenderer } = require('electron');
      document.getElementById('homeBtn').addEventListener('click', () => {
        ipcRenderer.send('home-request');
      });
    });
