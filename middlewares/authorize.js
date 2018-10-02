const Admin = require("../models/admin");
const Log = require("../middlewares/log");

module.exports = async function(req, res, next) {
  switch (req.baseUrl) {
    case "/admins":
      type = "Admin";
      break;
    case "/users":
      type = "User";
      break;
    case "/exchangers":
      type = "Exchanger";
      break;
  }
  if (type != "Admin") {
    if (req.user.userType != type) {
      Log(req, "Error: Unauthorized action", req.user.email);
      return res.sendStatus(401);
    } else {
      next();
    }
  }
  const adminEmail = req.user.email;
  admin = await Admin.getAdminByEmail(adminEmail);
  switch (req.url) {
    case "/get-kyc":
    case "/listkyc":
    case "/verifykyc":
      role = ["verifyKYC"];
      break;
    case "/listroles":
    case "/changeroles":
      role = ["changeRoles"];
      break;
    case "/enable":
    case "/disable":
      role = ["userManager"];
      break;
    case "/list-receipt":
    case "/list-approved-receipt":
    case "/list-rejected-receipt":
    case "/list-pending-receipt":
    case "/approve-receipt":
    case "/reject-receipt":
    case "/list-burn":
    case "/list-approved-burn":
    case "/list-rejected-burn":
    case "/list-pending-burn":
    case "/approve-burn":
    case "/reject-burn":
      role = ["financeManager"];
      break;
    case "/tickets/answer":
    case "/tickets/listall":
      role = ["answerTicket"];
      break;
    case "/rpc/token-price":
      role = ["RPCManager"];
      break;
    default:
      role = null;
  }
  hasRole = await Admin.hasRole(admin, role);

  if (!hasRole) {
    Log(req, "Error: Unauthorized action", req.user.email);
    return res.sendStatus(401);
  } else {
    next();
  }
};
