const express = require("express");
const router = express.Router();
const passport = require("passport");
const multer = require("multer");
const path = require("path");
const randToken = require("rand-token");

const User = require("../models/user");
const Exchanger = require("../models/exchanger");
const Admin = require("../models/admin");
const Receipt = require("../models/receipt");
const Price = require("../models/price");
const ForgottenPasswordToken = require("../models/forgotPassword");
const BurnRequest = require("../models/burnRequest");

const Log = require("../middlewares/log");
const Email = require("../middlewares/email");
const autorize = require("../middlewares/authorize");
const i18n = require("../middlewares/i18n");
const config = require("../config/setting");

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

// Register Exchanger
router.post(
  "/register-exchanger",
  [passport.authenticate("jwt", { session: false }), i18n, autorize, upload.single("image")],
  async (req, res, next) => {
    // console.log(req.body);
    // roles = [req.body.roles];
    console.log(req.body.roles);
    const enabled = req.body.enabled;
    var newExchanger = new Exchanger({
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      address: req.body.address,
      telephone: req.body.telephone
    });
    if (req.file) {
      newExchanger.imageAddress = req.file.filename;
    }
    account = await Exchanger.addExchanger(newExchanger, enabled);
    var passwordToken = new ForgottenPasswordToken({
      email: req.body.email
    });
    passwordToken = await ForgottenPasswordToken.forgotPassword(passwordToken);

    var locals = { server: config.serverAddr, email: account.email, passwordToken: passwordToken.token };
    await Email.sendMail(account.email, "register-other", locals);
    Log(req, "Info: Exchanger registered successfuly", account.email);
    return res.json({
      success: true,
      msg: __("Exchanger registered successfuly")
    });
  }
);

// Register Admin
router.post("/register-admin", [passport.authenticate("jwt", { session: false }), i18n, autorize, upload.single("image")], async (req, res, next) => {
  const enabled = req.body.enabled;
  roles = [];
  req.body.roles.forEach(async role => {
    roles.push({ roleTitle: role });
  });
  var newAdmin = new Admin({
    email: req.body.email,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    roles: roles,
    superAdmin: false
  });
  if (req.file) {
    newAdmin.imageAddress = req.file.filename;
  }
  account = await Admin.addAdmin(newAdmin, enabled);
  var passwordToken = new ForgottenPasswordToken({
    email: req.body.email
  });
  passwordToken = await ForgottenPasswordToken.forgotPassword(passwordToken);

  var locals = { server: config.serverAddr, email: "account.email", passwordToken: "passwordToken.token" };
  await Email.sendMail("account.email", "register-other", locals);
  Log(req, "Info: Admin registered successfuly", account.email);
  return res.json({
    success: true,
    msg: __("Admin registered successfuly")
  });
});

// list admin's own roles
router.get("/roles", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.user.email;
  roles = await Admin.getRoles(email);
  Log(req, "Info: Roles returned", req.user.email);
  res.json({ success: true, roles: roles });
});
// list admin's own roles
router.get("/all-roles", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  roles = await Admin.getAllRoles();
  Log(req, "Info: All Roles returned", req.user.email);
  res.json({ success: true, roles: roles });
});

// Verify KYC
router.post("/verifykyc", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const verifyFirstName = req.body.verifyFirstName;
  const verifyLastName = req.body.verifyLastName;
  const verifyBirthDate = req.body.verifyBirthDate;
  const verifyAddress = req.body.verifyAddress;
  const verifyPassportImage = req.body.verifyPassportImage;
  const verifyTelephone = req.body.verifyTelephone;
  const email = req.body.email;
  var verifyWallet = false;
  user = await User.getUserByEmail(email);
  if (user.hasWallet) {
    verifyWallet = req.body.verifyWallet;
  } else {
    verifyWallet = true;
  }
  if (verifyFirstName && verifyLastName && verifyBirthDate && verifyWallet && verifyAddress && verifyPassportImage && verifyTelephone) {
    await Email.sendMail(user.email, "KYCVerified", req.body);

    user.KYCUpdated = false;
    user.KYCVerified = true;
    user.enabled = true;

    await user.save();
    Log(req, "Info: User(" + user.email + ") KYC verified", req.user.email);
    return res.json({ success: true, msg: "User KYC verified" });
  } else {
    await Email.sendMail(user.email, "KYCNotVerified", req.body);

    user.KYCVerified = false;
    user.KYCUpdated = false;
    await user.save();
    Log(req, "Info: User(" + user.email + ") KYC not verified", req.user.email);
    return res.json({ success: true, msg: "User KYC not verified" });
  }
});

