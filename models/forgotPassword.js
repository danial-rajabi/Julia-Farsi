const mongoose = require("mongoose");
const config = require("../config/setting");
const randToken = require("rand-token");

// Forgotten Password Schema
const ForgottenPasswordTokenSchema = mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  token: {
    type: String,
    required: true
  },
  expiration: {
    type: Date,
    // 15 Minutes Later
    default: Date.now() + 15 * 60 * 1000
  }
});

const ForgottenPasswordToken = (module.exports = mongoose.model("ForgottenPasswordToken", ForgottenPasswordTokenSchema));

module.exports.forgotPassword = async function(forgotPasswordToken) {
  var token = randToken.generate(16);
  forgotPasswordToken.token = token;
  return await forgotPasswordToken.save();
};

module.exports.getTokenByToken = async function(givenToken) {
  const query = { token: givenToken.token };
  return await ForgottenPasswordToken.findOne(query);
};

module.exports.getTokenByToken = async function(givenToken) {
  // delete expired token
  await ForgottenPasswordToken.deleteMany({ expiration: { $lt: Date.now() } });

  const query = { token: givenToken };
  return await ForgottenPasswordToken.findOne(query);
};
