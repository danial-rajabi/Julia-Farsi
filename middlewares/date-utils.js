module.exports.addminutes = async function(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
};