// Disable User
router.post("/disable", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.body.email;
  user = await User.getUserByEmail(email);
  user.enabled = false;
  await user.save();
  Log(req, "Info: User(" + email + ") disabled successfuly", req.user.email);
  return res.json({ success: true, msg: "User disabled successfuly" });
});

// Enable User
router.post("/enable", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.body.email;
  user = await User.getUserByEmail(email);
  user.enabled = true;
  await user.save();
  Log(req, "Info: User(" + email + ") enabled successfuly", req.user.email);
  return res.json({ success: true, msg: "User enabled successfuly" });
});

// user, verifyKYC, changeRoles, answerTicket, userManager, RPCManager
// Change Roles
router.post("/changeroles", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.body.email;
  if (req.body.email == req.user.email) {
    throw new Error("You can not change own role");
  } else {
    user = await User.getUserByEmail(email);
    hasAdminRole = await User.hasRole(user.roles, [""]);
    if (hasAdminRole) {
      throw new Error("You can not change admin roles");
    } else {
      const newRoles = [];
      if (req.body.user) {
        newRoles.push({ roleTitle: "user" });
      }
      if (req.body.verifyKYC) {
        newRoles.push({ roleTitle: "verifyKYC" });
      }
      if (req.body.changeRoles) {
        newRoles.push({ roleTitle: "changeRoles" });
      }
      if (req.body.changeRoles) {
        newRoles.push({ roleTitle: "answerTicket" });
      }
      if (req.body.changeRoles) {
        newRoles.push({ roleTitle: "userManager" });
      }
      if (req.body.changeRoles) {
        newRoles.push({ roleTitle: "RPCManager" });
      }
      if (req.body.exchanger) {
        newRoles.push({ roleTitle: "exchanger" });
      }
      user.roles = newRoles;
      var roleStr = "";
      newRoles.forEach(function(role, index, array) {
        roleStr = roleStr + role.roleTitle + ",";
      });
      roleStr = roleStr.slice(0, -1);
      await user.save();
      Log(req, "Info: Roles(" + roleStr + ") of User(" + email + ") changed successfuly", req.user.email);
      return res.json({ success: true, msg: "Roles change successfuly" });
    }
  }
});

// Get Users List for Change roles
router.get("/listroles", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  users = await User.getUsersListRoles();
  Log(req, "Info: Get users list successfuly", req.user.email);
  return res.json({ success: true, users: users });
});

// Get Users List for KYC
router.get("/listkyc", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  users = await User.getUsersListKYC();
  Log(req, "Info: Get users list successfuly", req.user.email);
  return res.json({ success: true, users: users });
});

// Get KYC informations of a user
router.post("/get-kyc", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const email = req.body.email;

  user = await User.getUserKYC(email);
  Log(req, "Info: Get user KYC info successfuly", req.user.email);
  return res.json({ success: true, user: user });
});

