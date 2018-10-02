const mongoose = require("mongoose");
const randToken = require("rand-token");
const DateUtils = require("../middlewares/date-utils");

// Forgotten Password Schema
const ForgottenPasswordTokenSchema = mongoose.Schema({
  email: { type: String, required: true },
  token: { type: String, required: true },
  expiration: { type: Date }
});

const ForgottenPasswordToken = (module.exports = mongoose.model("ForgottenPasswordToken", ForgottenPasswordTokenSchema));

module.exports.forgotPassword = async function(forgotPasswordToken) {
  var token = randToken.generate(16);
  forgotPasswordToken.token = token;
  forgotPasswordToken.expiration = await DateUtils.addminutes(new Date(), 120); // 2 Hours
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
