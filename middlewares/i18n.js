module.exports = async function(req, res, next) {
  if (req.user) {
    this.locale = req.user.locale;
  }
  next();
};
