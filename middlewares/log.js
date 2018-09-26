const fs = require("fs");
const dateformat = require("dateformat");

var stream = fs.createWriteStream("./logs/" + dateformat(new Date(), "yyyy-mm-dd") + ".log", { flags: "a" });

module.exports = function(req, message, actionBy) {
  if (req) {
    stream.write(dateformat(new Date(), "yyyy-mm-dd HH:MM:ss.l - ") + actionBy + " - URL: " + req.originalUrl + ", " + message + "\n");
  } else {
    stream.write(dateformat(new Date(), "yyyy-mm-dd HH:MM:ss.l - ") + actionBy + ", " + message + "\n");
  }
};
