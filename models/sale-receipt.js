const mongoose = require("mongoose");
var Schema = mongoose.Schema;
const User = require("../models/user");

// Price Schema
const SaleReceiptSchema = mongoose.Schema({
  amount: { type: Number, required: true },
  exchanger: { type: Schema.Types.ObjectId, ref: "User", required: true },
  exchangerEmail: { type: String, required: true },
  exchangerComment: { type: String },
  exchangerReceipt: { type: String },
  exchangerSubmitDate: { type: Date, default: Date.now() },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userEmail: { type: String, required: true },
  userComment: { type: String },
  userReceipt: { type: String },
  userSubmitDate: { type: Date },
  admin: { type: Schema.Types.ObjectId, ref: "User" },
  adminEmail: { type: String },
  adminComment: { type: String },
  adminSubmitDate: { type: Date },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  }
});

SaleReceiptSchema.plugin(autoIncrement.plugin, {
  model: "SaleReceipt",
  field: "receiptNumber",
  startAt: 10000
});

const SaleReceipt = (module.exports = mongoose.model("SaleReceipt", SaleReceiptSchema));

module.exports.getReceiptByNumber = async function(receiptNumber) {
  const query = { receiptNumber: receiptNumber };

  receipt = await SaleReceipt.findOne(query);
  if (!receipt) {
    throw new Error("Receipt not found");
  }
  return receipt;
};

module.exports.getExchangerReceipts = async function(exchanger) {
  const query = { exchanger: exchanger };

  return await SaleReceipt.find(query);
};

module.exports.getUserReceipts = async function(userId, reqStatus) {
  const query = { user: userId };
  if (reqStatus) {
    query["status"] = reqStatus;
  }

  return await SaleReceipt.find(query);
};

module.exports.getAllReceipts = async function(reqStatus, hasUser) {
  var query = {};

  if (reqStatus) {
    query["status"] = reqStatus;
  }
  if (hasUser) {
    query["userSubmitDate"] = { $ne: null };
  }

  return await SaleReceipt.find(query);
};
