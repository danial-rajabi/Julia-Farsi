const mongoose = require("mongoose");
var Schema = mongoose.Schema;

// BurnRequest Schema
const BurnRequestSchema = mongoose.Schema({
  amount: { type: Number, required: true },
  tokenPrice: { type: Number, required: true },
  verificationToken: { type: String, required: true },
  verificationTokenExpire: { type: Date, required: true },
  verified: { type: Boolean, required: true, default: false },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userEmail: { type: String, required: true },
  userComment: { type: String },
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

BurnRequestSchema.plugin(autoIncrement.plugin, {
  model: "BurnRequest",
  field: "BurnRequestNumber",
  startAt: 10000
});

const BurnRequest = (module.exports = mongoose.model("BurnRequest", BurnRequestSchema));

module.exports.getBurnRequestByNumber = async function(BurnRequestNumber) {
  const query = { BurnRequestNumber: BurnRequestNumber };

  burnRequest = await BurnRequest.findOne(query);
  if (!burnRequest) {
    throw new Error("BurnRequest not found");
  }
  return burnRequest;
};

module.exports.getUserBurnRequests = async function(userId, reqStatus) {
  const query = { user: userId };
  if (reqStatus) {
    query["status"] = reqStatus;
  }

  return await BurnRequest.find(query);
};

module.exports.getAllBurnRequests = async function(reqStatus) {
  var query = {};

  if (reqStatus) {
    query["status"] = reqStatus;
  }

  return await BurnRequest.find(query);
};
