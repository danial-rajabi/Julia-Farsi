const express = require("express");
const router = express.Router();
const path = require("path");
const passport = require("passport");
const fs = require("fs");
const uploadDir = path.join(__dirname, "../uploads");
const multer = require("multer");
const randToken = require("rand-token");

const Log = require("../middlewares/log");
const i18n = require("../middlewares/i18n");
const autorize = require("../middlewares/authorize");
const Email = require("../middlewares/email");
const DateUtils = require("../middlewares/date-utils");
const config = require("../config/setting");
const User = require("../models/user");
const Receipt = require("../models/receipt");
const BurnRequest = require("../models/burnRequest");
const Exchanger = require("../models/exchanger");
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

// Get KYC Code for display in passportImage by user
router.get("/kyc-code", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;
  code = randToken.generate(6, "0123456789");
  user = await User.getUserByEmail(email);
  user.KYCCode = code;
  await user.save();
  Log(req, "Info: KYCCode Returned", user.email);
  return res.json({ success: true, code: code });
});

// user profile information
router.get("/profile", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  user = await User.getUserByEmail(req.user.email);
  Log(req, "Info: User profile returned", req.user.email);
  res.json({ success: true, user: user });
});

// list All exchangers
router.get("/exchangers", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  exchangers = await Exchanger.getEnabledExchangersList();
  Log(req, "Info: All exchangers list returned", req.user.email);
  res.json({ success: true, exchangers: exchangers });
});

// get exchanger informations
router.post("/exchanger", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  exchangerEmail = req.body.email;
  exchanger = await Exchanger.getExchangerByEmail(exchangerEmail);
  Log(req, "Info: Exchanger profile returned", req.user.email);
  res.json({ success: true, exchanger: exchanger });
});

// Update KYC
router.post("/updatekyc", [passport.authenticate("jwt", { session: false }), i18n, autorize, upload.any()], async (req, res, next) => {
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
  req.files.forEach(async file => {
    if (file.fieldname == "passportImage") {
      user.passportImageAddress = file.filename;
    }
    if (file.fieldname == "image") {
      user.imageAddress = file.filename;
    }
  });

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
router.post("/sign-contract", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
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
router.get("/getreferal", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;
  user = await User.getUserByEmail(email);

  referals = await User.getUserReferals(user._id);
  Log(req, "Info: Get Refeals successfuly", req.user.email);
  return res.json({ success: true, referals: referals });
});

// Create Receipt and get code
router.post("/create-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;
  const amount = req.body.amount;
  const exchangerEmail = req.body.exchangerEmail;
  console.log(exchangerEmail, "--");

  exchanger = await Exchanger.getExchangerByEmail(exchangerEmail);
  user = await User.getUserByEmail(email);

  let newReceipt = new Receipt({
    exchanger: exchanger._id,
    exchangerEmail: exchanger.email,
    amount: amount,
    user: user._id,
    userEmail: user.email,
    verificationCode: randToken.generate(8).toUpperCase(),
    codeExpiration: await DateUtils.addDays(new Date(), 3),
    status: "Pending"
  });

  receipt = await newReceipt.save();
  Log(req, "Info: Receipt number (" + receipt.receiptNumber + ") Created", req.user.email);
  res.json({ success: true, msg: __("Receipt number %i created successfuly", receipt.receiptNumber), receipt: receipt });
});

// Upload Sale Receipt by user
router.post(
  "/complete-receipt",
  [passport.authenticate("jwt", { session: false }), i18n, autorize, upload.single("receipt")],
  async (req, res, next) => {
    const email = req.user.email;
    const comment = req.body.comment;
    const receiptNumber = Number(req.body.receiptNumber);
    receipt = await Receipt.getReceiptByNumber(receiptNumber);
    if (receipt.codeExpiration < new Date() && !receipt.exchangerSubmitDate && !receipt.userSubmitDate) {
      receipt.status = "Expired";
      await receipt.save();
      throw new Error("Reciept Expired");
    }
    console.log(receipt.userEmail);

    if (receipt.userEmail != email) {
      throw new Error("You can not view others' receipt");
    }
    if (req.file) {
      receipt.userReceipt = req.file.filename;
    }
    receipt.userSubmitDate = new Date();
    receipt.userComment = comment;
    receipt = await receipt.save();
    Log(req, "Info: Receipt number (" + receipt.receiptNumber + ") Created", req.user.email);
    res.json({ success: true, msg: __("Your documnets for receipt number %i uploaded successfuly", receipt.receiptNumber) });
  }
);

// list all Receipt submited for user
router.get("/list-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;

  receipts = await Receipt.getUserReceipts(email);
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Pending Receipt submited for user
router.get("/list-pending-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;

  receipts = await Receipt.getUserReceipts(email, "Pending");
  Log(req, "Info: Pending Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// return user balance
router.get("/balance", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;

  user = await User.getUserByEmail(email);
  Log(req, "Info: Balance returned", req.user.email);
  res.json({ success: true, balance: user.balance });
});

// request to burn some token and give mony
router.post("/burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
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
  Log(req, "Info: BurnRequest number (" + burnRequest.BurnRequestNumber + ") Submited", req.user.email);
  res.json({ success: true, msg: __("BurnRequest number %i Submited", burnRequest.BurnRequestNumber) });
});

// request to burn some token and give mony
router.post("/burn-cancel", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const accountId = req.user._id;
  const burnRequestNumber = Number(req.body.burnRequestNumber);
  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  if (String(burnRequest.user._id) != String(accountId)) {
    throw new Error("You can not cancel others' burnRequest");
  }
  burnRequest.status = "Canceled";
  await burnRequest.save();
  Log(req, "Info: BurnRequest number (" + burnRequest.BurnRequestNumber + ") Canceled", req.user.email);
  res.json({ success: true, msg: __("BurnRequest number %i Canceled", burnRequest.BurnRequestNumber) });
});

// Verify Burn resend token
router.post("/burn-resend-token", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const burnRequestNumber = Number(req.body.burnRequestNumber);

  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  burnRequest.verificationToken = randToken.generate(8);
  burnRequest.verificationTokenExpire = await DateUtils.addminutes(new Date(), 15);
  burnRequest.verified = false;
  await burnRequest.save();
  var locals = { amount: burnRequest.amount, verificationToken: burnRequest.verificationToken };
  await Email.sendMail(req.user.email, "verifyBurnRequest", locals);
  Log(req, "Info: Verification email for BurnRequest number (" + burnRequest.BurnRequestNumber + ") resent", req.user.email);
  res.json({ success: true, msg: ــ("Verification email for BurnRequest number %i resent", burnRequest.BurnRequestNumber) });
});

// Verify Burn
router.post("/burn-verify", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
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
  Log(req, "Info: BurnRequest number (" + burnRequest.BurnRequestNumber + ") Verified", req.user.email);
  res.json({ success: true, msg: __("BurnRequest number %i Verified", burnRequest.BurnRequestNumber) });
});

// list all BurnRequests submited for user
router.get("/list-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const accountId = req.user._id;

  burnRequests = await BurnRequests.getUserBurnRequests(accountId);
  Log(req, "Info: BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequest: burnRequests });
});

// list all Pending BurnRequests submited for user
router.get("/list-pending-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const accountId = req.user._id;

  burnRequests = await BurnRequest.getUserBurnRequests(accountId, "Pending");
  Log(req, "Info: Pending BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

module.exports = router;
