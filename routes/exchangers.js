const express = require("express");
const router = express.Router();
const passport = require("passport");
const randToken = require("rand-token");
const multer = require("multer");
const path = require("path");

const Log = require("../middlewares/log");
const SaleReceipt = require("../models/sale-receipt");
const User = require("../models/user");
const Email = require("../middlewares/email");
const autorize = require("../middlewares/authorize");

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
router.post("/receipt", [passport.authenticate("jwt", { session: false }), upload.single("receipt"), autorize], async (req, res, next) => {
  const exchangerId = req.user._id;
  const userNumber = Number(req.body.userNumber);
  const comment = req.body.comment;

  user = await User.getUserByNumber(userNumber);
  console.log(user);
  let newReceipt = new SaleReceipt({
    exchanger: exchangerId,
    exchangerComment: comment,
    exchangerSubmitDate: new Date(),
    amount: req.body.amount,
    user: user._id,
    status: "Unknown"
  });
  if (req.file) {
    newReceipt.exchangerReceipt = req.file.filename;
  }
  receipt = await newReceipt.save();
  Log("URL: /exchangers/receipt, Info: Receipt Number(" + receipt.receiptNumber + ") Created", req.user.email);
  res.json({ success: true, msg: "Receipt Number(" + receipt.receiptNumber + ") Created" });
});

// Get KYC informations of a user
router.post("/get-kyc", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const userNumber = Number(req.body.userNumber);

  user = await User.getUserKYCByNumber(userNumber);
  Log("URL: /exchangers/get-kyc, Info: Get user KYC info successfuly", req.user.email);
  return res.json({ success: true, user: user });
});

// Upload Sale Receipt by exchanger
router.post("/list-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const exchangerId = req.user._id;

  receipts = await SaleReceipt.getExchangerReceipt(exchangerId);
  Log("URL: /exchangers/list-receipt, Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

module.exports = router;
