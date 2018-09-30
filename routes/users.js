const express = require("express");
const router = express.Router();
const path = require("path");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const uploadDir = path.join(__dirname, "../uploads");
const multer = require("multer");
const randToken = require("rand-token");

const User = require("../models/user");
const Log = require("../middlewares/log");
const i18n = require("../middlewares/i18n");
const Email = require("../middlewares/email");
const DateUtils = require("../middlewares/date-utils");
const config = require("../config/setting");
const rpcserver = require("../middlewares/rpcserver");
const ForgottenPasswordToken = require("../models/forgotPassword");
const Receipt = require("../models/receipt");
const BurnRequest = require("../models/burnRequest");
const Price = require("../models/price");

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: function(req, file, cb) {
    raw = randToken.generate(16);
    cb(null, raw.toString("hex") + Date.now() + path.extname(file.originalname));
  }
});
var upload = multer({ storage: storage });

//Register
router.post("/register", i18n, async (req, res, next) => {
  let newUser = new User({
    email: req.body.email,
    password: req.body.password,
    referal: req.body.referal
  });
  isValid = await User.checkReferal(newUser.referal);
  if (isValid) {
    user = await User.addUser(newUser);
    var locals = { server: config.serverAddr, email: user.email, emailVerificationToken: user.emailVerificationToken };
    Email.sendMail(user.email, "register", locals);
    Log(req, "Info: User registered successfuly", user.email);
    return res.json({
      success: true,
      msg: __("Your account created successfuly, please verify your email via verification link sent to your meilbox")
    });
  }
});

//Authenticate
router.post("/authenticate", i18n, async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  user = await User.getUserByEmail(email);
  if (!user.emailVerified) {
    throw new Error("Email not verified, go to your mailbox and click on verification link");
  }
  if (!user.enabled) {
    throw new Error("Your Account dissabled by admin, please contact to admin");
  }

  isMatch = await User.comparePassword(password, user.password);
  if (isMatch) {
    const token = jwt.sign(user.toJSON(), config.secret, {
      expiresIn: 604800 // 1 week in sec
    });
    Log(req, "Info: User authenticated successfuly", email);
    user["password"] = "***";
    return res.json({
      success: true,
      token: "JWT " + token,
      user: user
    });
  } else {
    throw new Error("Wrong Password");
  }
});

// Verify Email
router.get("/verifyemail", i18n, async (req, res, next) => {
  const verificationToken = req.query.verificationToken;
  const email = req.query.email;
  user = await User.getUserByEmail(email);
  if (user.emailVerificationToken != verificationToken) {
    Log(req, "Error: Wrong Token", email);
    return res.redirect('/panel/#/login?msg="' + __("Email Not Verified, Wrong Token") + '"');
  } else {
    user.emailVerified = true;
    await user.save();
    Log(req, "Info: Email Verified successfuly", email);
    return res.redirect('/panel/#/login?msg="' + __("Email Verified successfuly") + '"');
  }
});

// Forgot Password
router.post("/forgotpassword", i18n, async (req, res, next) => {
  let passwordToken = new ForgottenPasswordToken({
    email: req.body.email
  });
  user = await User.getUserByEmail(passwordToken.email);
  passwordToken = await ForgottenPasswordToken.forgotPassword(passwordToken);
  var locals = { server: config.serverAddr, email: user.email, passwordToken: passwordToken.token };
  Email.sendMail(user.email, "resetPassword", locals);
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
      user = await User.getUserByEmail(email);
      user = await User.changePassword(user, password);
      Log(req, "Info: Password reset successfuly", user.email);
      return res.json({
        success: true,
        msg: __("Password changed successfuly")
      });
    }
  }
});

// Change Password
router.post("/changepassword", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const email = req.user.email;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;
  user = await User.getUserByEmail(email);

  isMatch = await User.comparePassword(oldPassword, user.password);
  if (isMatch) {
    user = await User.changePassword(user, newPassword);
    Log(req, "Info: Password changed successfuly", user.email);
    return res.json({
      success: true,
      msg: __("Password changed successfuly")
    });
  } else {
    throw new Error("Wrong Old Password");
  }
});

