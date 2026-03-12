// -*- tab-width: 2 -*-
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

function loadLanguagesFromPublicLangFolder() {
  const langDir = path.join(process.cwd(), 'public', 'lang');

  let files = [];
  try {
    files = fs.readdirSync(langDir);
  } catch (e) {
    return [];
  }

  return files
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .map((fileName) => {
        const key = path.basename(fileName, '.json');

        try {
          const raw = fs.readFileSync(path.join(langDir, fileName), 'utf8');
          const parsed = JSON.parse(raw);
          const name = parsed && parsed.language_name ? String(parsed.language_name) : key;
          return { key, name };
        } catch (e) {
          return { key, name: key };
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key));
}

router.get('/', function (req, res) {
  res.render('locales', {
    user: req.user,
    langs: loadLanguagesFromPublicLangFolder(),
  });
});

module.exports = router;