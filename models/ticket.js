const mongoose = require("mongoose");
const config = require("../config/setting");
autoIncrement = require("mongoose-auto-increment");
const Email = require("../middlewares/email");
const Log = require("../middlewares/log");

// Ticket Schema
const TicketSchema = mongoose.Schema({
  userEmail: { type: String, required: true },
  subject: { type: String, required: true },
  priroty: { type: Number, min: 1, max: 5 },
  tokenType: { type: String, enum: ["Risky", "Normal"] },
  description: { type: String, required: true },
  attachmentAddress: { type: String },
  attachmentName: { type: String },
  createdate: { type: Date, default: Date.now() },
  lastReplayDate: { type: Date, default: Date.now() },
  recieveEmail: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ["Open", "Answered", "Closed", "Canceled"],
    default: "Open"
  },
  replays: [
    {
      userEmail: { type: String, required: true },
      description: { type: String, required: true },
      replayDate: { type: Date, default: Date.now() }
    }
  ]
});
TicketSchema.plugin(autoIncrement.plugin, {
  model: "Ticket",
  field: "ticketNumber",
  startAt: 100
});

const Ticket = (module.exports = mongoose.model("Ticket", TicketSchema));

//Close Answered Tickets Older than times in seconds
closeOldAnsweredTickets();

module.exports.addTicket = async function(newTicket) {
  return await newTicket.save();
};

// Get ticket by ticketNumber
module.exports.getTicketByNumber = async function(ticketNumber) {
  const query = { ticketNumber: ticketNumber };
  ticket = await Ticket.findOne(query);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  return ticket;
};

// Checks Old Answered Ticket And Close Them
async function closeOldAnsweredTickets() {
  var date = new Date() - config.AutoClodeTickets;
  providedDate = new Date(date);

  const query = { lastReplayDate: { $lt: providedDate }, status: "Answered" };

  tickets = await Ticket.find(query);
  tickets.forEach(async ticket => {
    if (ticket.recieveEmail) {
      var locals = { ticketNumber: ticket.ticketNumber, subject: ticket.subject };
      await Email.sendMail(ticket.userEmail, "ticketAutoClose", locals);
    }
    ticket.status = "Closed";
    await icket.save();
    Log(req, "Info: Ticket number(" + ticket.ticketNumber + ") Closed", "SYSTEM");
  });
  //Repeat Function every minute
  setTimeout(closeOldAnsweredTickets, 60000);
}

// Get All Tickets
// if reqUserEmail == null then return all userEmail else retuen user's ticket
// if reqStatus == null return all status
module.exports.getAllTicket = async function(reqUserEmail, reqStatus) {
  var query = {};

  if (reqUserEmail) {
    query["userEmail"] = reqUserEmail;
  }
  if (reqStatus) {
    query["status"] = reqStatus;
  }

  return await Ticket.find(query);
};
