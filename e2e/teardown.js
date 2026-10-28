// After the tests, while the server still runs: the files of the competitions made on it (the
// documents teams sent, the cabinets' files, the surveys' answers, the mails' attachments, the
// backups) are taken out of the app's folders, as its in-memory database goes when it stops.
const fs = require('fs');
const path = require('path');
const { request } = require('@playwright/test');
const { USERS } = require('./fixtures');

module.exports = async (config) => {
  const { baseURL } = config.projects[0].use;
  const api = await request.newContext({ baseURL });
  try {
    await api.post('/api/auth/login', { data: USERS.admin });
    const competitions = await (await api.get('/api/competitions')).json();
    for (const { _id } of competitions) {
      for (const dir of ['documents', 'cabinet', 'survey', 'mailAttachment', 'backup']) {
        fs.rmSync(path.join(__dirname, '..', dir, String(_id)), { recursive: true, force: true });
      }
    }
  } finally {
    await api.dispose();
  }
};
