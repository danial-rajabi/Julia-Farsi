const express = require("express");
const router = express.Router();
const passport = require("passport");
const randToken = require("rand-token");
const multer = require("multer");
const path = require("path");

const Log = require("../middlewares/log");
const Ticket = require("../models/ticket");
const User = require("../models/user");
const Email = require("../middlewares/email");
const autorize = require("../middlewares/authorize");

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: function(req, file, cb) {
    raw = randToken.generate(16);
    cb(null, raw.toString("hex") + Date.now() + path.extname(file.originalname));
  }
});
var upload = multer({ storage: storage });

// Create new ticket
router.post("/create", passport.authenticate("jwt", { session: false }), upload.single("attachment"), async (req, res, next) => {
  const userEmail = req.user.email;
  let newTicket = new Ticket({
    userEmail: userEmail,
    subject: req.body.subject,
    description: req.body.description,
    tokenType: req.body.tokenType,
    recieveEmail: req.body.recieveEmail
  });
  if (req.file) {
    newTicket.attachmentAddress = req.file.filename;
    newTicket.attachmentName = req.file.originalname;
  }
  await newTicket.save();
  Log("Method: CreateTicket, Info: Ticket Number " + newTicket.ticketNumber + " Created", req.user.email);
  res.json({ success: true, msg: "Ticket Number " + newTicket.ticketNumber + " Created" });
});

// Cancel own ticket
router.post("/cancel", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userEmail = req.user.email;
  const ticketNumber = req.body.ticketNumber;

  ticket = await Ticket.getTicketByNumber(ticketNumber);
  if (ticket.userEmail != userEmail) {
    throw new Error("User can not cancel others' ticket");
  } else {
    ticket.status = "Canceled";
    await ticket.save();
    Log("Method: CancelTicket, Info: Ticket Number(" + ticketNumber + ") Canceled Successfuly", req.user.email);
    res.json({ success: true, msg: "Ticket Number(" + ticketNumber + ") Canceled Successfuly" });
  }
});

// Resolve own ticket
router.post("/resolve", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userEmail = req.user.email;
  const ticketNumber = req.body.ticketNumber;

  ticket = await Ticket.getTicketByNumber(ticketNumber);
  if (ticket.userEmail != userEmail) {
    throw new Error("User can not resolve others' ticket");
  } else {
    ticket.status = "Closed";
    await ticket.save();
    Log("Method: ResolveTicket, Info: Ticket Number(" + ticketNumber + ") Closed Successfuly", req.user.email);
    res.json({ success: true, msg: "Ticket Number(" + ticketNumber + ") Closed Successfuly" });
  }
});

// Replay own ticket
router.post("/replay", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userEmail = req.user.email;
  const ticketNumber = req.body.ticketNumber;
  const replayDesc = req.body.replayDesc;

  ticket = await Ticket.getTicketByNumber(ticketNumber);
  if (ticket.userEmail != userEmail) {
    throw new Error("User can not replay others' ticket");
  } else {
    let replay = { userEmail: userEmail, description: replayDesc };
    ticket.replays.push(replay);
    ticket.lastReplayDate = new Date();
    ticket.status = "Open";
    ticket.save();
    Log("Method: ReplayTicket, Info: Ticket Number(" + ticketNumber + ") Replayed Successfuly", req.user.email);
    res.json({ success: true, msg: "Ticket Number(" + ticketNumber + ") Replayed Successfuly" });
  }
});

// Answer ticket by admin
router.post("/answer", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const userEmail = req.user.email;
  const ticketNumber = req.body.ticketNumber;
  const answerDesc = req.body.answerDesc;

  ticket = await Ticket.getTicketByNumber(ticketNumber);

  let replay = { userEmail: userEmail, description: answerDesc };
  ticket.replays.push(replay);
  ticket.lastReplayDate = new Date();
  ticket.status = "Answered";
  await ticket.save();
  // if ticket.reciveEmail == true then send email to user and notify about answer ticket
  if (ticket.recieveEmail) {
    var mailContent = "Hi <br>";
    mailContent += "Ticket number(" + ticket.ticketNumber + ") with subject " + ticket.subject;
    mailContent += " answered by admin.<br>";
    mailContent += "Admin's answer is: '" + answerDesc + "'";
    Email.sendMail(ticket.userEmail, "Your ticket answered", mailContent);
  }
  Log("Method: AnswerTicket, Info: Ticket Number(" + ticketNumber + ") Answered Successfuly", req.user.email);
  res.json({ success: true, msg: "Ticket Number(" + ticketNumber + ") Answered Successfuly" });
});

// List All tickets , all Status By Admin
router.get("/listall", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  tickets = await Ticket.getAllTicket("", "");
  Log("Method: ListAllTicketByAdmin, Info: Admin Gets All Tickets", req.user.email);
  return res.json({ success: true, tickets: tickets });
});

// List All Open tickets By Admin
router.get("/listallopen", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  tickets = await Ticket.getAllTicket("", "Open");
  Log("Method: ListAllOpenTicketByAdmin, Info: Admin Gets All Tickets", req.user.email);
  return res.json({ success: true, tickets: tickets });
});

// List All tickets , all Status By User
router.get("/listmy", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userEmail = req.user.email;

  tickets = await Ticket.getAllTicket(userEmail, "");
  Log("Method: ListAllTicketByUser, Info: User Gets All Own Tickets", req.user.email);
  return res.json({ success: true, tickets: tickets });
});

// List Open tickets By User
router.get("/listmyopen", passport.authenticate("jwt", { session: false }), async (req, res, next) => {
  const userEmail = req.user.email;

  tickets = await Ticket.getAllTicket(userEmail, "Open");
  Log("Method: ListAllOpenTicketByUser, Info: User Gets Own Open Tickets", req.user.email);
  return res.json({ success: true, tickets: tickets });
});

module.exports = router;
