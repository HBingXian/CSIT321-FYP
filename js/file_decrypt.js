
const fs = require('fs');
const crypto = require('crypto');

function decryptFile(encryptedPath, decryptedPath, encryptionKey) {
    const encryptedData = fs.readFileSync(encryptedPath);
    const iv = encryptedData.slice(0, 12);
    const tag = encryptedData.slice(encryptedData.length - 16);
    const ciphertext = encryptedData.slice(12, encryptedData.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'base64'), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    fs.writeFileSync(decryptedPath, decrypted);
    console.log('Decryption completed:', decryptedPath);
}

module.exports = { decryptFile };
