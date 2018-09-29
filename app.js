const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require("passport");
const mongoose = require("mongoose"),
  Schema = mongoose.Schema,
  autoIncrement = require("mongoose-auto-increment");
require("express-async-errors");
const config = require("./config/setting");
const configAdmin = require("./config/admin");
const errors = require("./middlewares/errors");
i18n = require("i18n");

mongoose.connect(
  config.database,
  { useNewUrlParser: true }
);
mongoose.set("useCreateIndex", true);
autoIncrement.initialize(mongoose.connection);

mongoose.connection.on("connected", () => {
  console.log("Connetcted to DataBase");
});

// Database connection Error
mongoose.connection.on("error", console.error.bind(console, "connection error:"));

const app = express();
i18n.configure({
  locales: ["en", "fa"],
  defaultLocale: "fa",
  register: global,
  directory: __dirname + "/locales"
});

// console.log(__("Hello %s", "Marcus"));

const users = require("./routes/users");
const admins = require("./routes/admins");
const exchangers = require("./routes/exchangers");
const tickets = require("./routes/tickets");
const rpc = require("./routes/rpc");

const port = 3000;

// CORS Middleware
app.use(cors());

// Set Static Folder
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "uploads")));

// Body Parser Middleware
app.use(bodyParser.json());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

require("./config/passport")(passport);

app.use("/users", users);
app.use("/admins", admins);
app.use("/exchangers", exchangers);
app.use("/tickets", tickets);
app.use("/rpc", rpc);
app.use(errors);

const User = require("./models/user");
let administrator = new User({
  email: configAdmin.email,
  password: configAdmin.pass,
  firstName: configAdmin.firstName,
  lastName: configAdmin.lastName
});

User.addAdministrator(administrator);

const Price = require("./models/price");
var dates = ["2018-09-01", "2018-09-02", "2018-09-04", "2018-09-05", "2018-09-08"];
// Price.addDefaultPrice(dates);

app.listen(port, () => {
  console.log("Server started on " + port);
});
