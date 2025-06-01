const logger = require('../config/logger').mainLogger;
const {mailQueue} = require("../queue/mailQueue")
const { htmlToText } = require('html-to-text');
const fs = require('fs');


function template(string, values){
  return string.replace(/\$\{(.*?)\}/g, function(all, key){
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
  });
}

module.exports.sendMail = function (subject, templateName, contents, variables, toAddress) {
  const templateDir = `${__dirname}/../templates/mail/`
  const path = `${templateDir}${templateName}.html`;

  fs.stat(path, (err, stat) => {
    // Handle file not found
    if (err !== null && err.code === 'ENOENT') {
      return;
    }
    fs.readFile(path, function (err, data) {
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