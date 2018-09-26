const mongoose = require("mongoose");
var Schema = mongoose.Schema;

// Price Schema
const SaleReceiptSchema = mongoose.Schema({
  amount: { type: Number, required: true },
  exchangerReceipt: { type: String },
  exchangerComment: { type: String },
  exchanger: { type: Schema.Types.ObjectId, ref: "User", required: true },
  exchangerSubmitDate: { type: Date, default: Date.now() },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userComment: { type: String },
  userReceipt: { type: String },
  userSubmitDate: { type: Date },
  admin: { type: Schema.Types.ObjectId, ref: "User" },
  adminComment: { type: String },
  adminSubmitDate: { type: Date },
  status: {
    type: String,
    enum: ["Unknown", "Approved", "Rejected"],
    default: "Unknown"
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

module.exports.getExchangerReceipt = async function(exchanger) {
  const query = { exchanger: exchanger };
  //   console.log(query);

  return await SaleReceipt.find(query);
};

module.exports.getUserReceipt = async function(userId) {
  const query = { user: userId };
  //   console.log(query);

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
