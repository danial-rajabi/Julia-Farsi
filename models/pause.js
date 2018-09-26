const mongoose = require("mongoose");

// Ticket Schema
const PauseSchema = mongoose.Schema({
  isPause: { type: Boolean, required: true },
  date: { type: Date, default: Date.now() }
});

PauseSchema.statics.findMax = function(callback) {
  this.findOne({}) // 'this' now refers to the Member class
    .sort("-date")
    .exec(callback);
};

const Pause = (module.exports = mongoose.model("Pause", PauseSchema));
