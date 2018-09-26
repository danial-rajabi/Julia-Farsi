const Log = require("./log");

module.exports = function(err, req, res, next) {
  email = "NOUSER";
  if (req.user) {
    email = req.user.email;
  } else if (req.body.email) {
    email = req.body.email;
  }

  Log("URL: " + req.originalUrl + ", Error: " + err.message, email);
  res.json({ success: false, msg: err.message });
};
