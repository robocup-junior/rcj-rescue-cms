const Queue = require('bull');
const mailDb = require('../models/mail');
const nodemailer = require('nodemailer');

let smtp;
if (process.env.MAIL_SMTP &&process.env.MAIL_PORT &&process.env.MAIL_FROM) {
  let smtp_conf;
  if(process.env.MAIL_USER && process.env.MAIL_PASS){
    smtp_conf = {
      host: process.env.MAIL_SMTP,
      port: process.env.MAIL_PORT,
      secure: process.env.MAIL_PORT == 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    };
  }else{
    //No auth
    smtp_conf = {
      host: process.env.MAIL_SMTP,
      port: process.env.MAIL_PORT,
      use_authentication: false,
      tls: {
          rejectUnauthorized: false
      }
    };
  }
  smtp = nodemailer.createTransport(smtp_conf);
} else {
  smtp = null;
}

const mailQueue = new Queue('mail queue', {
  redis: {port: process.env.REDIS_PORT, host: process.env.REDIS_HOST},
  limiter: {
    max: process.env.MAIL_MAX_PER_SECOND || 1,
    duration: 1000
  }
});

mailQueue.process('send', function(job, done){
  if(smtp == null){
    done(new Error('Unvailed smtp settings'));
    if(job.data.mailDbID){
      mailDb.mail
      .findById(job.data.mailDbID)
      .select('status events')
      .exec(function (err, data) {
          if (err || !data) {
          } else {
              if (data.status < 0) data.status = -2;
              const now = Math.floor(new Date().getTime() / 1000);
              const tmp = {
                  time: now,
                  event: '[Error] Unvailed smtp settings',
                  user: `Queue worker: ${process.pid}`
              };
              data.events.push(tmp);
              data.save(function (err) {
              });
          }
      });
    }
    // Not sent: there is nothing to send it with
    return;
  }
  job.progress(10);

  smtp.sendMail(job.data.message, function (error, info) {
      if (error) {
          done(new Error(error.message));
          if(job.data.mailDbID){
            mailDb.mail
            .findById(job.data.mailDbID)
            .select('status events')
            .exec(function (err, data) {
                if (err || !data) {
                } else {
                    if (data.status < 0) data.status = -2;
                    const now = Math.floor(new Date().getTime() / 1000);
                    const tmp = {
                        time: now,
                        event: `[Error] ${error.message}`,
                        user: `Queue worker: ${process.pid}`
                    };
                    data.events.push(tmp);
                    data.save(function (err) {
                    });
                }
            });
          }
      } else {
        if(job.data.mailDbID){
          job.progress(60);
          mailDb.mail
          .findById(job.data.mailDbID)
          .select('status events messageId')
          .exec(function (err, data) {
              if (err || !data) {
                  done(new Error(err));
                  if(job.data.mailDbID){
                    mailDb.mail
                    .findById(job.data.mailDbID)
                    .select('status events')
                    .exec(function (err, data) {
                        if (err || !data) {
                        } else {
                            if (data.status < 0) data.status = -2;
                            const now = Math.floor(new Date().getTime() / 1000);
                            const tmp = {
                                time: now,
                                event: `[Error] ${err}`,
                                user: `Queue worker: ${process.pid}`
                            };
                            data.events.push(tmp);
                            data.save(function (err) {
                            });
                        }
                    });
                  }
              } else {
                  if (data.status < 0) data.status = 0;
                  const now = Math.floor(new Date().getTime() / 1000);
                  const tmp = {
                      time: now,
                      event: '== Email has been sent. ==',
                      user: `Queue worker: ${process.pid}`
                  };
                  data.events.push(tmp);
                  data.messageId = info.messageId;
                  data.save(function (err) {
                      if (err) {
                          done(new Error(err));
                          if(job.data.mailDbID){
                            mailDb.mail
                            .findById(job.data.mailDbID)
                            .select('status events')
                            .exec(function (err, data) {
                                if (err || !data) {
                                } else {
                                    if (data.status < 0) data.status = -2;
                                    const now = Math.floor(new Date().getTime() / 1000);
                                    const tmp = {
                                        time: now,
                                        event: `[Error] ${err}`,
                                        user: `Queue worker: ${process.pid}`
                                    };
                                    data.events.push(tmp);
                                    data.save(function (err) {
                                    });
                                }
                            });
                          }
                      }else{
                        job.progress(100);
                        done();
                      } 
                  });
              }
          });
        }else{
          job.progress(100);
          done();
        }
      }
  });
});

exports.mailQueue = mailQueue;