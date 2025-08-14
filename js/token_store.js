// js/token_store.js
const keytar = require('keytar');

const SERVICE_ONEDRIVE = 'CrypterHelper:OneDrive';
const SERVICE_GOOGLE   = 'CrypterHelper:Google';

// ---------- OneDrive ----------
async function setOneDriveToken(userKey, tokenObj) {
  if (!userKey) throw new Error('setOneDriveToken: missing userKey');
  await keytar.setPassword(SERVICE_ONEDRIVE, String(userKey), JSON.stringify(tokenObj || {}));
}
async function getOneDriveToken(userKey) {
  if (!userKey) throw new Error('getOneDriveToken: missing userKey');
  const raw = await keytar.getPassword(SERVICE_ONEDRIVE, String(userKey));
  return raw ? JSON.parse(raw) : null;
}
async function deleteOneDriveToken(userKey) {
  if (!userKey) throw new Error('deleteOneDriveToken: missing userKey');
  await keytar.deletePassword(SERVICE_ONEDRIVE, String(userKey));
}

// ---------- Google ----------
async function setGoogleToken(userKey, tokenObj) {
  if (!userKey) throw new Error('setGoogleToken: missing userKey');
  await keytar.setPassword(SERVICE_GOOGLE, String(userKey), JSON.stringify(tokenObj || {}));
}
async function getGoogleToken(userKey) {
  if (!userKey) throw new Error('getGoogleToken: missing userKey');
  const raw = await keytar.getPassword(SERVICE_GOOGLE, String(userKey));
  return raw ? JSON.parse(raw) : null;
}
async function deleteGoogleToken(userKey) {
  if (!userKey) throw new Error('deleteGoogleToken: missing userKey');
  await keytar.deletePassword(SERVICE_GOOGLE, String(userKey));
}

module.exports = {
  // OneDrive
  setOneDriveToken, getOneDriveToken, deleteOneDriveToken,
  // Google
  setGoogleToken, getGoogleToken, deleteGoogleToken,
};
