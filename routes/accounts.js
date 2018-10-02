const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

const Account = require("../models/account");
const Log = require("../middlewares/log");
const i18n = require("../middlewares/i18n");
const Email = require("../middlewares/email");
const config = require("../config/setting");
const ForgottenPasswordToken = require("../models/forgotPassword");

//Authenticate
router.post("/authenticate", i18n, async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  account = await Account.getAccountByEmail(email);
  if (!account.emailVerified) {
    throw new Error("Email not verified, go to your mailbox and click on verification link");
  }
  if (!account.enabled) {
    throw new Error("Your Account dissabled by admin, please contact to admin");
  }

  isMatch = await Account.comparePassword(password, account.password);
  if (isMatch) {
    const token = jwt.sign(account.toJSON(), config.secret, {
      expiresIn: 604800 // 1 week in sec
    });
    Log(req, "Info: User authenticated successfuly", email);
    account["password"] = "***";
    return res.json({
      success: true,
      token: "JWT " + token,
      account: account
    });
  } else {
    throw new Error("Wrong Password");
  }
});

// Verify Email
router.get("/verifyemail", i18n, async (req, res, next) => {
  const verificationToken = req.query.verificationToken;
  const email = req.query.email;
  account = await Account.getAccountByEmail(email);

  if (account.emailVerificationToken != verificationToken) {
    Log(req, "Error: Wrong Token", email);
    return res.redirect('/panel/#/login?msg="' + __("Email Not Verified, Wrong Token") + '"');
  } else {
    account.emailVerified = true;
    await account.save();
    Log(req, "Info: Email Verified successfuly", email);
    return res.redirect('/panel/#/login?msg="' + __("Email Verified successfuly") + '"');
  }
});

// Forgot Password
router.post("/forgotpassword", i18n, async (req, res, next) => {
  let passwordToken = new ForgottenPasswordToken({
    email: req.body.email
  });
  account = await Account.getAccountByEmail(passwordToken.email);
  passwordToken = await ForgottenPasswordToken.forgotPassword(passwordToken);
  var locals = { server: config.serverAddr, email: account.email, passwordToken: passwordToken.token };
  await Email.sendMail(account.email, "resetPassword", locals);
  return res.json({ success: true, msg: __("Reset Password Email sent to your mailbox") });
});

// Reset Password
router.post("/resetpassword", i18n, async (req, res, next) => {
  const resetPassToken = req.body.resetpasswordtoken;
  const email = req.body.email;
  const password = req.body.password;

  token = await ForgottenPasswordToken.getTokenByToken(resetPassToken);
  if (!token || token.email != email) {
    throw new Error("Invalid Token entered");
  } else {
    token.remove();
    if (token.expiration < Date.now()) {
      throw new Error("Expired Token, request reset password again");
    } else {
      account = await Account.getAccountByEmail(email);
      account = await Account.changePassword(account, password);
      Log(req, "Info: Password reset successfuly", account.email);
      return res.json({
        success: true,
        msg: __("Password changed successfuly")
      });
    }
  }
});

// Change Password
router.post("/changepassword", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const email = req.account.email;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;
  account = await Account.getAccountByEmail(email);

  isMatch = await Account.comparePassword(oldPassword, account.password);
  if (isMatch) {
    account = await Account.changePassword(account, newPassword);
    Log(req, "Info: Password changed successfuly", account.email);
    return res.json({
      success: true,
      msg: __("Password changed successfuly")
    });
  } else {
    throw new Error("Wrong Old Password");
  }
});

module.exports = router;
