const CLIENT_ID = 'cca1ab0b-d9ac-49a7-888c-1ccb40568d6b';
const TENANT_ID = 'aec764f0-b187-44fc-a993-7ee78bf88632';
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'Files.ReadWrite.All offline_access User.Read';

function getAuthUrl() {
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=12345`;

  return authUrl;
}

module.exports = { getAuthUrl };

