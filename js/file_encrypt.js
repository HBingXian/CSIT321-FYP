//old one ----------- to be ignored
// File: js/file_encrypt.js
// --- a/js/file_encrypt.js
// +++ b/js/file_encrypt.js
//
// This script handles file encryption functionality in an Electron app
const fs = require('fs');
const crypto = require('crypto');

function encryptFile(inputPath, outputPath, encryptionKey) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'base64'), iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    output.write(iv);

    const encryptStream = input.pipe(cipher).pipe(output);

    encryptStream.on('finish', () => {
        const tag = cipher.getAuthTag();
        fs.appendFileSync(outputPath, tag);
        console.log('Encryption completed:', outputPath);
    });
}

module.exports = { encryptFile };
