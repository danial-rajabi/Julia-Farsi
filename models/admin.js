const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
autoIncrement = require("mongoose-auto-increment");
const configAdmin = require("../config/admin");
const Account = require("./account");
const randToken = require("rand-token");

const AllRoles = [
  { roleTitle: "verifyKYC" },
  { roleTitle: "changeRoles" },
  { roleTitle: "answerTickets" },
  { roleTitle: "userManager" },
  { roleTitle: "RPCManager" }
];

// Admin Schema
const AdminSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  firstName: { type: String },
  lastName: { type: String },
  imageAddress: { type: String },
  superAdmin: { type: Boolean, default: false },
  roles: [{ roleTitle: String }]
});

const Admin = (module.exports = mongoose.model("Admin", AdminSchema));

module.exports.getAdminById = async function(id) {
  admin = await Admin.findById(id);
  if (!admin) {
    throw new Error("User not found");
  }
  return admin;
};

module.exports.getAdminByEmail = async function(email) {
  const query = { email: email };
  admin = await Admin.findOne(query);

  if (!admin) {
    throw new Error("Email not registered");
  }
  return admin;
};

module.exports.addAdmin = async function(newAdmin, enabled) {
  var newAccount = new Account({
    email: newAdmin.email,
    emailVerified: true,
    enabled: enabled,
    registeredDate: new Date(),
    accountType: "Admin"
  });
  salt = await bcrypt.genSalt(10);
  var initPass = randToken.generate(16);
  hash = await bcrypt.hash(initPass, salt);
  newAccount.password = hash;
  try {
    await newAdmin.save();
    return await newAccount.save();
  } catch (ex) {
    if (ex.code == 11000) {
      throw new Error("Email registered before");
    } else {
      throw ex;
    }
  }
};

module.exports.addAdministrator = async function() {
  var adminAccount = new Account({
    email: configAdmin.email,
    password: configAdmin.pass
  });
  var query = { email: adminAccount.email };
  admin = await Account.findOne(query);
  if (!admin) {
    salt = await bcrypt.genSalt(10);
    hash = await bcrypt.hash(adminAccount.password, salt);
    adminAccount.password = hash;
    adminAccount.emailVerified = true;
    adminAccount.accountType = "Admin";
    await adminAccount.save();
  }
  query = { email: adminAccount.email };
  administrator = await Admin.findOne(query);
  if (!administrator) {
    var administrator = new Admin({
      email: configAdmin.email,
      firstName: configAdmin.firstName,
      lastName: configAdmin.lastName
    });
  }
  administrator.roles = AllRoles;
  return await administrator.save();
};

module.exports.hasRole = async function(admin, requestedRole) {
  var isFound = false;
  if (admin.superAdmin) {
    return true;
  } else {
    roles = admin.roles;
    roles.forEach(function(role, index, array) {
      if (requestedRole.includes(role.roleTitle)) {
        isFound = true;
      }
    });
    return await isFound;
  }
};

module.exports.getAdminsList = async function() {
  const query = {};
  return await Admin.find(query);
};
