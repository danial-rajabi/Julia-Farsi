const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const randToken = require("rand-token");
const Account = require("../models/account");

autoIncrement = require("mongoose-auto-increment");

// Exchanger Schema
const ExchangerSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  firstName: { type: String },
  lastName: { type: String },
  address: { type: String },
  telephone: { type: String },
  imageAddress: { type: String }
});

const Exchanger = (module.exports = mongoose.model("Exchanger", ExchangerSchema));

module.exports.getExchangerById = async function(id) {
  exchanger = await Exchanger.findById(id);
  if (!exchanger) {
    throw new Error("Exchanger not found");
  }
  return exchanger;
};

module.exports.getExchangerByEmail = async function(email) {
  const query = { email: email };
  console.log(query);

  exchanger = await Exchanger.findOne(query);

  if (!exchanger) {
    throw new Error("Email not registered");
  }
  return exchanger;
};

module.exports.addExchanger = async function(newExchanger, enabled) {
  var newAccount = new Account({
    email: newExchanger.email,
    emailVerified: true,
    enabled: enabled,
    registeredDate: new Date(),
    accountType: "Exchanger"
  });
  salt = await bcrypt.genSalt(10);
  var initPass = randToken.generate(16);
  hash = await bcrypt.hash(initPass, salt);
  newAccount.password = hash;
  try {
    await newExchanger.save();
    return await newAccount.save();
  } catch (ex) {
    if (ex.code == 11000) {
      throw new Error("Email registered before");
    } else {
      throw ex;
    }
  }
};

module.exports.getExchangersList = async function() {
  const query = {};
  return await Exchanger.find(query);
  // Exchanger.aggregate([
  //   { $lookup:
  //      {
  //        from: 'accounts',
  //        localField: 'email',
  //        foreignField: 'email',
  //        as: 'orderdetails'
  //      }
  //    }
  //   ])
};

module.exports.getEnabledExchangersList = async function() {
  const query = {};
  exchangers = await Exchanger.find(query);
  var exList = [];

  for (exchanger of exchangers) {
    account = await Account.getAccountByEmail(exchanger.email);
    if (account.enabled) {
      exList.push(exchanger);
    }
  }
  return exList;
};