// Update KYC
router.post("/updatekyc", [passport.authenticate("jwt", { session: false }), i18n, upload.single("passportImage")], async (req, res, next) => {
  const email = req.user.email;

  user = await User.getUserByEmail(email);
  user.firstName = req.body.firstName;
  user.lastName = req.body.lastName;
  user.birthDate = req.body.birthDate;
  user.telephone = req.body.telephone;
  user.address = req.body.address;
  user.hasWallet = req.body.hasWallet;
  if (user.hasWallet) {
    user.walletAddress = req.body.walletAddress;
  }
  if (user.passportImageAddress) {
    fs.unlink(uploadDir + "/" + user.passportImageAddress, err => {
      if (err) throw err;
    });
  }
  if (req.file) {
    user.passportImageAddress = req.file.filename;
  }
  user.KYCUpdated = true;
  user.KYCVerified = false;
  try {
    await user.save();
  } catch (ex) {
    if (ex.code == 11000) {
      throw new Error("Wallet address used by another user");
    } else {
      throw ex;
    }
  }
  Log(req, "Info: User KYC Updated", user.email);
  return res.json({ success: true, msg: __("Your KYC Updated, please wait to admin verify them") });
});

// Sign Contract
router.post("/sign-contract", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const email = req.user.email;
  const contractType = req.body.contractType;
  user = await User.getUserByEmail(email);

  if (!user.KYCVerified) {
    throw new Error("KYC not verified, please update your KYC and wait to admin verify them");
  } else {
    user.contractType = contractType;
    user.SignedContract = true;

    referal = await User.getUserByStrId(user.referal);
    referWallet = referal.walletAddress;
    rpcResponse = await rpcserver.addToWhiteList(user.walletAddress, referWallet);

    if (rpcResponse.success) {
      Log(req, "Info: Wallet(" + user.walletAddress + ") added to whitelist, txID: " + rpcResponse.msg, "SYSTEM");
      await user.save();
      Log(req, "Info: Contract (" + contractType + ") signed by user", req.user.email);
      return res.json({ success: true, msg: __("Contract Signed successfuly") });
    } else {
      throw new Error(rpcResponse.msg);
    }
  }
});

// Get Referals
router.get("/getreferal", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const userId = req.user._id;
  referals = await User.getUserReferals(userId);
  var ReferedUsers = [];
  referals.forEach(function(referal, index, array) {
    ReferedUsers.push({ email: referal.email });
  });
  Log(req, "Info: Get Refeals successfuly", req.user.email);
  return res.json({ success: true, referals: ReferedUsers });
});

// Upload Sale Receipt by exchanger
router.post("/receipt", [passport.authenticate("jwt", { session: false }), i18n, upload.single("receipt")], async (req, res, next) => {
  const userId = req.user._id;
  const receiptNumber = Number(req.body.receiptNumber);
  const comment = req.body.comment;

  receipt = await Receipt.getReceiptByNumber(receiptNumber);
  if (String(receipt.user._id) != String(userId)) {
    throw new Error("You can not view others' receipt");
  } else {
    receipt.userComment = comment;
    receipt.userSubmitDate = new Date();
  }
  if (req.file) {
    receipt.userReceipt = req.file.filename;
  }
  receipt = await receipt.save();
  Log(req, "Info: Receipt Number (" + receipt.receiptNumber + ") Updated by user", req.user.email);
  res.json({ success: true, msg: __("Receipt Number %i updated successfuly", receipt.receiptNumber) });
});

