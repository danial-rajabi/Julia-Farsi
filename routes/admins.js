const express = require("express");
const router = express.Router();
const passport = require("passport");

const User = require("../models/user");
const SaleReceipt = require("../models/sale-receipt");
const Price = require("../models/price");

const Log = require("../middlewares/log");
const Email = require("../middlewares/email");
const rpcserver = require("../middlewares/rpcserver");
const autorize = require("../middlewares/authorize");

// Verify KYC
router.post("/verifykyc", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
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
    var mailContent = "Hi " + user.firstName + "<br>";
    mailContent += "Your KYC verified successfuly";
    Email.sendMail(user.email, "KYC Verifiation Successful", mailContent);

    user.KYCUpdated = false;
    user.KYCVerified = true;
    user.enabled = true;

    await user.save();
    Log(req, "Info: User(" + user.email + ") KYC verified", req.user.email);
    return res.json({ success: true, msg: "User KYC verified" });
  } else {
    var mailContent = "Hi " + user.firstName + "<br>";
    mailContent += "Your KYC not verified because: <ul>";
    if (!verifyFirstName) {
      mailContent += "<li>First Name Problem</li>";
    }
    if (!verifyLastName) {
      mailContent += "<li>Last Name Problem</li>";
    }
    if (!verifyBirthDate) {
      mailContent += "<li>BirthDate Problem</li>";
    }
    if (!verifyWallet) {
      mailContent += "<li>Wallet Problem</li>";
    }
    if (!verifyAddress) {
      mailContent += "<li>Address Problem</li>";
    }
    if (!verifyPassportImage) {
      mailContent += "<li>PassportImage Problem</li>";
    }
    if (!verifyTelephone) {
      mailContent += "<li>Telephone Problem</li>";
    }
    mailContent += "</ul>";

    Email.sendMail(user.email, "KYC Verifiation Failed", mailContent);

    user.KYCVerified = false;
    user.KYCUpdated = false;
    await user.save();
    Log(req, "Info: User(" + user.email + ") KYC not verified", req.user.email);
    return res.json({ success: true, msg: "User KYC not verified" });
  }
});

// Disable User
router.post("/disable", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const adminRoles = req.user.roles;
  hasRole = await User.hasRole(adminRoles, ["userManager"]);
  if (!hasRole) {
    Log(req, "Error: User has not permission to disable users", req.user.email);
    return res.sendStatus(401);
  } else {
    const email = req.body.email;
    user = await User.getUserByEmail(email);
    user.enabled = false;

    rpcResponse = await rpcserver.removeFromWhiteList(user.walletAddress, null);

    if (rpcResponse.success) {
      Log(req, "Info: Wallet(" + user.walletAddress + ") removed from whitelist, txID: " + body.msg, "SYSTEM");
      await user.save();
      Log(req, "Info: User(" + email + ") disabled successfuly", req.user.email);
      return res.json({ success: true, msg: "User disabled successfuly" });
    } else {
      Log(req, "Error: " + body.msg + "while remove wallet (" + user.walletAddress + ") from whitelist", "SYSTEM");
      return res.json({ success: false, msg: rpcResponse.msg });
    }
  }
});

// Enable User
router.post("/enable", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const email = req.body.email;
  user = await User.getUserByEmail(email);
  user.enabled = true;

  rpcResponse = await rpcserver.addToWhiteList(user.walletAddress, null);

  if (rpcResponse.success) {
    Log(req, "Info: Wallet(" + user.walletAddress + ") added to whitelist, txID: " + rpcResponse.msg, "SYSTEM");
    await user.save();
    Log(req, "Info: User(" + email + ") enabled successfuly", req.user.email);
    return res.json({ success: true, msg: "Contract Signed successfuly" });
  } else {
    throw new Error(rpcResponse.msg);
  }
});

// user, verifyKYC, changeRoles, answerTicket, userManager, RPCManager
// Change Roles
router.post("/changeroles", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const email = req.body.email;
  if (req.body.email == req.user.email) {
    throw new Error("User can not change own role");
  } else {
    user = await User.getUserByEmail(email);
    hasAdminRole = await User.hasRole(user.roles, [""]);
    if (hasAdminRole) {
      throw new Error("Can not change admin roles");
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
      return res.json({ success: true, msg: "Roles change Successfuly" });
    }
  }
});

// Get Users List for Change roles
router.get("/listroles", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  users = await User.getUsersListRoles();
  Log(req, "Info: Get users list successfuly", req.user.email);
  return res.json({ success: true, users: users });
});

// Get Users List for KYC
router.get("/listkyc", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  users = await User.getUsersListKYC();
  Log(req, "Info: Get users list successfuly", req.user.email);
  return res.json({ success: true, users: users });
});

// Get KYC informations of a user
router.post("/get-kyc", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const email = req.body.email;

  user = await User.getUserKYC(email);
  Log(req, "Info: Get user KYC info successfuly", req.user.email);
  return res.json({ success: true, user: user });
});

// list all Receipt submited
router.get("/list-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  receipts = await SaleReceipt.getAllReceipts();
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Receipt approved by admin
router.get("/list-approved-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  receipts = await SaleReceipt.getAllReceipts("Approved");
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Receipt rejected by admin
router.get("/list-rejected-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  receipts = await SaleReceipt.getAllReceipts("Rejected");
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// list all Receipt submited by user and exchange and ready for admin response
router.get("/list-pending-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  var hasUser = true;
  receipts = await SaleReceipt.getAllReceipts("Pending", hasUser);
  Log(req, "Info: Receipts list returned", req.user.email);
  res.json({ success: true, receipts: receipts });
});

// approve receipt by admin
router.post("/approve-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const receiptNumber = Number(req.body.receiptNumber);
  const comment = req.body.comment;

  receipt = await SaleReceipt.getReceiptByNumber(receiptNumber);
  //   if (receipt.status != "Pending") {
  //     throw new Error("Admin can approve pending receipts only");
  //   }
  receipt.admin = req.user._id;
  receipt.adminEmail = req.user.email;
  receipt.adminComment = comment;
  receipt.adminSubmitDate = new Date();
  receipt.status = "Approved";
  await receipt.save();
  price = await Price.getLastPrice(receipt.userSubmitDate);
  user = await User.getUserByIdAsync(receipt.user);
  user.balance += receipt.amount / price.price;

  await user.save();

  Log(req, "Info: Receipt Number (" + receipt.receiptNumber + ") Approved by admin", req.user.email);
  res.json({ success: true, msg: "Receipt Number (" + receipt.receiptNumber + ") Approved by admin" });
});

// reject receipt by admin
router.post("/reject-receipt", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const receiptNumber = Number(req.body.receiptNumber);
  const comment = req.body.comment;

  receipt = await SaleReceipt.getReceiptByNumber(receiptNumber);
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
  res.json({ success: true, msg: "Receipt Number (" + receipt.receiptNumber + ") rejected by admin" });
});

module.exports = router;
