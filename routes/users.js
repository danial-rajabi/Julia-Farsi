const express = require("express");
const router = express.Router();
const path = require("path");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const uploadDir = path.join(__dirname, "../uploads");
const multer = require("multer");
const randToken = require("rand-token");
// const randToken = require("rand-token").generator({
//   chars: "A-Z"
// });

const User = require("../models/user");
const Log = require("../middlewares/log");
const i18n = require("../middlewares/i18n");
const Email = require("../middlewares/email");
const DateUtils = require("../middlewares/date-utils");
const config = require("../config/setting");
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
  const email = req.body.email;
  const password = req.body.password;
  const referal = req.body.referal;
  account = await User.addUser(email, password, referal);
  var locals = { server: config.serverAddr, email: account.email, emailVerificationToken: account.emailVerificationToken };
  await Email.sendMail(account.email, "register", locals);
  Log(req, "Info: User registered successfuly", account.email);
  return res.json({
    success: true,
    msg: __("Your account created successfuly, please verify your email via verification link sent to your meilbox")
  });
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

    await user.save();
    Log(req, "Info: Contract (" + contractType + ") signed by user", req.user.email);
  }
});

// Get Referals
router.get("/getreferal", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const email = req.user.email;
  user = await User.getUserByEmail(email);

  referals = await User.getUserReferals(user._id);
  Log(req, "Info: Get Refeals successfuly", req.user.email);
  return res.json({ success: true, referals: referals });
});

// Upload Sale Receipt by exchanger
router.post("/create-receipt", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const email = req.user.email;
  const amount = req.body.amount;
  const exchangerEmail = req.body.exchangerEmail;
  exchanger = await Exchanger.getExchangerByEmail(exchangerEmail);
  user = await User.getUserByEmail(email);

  let newReceipt = new Receipt({
    exchanger: exchanger._id,
    exchangerEmail: exchanger.email,
    amount: amount,
    user: user._id,
    userEmail: user.email,
    verificationCode: randToken.generate(10),
    codeExpiration: await DateUtils.addDays(new Date(), 3),
    status: "Pending"
  });

  receipt = await newReceipt.save();
  Log(req, "Info: Receipt Number (" + receipt.receiptNumber + ") Created", req.user.email);
  res.json({ success: true, msg: "Receipt Number (" + receipt.receiptNumber + ") Created" });
});

// list all Receipt submited for user
router.get("/list-receipt", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const accountId = req.user._id;

  receipts = await Receipt.getUserReceipts(accountId);
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Pending Receipt submited for user
router.get("/list-pending-receipt", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const accountId = req.user._id;

  receipts = await Receipt.getUserReceipts(accountId, "Pending");
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
  await Email.sendMail(req.user.email, "verifyBurnRequest", locals);
  Log(req, "Info: BurnRequest Number (" + burnRequest.BurnRequestNumber + ") Submited", req.user.email);
  res.json({ success: true, msg: __("BurnRequest Number %i Submited", burnRequest.BurnRequestNumber) });
});

// request to burn some token and give mony
router.post("/burn-cancel", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const accountId = req.user._id;
  const burnRequestNumber = Number(req.body.burnRequestNumber);
  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  if (String(burnRequest.user._id) != String(accountId)) {
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
  await Email.sendMail(req.user.email, "verifyBurnRequest", locals);
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
  const accountId = req.user._id;

  burnRequests = await BurnRequests.getUserBurnRequests(accountId);
  Log(req, "Info: BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequest: burnRequests });
});

// list all Pending BurnRequests submited for user
router.get("/list-pending-burn", [passport.authenticate("jwt", { session: false }), i18n], async (req, res, next) => {
  const accountId = req.user._id;

  burnRequests = await BurnRequest.getUserBurnRequests(accountId, "Pending");
  Log(req, "Info: Pending BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

// list all Pending BurnRequests submited for user
router.get("/test", async (req, res, next) => {
  token = await randToken.generate(10).toLocaleUpperCase();
  res.json({ success: true, token: token });
});
module.exports = router;
