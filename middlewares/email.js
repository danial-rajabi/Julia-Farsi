var nodemailer = require("nodemailer");
var emailConfig = require("../config/email");
const Log = require("../middlewares/log");

module.exports.sendMail = async function(emailTo, emailSubject, emailContent) {
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailConfig.emailUsername,
      pass: emailConfig.emailPassword
    }
  });
  var mailContent = emailContent;
  var mailOptions = {
    from: emailConfig.emailUsername,
    to: emailTo,
    subject: emailSubject,
    html: mailContent
  };
  info = await transporter.sendMail(mailOptions);
  Log(null, "Info: Email sent to " + emailTo, "SYSTEM");

  return info;
};
