module.exports.addminutes = async function(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
};

module.exports.addDays = async function(date, days) {
  return new Date(date.getTime() + days * 60000 * 60 * 24);
};
