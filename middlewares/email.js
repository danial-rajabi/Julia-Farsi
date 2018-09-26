var nodemailer = require("nodemailer");
var emailConfig = require("../config/email");

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
    from: emailUsername,
    to: emailTo,
    subject: emailSubject,
    html: mailContent
  };
  info = await transporter.sendMail(mailOptions);
  Log("Info: Email sent to " + emailTo, "SYSTEM");

  return info;
};
