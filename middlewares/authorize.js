const User = require("../models/user");
const Log = require("../middlewares/log");

module.exports = async function(req, res, next) {
  const adminRoles = req.user.roles;
  switch (req.originalUrl) {
    case "/admins/get-kyc":
    case "/admins/listkyc":
    case "/admins/verifykyc":
      role = ["verifyKYC"];
      break;
    case "/admins/listroles":
    case "/admins/changeroles":
      role = ["changeRoles"];
      break;
    case "/admins/enable":
    case "/admins/disable":
      role = ["userManager"];
      break;
    case "/admins/list-receipt":
    case "/admins/list-approved-receipt":
    case "/admins/list-rejected-receipt":
    case "/admins/list-pending-receipt":
    case "/admins/approve-receipt":
    case "/admins/reject-receipt":
    case "/admins/list-burn":
    case "/admins/list-approved-burn":
    case "/admins/list-rejected-burn":
    case "/admins/list-pending-burn":
    case "/admins/approve-burn":
    case "/admins/reject-burn":
      role = ["financeManager"];
      break;
    case "/tickets/answer":
    case "/tickets/listall":
      role = ["answerTicket"];
      break;
    case "/rpc/token-price":
      role = ["RPCManager"];
      break;
    case "/exchangers/receipt":
    case "/exchangers/list-receipt":
    case "/exchangers/get-kyc":
      role = ["exchanger"];
      break;
    default:
      role = [""];
  }
  hasRole = await User.hasRole(adminRoles, role);
  if (!hasRole) {
    Log(req, "Error: Unauthorized action", req.user.email);
    return res.sendStatus(401);
  } else {
    next();
  }
};
