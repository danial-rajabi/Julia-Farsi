const rp = require("request-promise");
const config = require("../config/setting");

module.exports.addToWhiteList = async function(userWallet, referWallet) {
  var options = {
    method: "POST",
    uri: config.RPCServer + "/api/rpc/add-to-whitelist",
    body: { user: userWallet, referal: referWallet },
    //     headers: { Authorization: "sssaa" },
    json: true
  };
  console.log(options);

  res = await rp(options);
  return res;
};

module.exports.removeFromWhiteList = async function(userWallet) {
  var options = {
    method: "POST",
    uri: config.RPCServer + "/api/rpc/remove-from-whitelist",
    body: { user: userWallet },
    //     headers: { Authorization: "sssaa" },
    json: true
  };
  console.log(options);

  res = await rp(options);
  return res;
};
