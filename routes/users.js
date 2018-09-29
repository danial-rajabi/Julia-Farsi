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
const Email = require("../middlewares/email");
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
router.post("/register", async (req, res, next) => {
  let newUser = new User({
    email: req.body.email,
    password: req.body.password,
    referal: req.body.referal
  });
  isValid = await User.checkReferal(newUser.referal);
  if (isValid) {
    user = await User.addUser(newUser);
    var mailContent = "Hi<br>";
    mailContent +=
      "Your account registered suuccesfuly. To verify that this email address belongs to you, verify your email address. You can do this here:<br>";
    mailContent +=
      '<a href="' +
      config.serverAddr +
      "/users/verifyemail?email=" +
      user.email +
      "&verificationToken=" +
      user.emailVerificationToken +
      '">Verifiy Email Address</a>';
    Email.sendMail(user.email, "Verification Email", mailContent);
    Log(req, "Info: User registered successfuly", user.email);
    return res.json({
      success: true,
      msg: "Your account created successfuly, please verify your email via verification link sent to your meilbox"
    });
  }
});

//Authenticate
router.post("/authenticate", async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  user = await User.getUserByEmail(email);
  if (!user.emailVerified) {
    throw new Error("Email not verified");
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
router.get("/verifyemail", async (req, res, next) => {
  const verificationToken = req.query.verificationToken;
  const email = req.query.email;
  user = await User.getUserByEmail(email);
  if (user.emailVerificationToken != verificationToken) {
    Log(req, "Error: Wrong Token", email);
    return res.redirect('/panel/#/login?msg="Email Not Verified, Wrong Token"');
  } else {
    user.emailVerified = true;
    await user.save();
    Log(req, "Info: Email Verified successfuly", email);
    return res.redirect('/panel/#/login?msg="Email Verified successfuly"');
  }
});

// Forgot Password
router.post("/forgotpassword", async (req, res, next) => {
  let passwordToken = new ForgottenPasswordToken({
    email: req.body.email
  });
  user = await User.getUserByEmail(passwordToken.email);
  passwordToken = await ForgottenPasswordToken.forgotPassword(passwordToken);
  var mailContent =
    '<a href="' +
    config.serverAddr +
    "users/resetpassword?email=" +
    passwordToken.email +
    "&resetpasswordtoken=" +
    passwordToken.token +
    '"Reset Password Link</a>';
  Email.sendMail(user.email, "Reset Password", mailContent);
  return res.json({ success: true, msg: "Reset Password Email sent" });
});

// Reset Password
router.post("/resetpassword", async (req, res, next) => {
  const resetPassToken = req.body.resetpasswordtoken;
  const email = req.body.email;
  const password = req.body.password;

  token = await ForgottenPasswordToken.getTokenByToken(resetPassToken);
  if (!token || token.email != email) {
    throw new Error("Invalid Token");
  } else {
    token.remove();
    if (token.expiration < Date.now()) {
      throw new Error("Expired Token");
    } else {
      user = await User.getUserByEmail(email);
      user = await User.changePassword(user, password);
      Log(req, "Info: Password reset successfuly", user.email);
      return res.json({
        success: true,
        msg: "Password reset successfuly"
      });
    }
  }
});

// Change Password
router.post("/changepassword", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const email = req.user.email;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;
  user = await User.getUserByEmail(email);
  if (!user.emailVerified) {
    throw new Error("Email not verified");
  }

  isMatch = await User.comparePassword(oldPassword, user.password);
  if (isMatch) {
    user = await User.changePassword(user, newPassword);
    Log(req, "Info: Password changed successfuly", user.email);
    return res.json({
      success: true,
      msg: "Password changed successfuly"
    });
  } else {
    throw new Error("Wrong Old Password");
  }
});

// Update KYC
router.post("/updatekyc", passport.authenticate("jwt", { session: false }), upload.single("passportImage"), async (req, res, next) => {
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
    return await user.save();
  } catch (ex) {
    if (ex.code == 11000) {
      throw new Error("Wallet address used by another user");
    } else {
      throw ex;
    }
  }

  Log(req, "Info: User KYC Updated", user.email);
  return res.json({ success: true, msg: "User KYC Updated" });
});

// Sign Contract
router.post("/sign-contract", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const email = req.user.email;
  const contractType = req.body.contractType;
  user = await User.getUserByEmail(email);

  if (!user.KYCVerified) {
    Log(req, "Error: KYC not verified yet", email);
    return res.json({ success: false, msg: "KYC not verified, please update your KYC and wait to verify by admin" });
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
      return res.json({ success: true, msg: "Contract Signed successfuly" });
    } else {
      throw new Error(rpcResponse.msg);
    }
  }
});

// Get Referals
router.get("/getreferal", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
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
router.post("/receipt", passport.authenticate("jwt", { session: false }), upload.single("receipt"), async (req, res, next) => {
  const userId = req.user._id;
  const receiptNumber = Number(req.body.receiptNumber);
  const comment = req.body.comment;

  receipt = await Receipt.getReceiptByNumber(receiptNumber);
  if (String(receipt.user._id) != String(userId)) {
    throw new Error("User can not view others' receipt");
  } else {
    receipt.userComment = comment;
    receipt.userSubmitDate = new Date();
  }
  if (req.file) {
    receipt.userReceipt = req.file.filename;
  }
  receipt = await receipt.save();
  Log(req, "Info: Receipt Number (" + receipt.receiptNumber + ") Updated by user", req.user.email);
  res.json({ success: true, msg: "Receipt Number (" + receipt.receiptNumber + ") Updated by user" });
});

// list all Receipt submited for user
router.get("/list-receipt", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userId = req.user._id;

  receipts = await Receipt.getUserReceipts(userId);
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Pending Receipt submited for user
router.get("/list-pending-receipt", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userId = req.user._id;

  receipts = await Receipt.getUserReceipts(userId, "Pending");
  Log(req, "Info: Pending Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// return user balance
router.get("/balance", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const email = req.user.email;

  user = await User.getUserByEmail(email);
  Log(req, "Info: Balance returned", req.user.email);
  res.json({ success: true, balance: user.balance });
});

// request to burn some token and give mony
router.post("/burn", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
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
    tokenPrice: price,
    status: "Pending"
  });
  burnRequest = await newBurnReq.save();
  receipt = await newReceipt.save();
  Log(req, "Info: BurnRequest Number (" + burnRequest.BurnRequestNumber + ") Submited", req.user.email);
  res.json({ success: true, msg: "BurnRequest Number (" + burnRequest.BurnRequestNumber + ") Submited" });
});

// list all BurnRequests submited for user
router.get("/list-burn", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userId = req.user._id;

  burnRequests = await BurnRequests.getUserBurnRequests(userId);
  Log(req, "Info: BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

// list all Pending BurnRequests submited for user
router.get("/list-pending-burn", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userId = req.user._id;

  burnRequests = await BurnRequests.getUserBurnRequests(userId, "Pending");
  Log(req, "Info: Pending BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

module.exports = router;
