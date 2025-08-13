const { ipcRenderer } = require('electron');

document.getElementById('selectFileBtn').addEventListener('click', async () => {
  const keyEl = document.getElementById('encryptionKeyInput');
  const destEl = document.getElementById('uploadDest');

  const encryptionKey = (keyEl?.value || '').trim();
  const destination = destEl?.value || 'google';

  const keyInputEl = document.getElementById('encryptionKeyInput');
  const importBtn = document.getElementById('importKeyBtn');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      const res = await ipcRenderer.invoke('import-key-json');
      if (res?.status === 'success' && res.key) {
        keyInputEl.value = res.key;
        alert('Key imported.');
      } else if (res?.status === 'cancelled') {
        // user cancelled file dialog — do nothing
      } else {
        alert(res?.message || 'Failed to import key from JSON.');
      }
    });
  }

  if (!encryptionKey) {
    alert('Please enter your encryption key first.');
    return;
  }

  const result = await ipcRenderer.invoke('encrypt-file-from-page-to', { encryptionKey, destination });

  if (result?.status === 'auth_required') {
    alert('Please sign in to OneDrive in the browser, then click the button again.');
  } else if (result?.status === 'success') {
    alert(result.message || 'Encrypted and uploaded successfully!');
  } else if (result?.status === 'cancelled') {
    // user cancelled file picker—do nothing
  } else if (result?.status === 'local_only') {
    alert('File encrypted locally.');
  } else if (result?.status === 'error') {
    alert(result.message || 'Something went wrong.');
  }
});

// 🔁 Prompt function
function showPrompt() {
    const goToGen = confirm("Invalid key format.\nWould you like to go to the Key Generation page?");
    if (goToGen) {
        ipcRenderer.send('navigate-to-gen-key');
    }
}

//home functions
    window.addEventListener('DOMContentLoaded', () => {
      const { ipcRenderer } = require('electron');
      document.getElementById('homeBtn').addEventListener('click', () => {
        ipcRenderer.send('home-request');
      });
    });


// Optional: Show feedback from main process
ipcRenderer.on('encryption-done', (event, message) => {
    document.getElementById('result').textContent = message;
});
