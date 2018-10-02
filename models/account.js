const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const randToken = require("rand-token");
autoIncrement = require("mongoose-auto-increment");

// Account Schema
const AccountSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  password: { type: String, required: true },
  enabled: { type: Boolean, default: "true" },
  registeredDate: { type: Date, default: Date.now() },
  accountType: { type: String, enum: ["User", "Admin", "Exchanger"], default: "User" },
  locale: { type: String, enum: ["fa", "en"], default: "fa" }
});

const Account = (module.exports = mongoose.model("Account", AccountSchema));

module.exports.getAccountById = function(id, callback) {
  Account.findById(id, callback);
};

module.exports.getAccountByIdAsync = async function(id) {
  account = await Account.findById(id);
  if (!account) {
    throw new Error("Account not found");
  }
  return account;
};

module.exports.getAccountByStrId = async function(strId) {
  var id = mongoose.Types.ObjectId;
  if (id.isValid(strId)) {
    id = mongoose.Types.ObjectId(strId);
    account = await Account.findById(id);
    if (account) {
      return account;
    }
  }
  throw new Error("Account not found");
};

module.exports.getAccountByEmail = async function(email) {
  const query = { email: email };
  account = await Account.findOne(query, { __v: 0 });

  if (!account) {
    throw new Error("Email not registered");
  }
  return account;
};

// // Get user by userNumber
// module.exports.getUserByNumber = async function(userNumber) {
//   const query = { UserNumber: userNumber };

//   user = await User.findOne(query);
//   if (!user) {
//     throw new Error("User not found");
//   }
//   return user;
// };

module.exports.addAccount = async function(newAccount, type) {
  salt = await bcrypt.genSalt(10);
  hash = await bcrypt.hash(newAccount.password, salt);
  newAccount.password = hash;
  var token = randToken.generate(16);
  newAccount.emailVerificationToken = token;
  newAccount.accountType = type;
  try {
    return await newAccount.save();
  } catch (ex) {
    if (ex.code == 11000) {
      throw new Error("Email registered before");
    } else {
      throw ex;
    }
  }
};

module.exports.comparePassword = async function(candidatePassword, hash) {
  return await bcrypt.compare(candidatePassword, hash);
};

module.exports.changePassword = async function(account, newPassword) {
  salt = await bcrypt.genSalt(10);
  hash = await bcrypt.hash(newPassword, salt);
  account.password = hash;
  return await account.save();
};

// module.exports.getUsersList = async function() {
//   const query = {};
//   return await User.find(query);
// };
