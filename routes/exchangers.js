const express = require("express");
const router = express.Router();
const passport = require("passport");
const randToken = require("rand-token");
const multer = require("multer");
const path = require("path");

const Log = require("../middlewares/log");
const Receipt = require("../models/receipt");
const User = require("../models/user");
const Exchanger = require("../models/exchanger");
const autorize = require("../middlewares/authorize");
const i18n = require("../middlewares/i18n");

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

// Upload Sale Receipt by exchanger
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
    if (receipt.exchangerEmail != email) {
      throw new Error("You can not view others' receipt");
    }
    if (req.file) {
      receipt.exchangerReceipt = req.file.filename;
    }
    receipt.exchangerComment = comment;
    receipt.exchangerSubmitDate = new Date();
    receipt = await receipt.save();
    Log(req, "Info: Receipt number (" + receipt.receiptNumber + ") Created", req.user.email);
    res.json({ success: true, msg: __("Your documnets for receipt number %i uploaded successfuly", receipt.receiptNumber) });
  }
);

// Search Sale Receipt by verificationCode
router.post("/search-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const verificationCode = req.body.verificationCode;
  receipt = await Receipt.getReceiptByVerificationCode(verificationCode);
  if (receipt.codeExpiration < new Date()) {
    receipt.status = "Expired";
    await receipt.save();
    throw new Error("Reciept Expired");
  }
  Log(req, "Info: Receipt number (" + receipt.receiptNumber + ") returned by search", req.user.email);
  res.json({ success: true, receipt: receipt });
});

// Get KYC informations of a user
router.post("/get-user", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const userEmail = req.body.userEmail;

  user = await User.getUserByEmail(userEmail);
  Log(req, "Info: Get user KYC info successfuly", req.user.email);
  return res.json({ success: true, user: user });
});

// exchanger profile information
router.get("/profile", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  exchanger = await Exchanger.getExchangerByEmail(req.user.email);
  Log(req, "Info: User profile returned", req.user.email);
  res.json({ success: true, exchanger: exchanger });
});

// list all Receipt submited for exchanger
router.get("/list-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;

  receipts = await Receipt.getExchangerReceipts(email);
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list Pending Receipt submited for exchanger
router.get("/list-pending-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;

  receipts = await Receipt.getExchangerReceipts(email, "Pending");
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

module.exports = router;
