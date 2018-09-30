var nodemailer = require("nodemailer");
var emailConfig = require("../config/email");
const Log = require("../middlewares/log");
const Email = require("email-templates");

module.exports.sendMail = async function(emailTo, template, locals) {
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailConfig.emailUsername,
      pass: emailConfig.emailPassword
    }
  });

  const email = new Email({
    message: {
      from: emailConfig.emailUsername
    },
    // send: true,
    // preview: false,
    transport: transporter
  });
  info = await email.send({
    template: template,
    message: { to: emailTo },
    locals: locals
  });
  Log(null, "Info: Email sent to " + emailTo, "SYSTEM");
  console.log(info);

  return info;
};
