const { ipcRenderer } = require('electron');

document.getElementById('selectFileBtn').addEventListener('click', () => {
    const keyInput = document.getElementById('decryptionKeyInput').value.trim();

    let decodedKey;
    try {
        decodedKey = Buffer.from(keyInput, 'base64');
    } catch (e) {
        showPrompt();
        return;
    }

    if (decodedKey.length !== 32) {
        showPrompt();
        return;
    }

    ipcRenderer.send('decrypt-file-from-page', keyInput);
});

document.getElementById('homeBtn').addEventListener('click', () => {
    ipcRenderer.send('home-request');
});

function showPrompt() {
    const goToGen = confirm("❌ Invalid key format.\nWould you like to go to the Key Generation page?");
    if (goToGen) {
        ipcRenderer.send('navigate-to-gen-key');
    }
}

ipcRenderer.on('decryption-done', (event, message) => {
    document.getElementById('result').textContent = message;
});

//home functions
    window.addEventListener('DOMContentLoaded', () => {
      const { ipcRenderer } = require('electron');
      document.getElementById('homeBtn').addEventListener('click', () => {
        ipcRenderer.send('home-request');
      });
    });