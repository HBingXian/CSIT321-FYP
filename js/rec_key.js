// Import ipcRenderer to communicate with main.js in Electron
const { ipcRenderer } = require('electron');

// Handle form submission for key recovery
document.getElementById('recForm').addEventListener('submit', function(event) {
    event.preventDefault();  // Prevent form submission

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const passphrase = document.getElementById('passphrase').value.trim();
  
    // Send username, password, and passphrase to main.js for key recovery
    ipcRenderer.send('recover-key', { username, password, passphrase });
});

// Listen for the result of the key recovery attempt
ipcRenderer.on('recover-status', (event, data) => {
    const resultDiv = document.getElementById('result');
    
    if (data.success) {
      resultDiv.innerHTML = `<p>${data.message}</p><p>Your encryption key: ${data.encryptionKey}</p>`;
    } else {
      resultDiv.innerHTML = `<p>Error: ${data.message}</p>`;
    }
});