// list all Receipt submited
router.get("/list-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  receipts = await Receipt.getAllReceipts();
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Receipt approved by admin
router.get("/list-approved-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  receipts = await Receipt.getAllReceipts("Approved");
  Log(req, "Info: Approved Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Receipt rejected by admin
router.get("/list-rejected-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  receipts = await Receipt.getAllReceipts("Rejected");
  Log(req, "Info: Rejected Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Receipt submited by user and exchange and ready for admin response
router.get("/list-pending-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  var hasUser = true;
  receipts = await Receipt.getAllReceipts("Pending", hasUser);
  Log(req, "Info: Pending Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// approve receipt by admin
router.post("/approve-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const receiptNumber = Number(req.body.receiptNumber);
  const comment = req.body.comment;

  receipt = await Receipt.getReceiptByNumber(receiptNumber);
  if (receipt.status != "Pending") {
    throw new Error("Admin can approve pending receipts only");
  }
  receipt.admin = req.user._id;
  receipt.adminEmail = req.user.email;
  receipt.adminComment = comment;
  receipt.adminSubmitDate = new Date();
  receipt.status = "Approved";
  price = await Price.getLastPrice(receipt.userSubmitDate);
  user = await User.getUserByIdAsync(receipt.user);
  user.balance += receipt.amount / price.price;
  await receipt.save();

  await user.save();

  Log(req, "Info: Receipt Number (" + receipt.receiptNumber + ") Approved by admin", req.user.email);
  res.json({ success: true, msg: __("Receipt Number %i approved successfuly", receipt.receiptNumber) });
});

// reject receipt by admin
router.post("/reject-receipt", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const receiptNumber = Number(req.body.receiptNumber);
  const comment = req.body.comment;

  receipt = await Receipt.getReceiptByNumber(receiptNumber);
  if (receipt.status != "Pending") {
    throw new Error("Admin can reject pending receipts only");
  }
  receipt.admin = req.user._id;
  receipt.adminEmail = req.user.email;
  receipt.adminComment = comment;
  receipt.adminSubmitDate = new Date();
  receipt.status = "Rejected";
  receipt = await receipt.save();
  Log(req, "Info: Receipt Number (" + receipt.receiptNumber + ") rejected by admin", req.user.email);
  res.json({ success: true, msg: __("Receipt Number %i rejected successfuly", receipt.receiptNumber) });
});

// list all BurnRequest submited
router.get("/list-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  burnRequests = await BurnRequest.getAllBurnRequests();
  Log(req, "Info: BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

// list all BurnRequest approved by admin
router.get("/list-approved-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  burnRequests = await BurnRequest.getAllBurnRequests("Approved");
  Log(req, "Info: Approved BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

// list all BurnRequest rejected by admin
router.get("/list-rejected-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  burnRequests = await BurnRequest.getAllBurnRequests("Rejected");
  Log(req, "Info: Rejected BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

// list all BurnRequest submited by user and ready for admin response
router.get("/list-pending-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  burnRequests = await BurnRequest.getAllBurnRequests("Pending");
  Log(req, "Info: Pending BurnRequests list returned", req.user.email);
  res.json({ success: true, burnRequests: burnRequests });
});

// approve burn by admin
router.post("/approve-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const burnRequestNumber = Number(req.body.burnRequestNumber);

  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  if (burnRequest.status != "Pending") {
    throw new Error("Admin can approve pending burnRequests only");
  }
  burnRequest.admin = req.user._id;
  burnRequest.adminEmail = req.user.email;
  burnRequest.adminComment = req.body.comment;
  burnRequest.adminSubmitDate = new Date();
  burnRequest.status = "Approved";
  user = await User.getUserByIdAsync(burnRequest.user);
  if (burnRequest.amount > burnRequest.balance) {
    throw new Error("Requested amount greater than user's balance");
  }
  user.balance = user.balance - burnRequest.amount;
  await user.save();

  await burnRequest.save();

  Log(req, "Info: BurnRequest Number (" + burnRequest.burnRequestNumber + ") Approved by admin", req.user.email);
  res.json({ success: true, msg: __("BurnRequest Number %i approved", burnRequest.burnRequestNumber) });
});

// reject burn by admin
router.post("/reject-burn", [passport.authenticate("jwt", { session: false }), i18n, autorize], async (req, res, next) => {
  const burnRequestNumber = Number(req.body.burnRequestNumber);

  burnRequest = await BurnRequest.getBurnRequestByNumber(burnRequestNumber);
  if (burnRequest.status != "Pending") {
    throw new Error("Admin can reject pending burnRequests only");
  }
  burnRequest.admin = req.user._id;
  burnRequest.adminEmail = req.user.email;
  burnRequest.adminComment = req.body.comment;
  burnRequest.adminSubmitDate = new Date();
  burnRequest.status = "Rejected";

  await burnRequest.save();
  Log(req, "Info: BurnRequest Number (" + burnRequest.burnRequestNumber + ") Rejected by admin", req.user.email);
  res.json({ success: true, msg: __("BurnRequest Number %i rejected", burnRequest.burnRequestNumber) });
});
module.exports = router;