// list all Receipt submited for user
router.get("/list-receipt", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const userId = req.user._id;

  receipts = await Receipt.getUserReceipts(userId);
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Pending Receipt submited for user
router.get("/list-pending-receipt", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const userId = req.user._id;

  receipts = await Receipt.getUserReceipts(userId, "Pending");
  Log(req, "Info: Pending Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// return user balance
router.get("/balance", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const email = req.user.email;

  user = await User.getUserByEmail(email);
  Log(req, "Info: Balance returned", req.user.email);
  res.json({ success: true, balance: user.balance });
});

// request to burn some token and give mony
router.post("/burn", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const amount = req.body.amount;

  if (amount > req.user.balance) {
    throw new Error("Requested amount greater than your balance");
  }
  const price = await Price.getLastPrice();
  let newBurnReq = new BurnRequest({
    user: req.user._id,
    userEmail: req.user.email,
    userComment: req.body.comment,
    userSubmitDate: new Date(),
    amount: amount,
    tokenPrice: price.price,
    verificationToken: randToken.generate(8),
    verificationTokenExpire: await DateUtils.addminutes(new Date(), 15),
    verified: false,
    status: "Pending"
  });
  burnRequest = await newBurnReq.save();
  var locals = { amount: burnRequest.amount, verificationToken: burnRequest.verificationToken };
  Email.sendMail(req.user.email, "verifyBurnRequest", locals);
  Log(req, "Info: BurnRequest Number (" + burnRequest.BurnRequestNumber + ") Submited", req.user.email);
  res.json({ success: true, msg: __("BurnRequest Number %i Submited", burnRequest.BurnRequestNumber) });
});

// request to burn some token and give mony
router.post("/burn-cancel", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const userId = req.user._id;
  const burnRequestNumber = Number(req.body.burnRequestNumber);
  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  if (String(burnRequest.user._id) != String(userId)) {
    throw new Error("You can not cancel others' burnRequest");
  }
  burnRequest.status = "Canceled";
  await burnRequest.save();
  Log(req, "Info: BurnRequest Number (" + burnRequest.BurnRequestNumber + ") Canceled", req.user.email);
  res.json({ success: true, msg: __("BurnRequest Number %i Canceled", burnRequest.BurnRequestNumber) });
});

// Verify Burn resend token
router.post("/burn-resend-token", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const burnRequestNumber = Number(req.body.burnRequestNumber);

  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  burnRequest.verificationToken = randToken.generate(8);
  burnRequest.verificationTokenExpire = await DateUtils.addminutes(new Date(), 15);
  burnRequest.verified = false;
  await burnRequest.save();
  var locals = { amount: burnRequest.amount, verificationToken: burnRequest.verificationToken };
  Email.sendMail(req.user.email, "verifyBurnRequest", locals);
  Log(req, "Info: Verification email for BurnRequest Number (" + burnRequest.BurnRequestNumber + ") resent", req.user.email);
  res.json({ success: true, msg: ــ("Verification email for BurnRequest Number %i resent", burnRequest.BurnRequestNumber) });
});

// Verify Burn
router.post("/burn-verify", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const verificationToken = req.body.verificationToken;

  const burnRequestNumber = Number(req.body.burnRequestNumber);

  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  if (burnRequest.verificationToken != verificationToken) {
    throw new Error("Entered code is incorrect");
  } else if (burnRequest.verificationTokenExpire < Date.now()) {
    throw new Error("Entered code is expired, please request again to send new code");
  }
  burnRequest.verified = true;
  await burnRequest.save();
  Log(req, "Info: BurnRequest Number (" + burnRequest.BurnRequestNumber + ") Verified", req.user.email);
  res.json({ success: true, msg: __("BurnRequest Number %i Verified", burnRequest.BurnRequestNumber) });
});

// list all BurnRequests submited for user
router.get("/list-burn", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const userId = req.user._id;

  burnRequests = await BurnRequests.getUserBurnRequests(userId);
  Log(req, "Info: BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequest: burnRequests });
});

// list all Pending BurnRequests submited for user
router.get("/list-pending-burn", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const userId = req.user._id;

  burnRequests = await BurnRequest.getUserBurnRequests(userId, "Pending");
  Log(req, "Info: Pending BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

module.exports = router;
