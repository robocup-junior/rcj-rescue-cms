const logger = require('../config/logger').mainLogger;
const {mailQueue} = require("../queue/mailQueue")
const { htmlToText } = require('html-to-text');
const fs = require('fs');
const path = require('path');
const safePath = require('./safePath');

// The system's own templates of the mails to the staff (users), kept with the staff's templates
// (templates/mail/staff): where they were before (templates/mail), moved there when the app starts
const STAFF_TEMPLATES = [
  '_Welcome to RCJ CMS – Your Account Information',
  '_Document Evaluation Reminder and Status Update',
];
module.exports.STAFF = 'staff';

module.exports.moveStaffTemplates = function () {
  for (const name of STAFF_TEMPLATES) {
    const from = safePath('templates', 'mail', `${name}.html`);
    const to = safePath('templates', 'mail', 'staff', `${name}.html`);
    try {
      if (!fs.existsSync(from)) continue;
      if (fs.existsSync(to)) {
        logger.warn(`The template ${name} is in templates/mail and templates/mail/staff: the one in templates/mail/staff is used`);
        continue;
      }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      logger.info(`The template ${name} has been moved to templates/mail/staff`);
    } catch (err) {
      logger.error(`The template ${name} could not be moved to templates/mail/staff: ${err.message}`);
    }
  }
};


function template(string, values){
  return string.replace(/\$\{(.*?)\}/g, function(all, key){
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
  });
}

// folder: the templates' (STAFF for those of the mails to the staff), the teams' if none
module.exports.sendMail = function (subject, templateName, contents, variables, toAddress, folder) {
  let file = safePath('templates', 'mail', ...(folder ? [folder] : []), `${templateName}.html`);
  // Not moved yet (the app not started again since): where it was
  if (folder && !fs.existsSync(file)) file = safePath('templates', 'mail', `${templateName}.html`);

  fs.stat(file, (err, stat) => {
    // Handle file not found
    if (err !== null && err.code === 'ENOENT') {
      logger.error(`No mail template ${templateName}: the mail "${subject}" is not sent`);
      return;
    }
    fs.readFile(file, function (err, data) {
      let html = data.toString()
        .replace(/\r?\n/g, '')
        .replace(/<p><br><\/p>/g, '<br>')
        .replace(/<\/p><p>/g, '<br>')
        .replace(/<span class="ql-cursor">﻿<\/span>/, '');

      html = template(html, variables);

      const text = htmlToText(html, {
        tags: { a: { options: { hideLinkHrefIfSameAsText: true } } },
      });
  
      const message = {
        from: {
          name: process.env.MAIL_SENDER || 'RoboCupJunior CMS',
          address: process.env.MAIL_FROM,
        },
        to: toAddress,
        subject,
        html: `<style type="text/css">p {margin:0; padding:0; margin-bottom:0;}</style>${html}`,
        text,
        replyTo: process.env.MAIL_REPLY || process.env.MAIL_FROM
      };

      try {
        mailQueue.add('send',{message, mailDbID: null}, {attempts:3, backoff:10000});
      } catch (e) {
        logger.error(e);
      } 
    });
  }); 
};