const mongoose = require("mongoose");
var Schema = mongoose.Schema;
const User = require("./user");

// Price Schema
const ReceiptSchema = mongoose.Schema({
  amount: { type: Number, required: true },
  verificationCode: { type: String, required: true },
  codeExpiration: { type: Date, required: true },
  exchanger: { type: Schema.Types.ObjectId, ref: "User", required: true },
  exchangerEmail: { type: String, required: true },
  exchangerComment: { type: String },
  exchangerReceipt: { type: String },
  exchangerSubmitDate: { type: Date },
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
    enum: ["Pending", "Approved", "Rejected", "Expired"],
    default: "Pending"
  }
});

ReceiptSchema.plugin(autoIncrement.plugin, {
  model: "Receipt",
  field: "receiptNumber",
  startAt: 10000
});

const Receipt = (module.exports = mongoose.model("Receipt", ReceiptSchema));

module.exports.getReceiptByNumber = async function(receiptNumber) {
  const query = { receiptNumber: receiptNumber };

  receipt = await Receipt.findOne(query);
  if (!receipt) {
    throw new Error("Receipt not found");
  }
  return receipt;
};

module.exports.getReceiptByVerificationCode = async function(verificationCode) {
  const query = { verificationCode: verificationCode };

  receipt = await Receipt.findOne(query);
  if (!receipt) {
    throw new Error("Receipt not found");
  }
  return receipt;
};

module.exports.getExchangerReceipts = async function(exchangerEmail, reqStatus) {
  var query = { exchangerEmail: exchangerEmail };

  if (reqStatus) {
    query["status"] = reqStatus;
  }

  return await Receipt.find(query);
};

module.exports.getUserReceipts = async function(userEmail, reqStatus) {
  const query = { userEmail: userEmail };
  if (reqStatus) {
    query["status"] = reqStatus;
  }

  return await Receipt.find(query);
};

module.exports.getAllReceipts = async function(reqStatus, hasUser) {
  var query = {};

  if (reqStatus) {
    query["status"] = reqStatus;
  }
  if (hasUser) {
    query["userSubmitDate"] = { $ne: null };
  }

  return await Receipt.find(query);
};
