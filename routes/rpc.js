const express = require("express");
const router = express.Router();
const passport = require("passport");

const Log = require("../middlewares/log");
const Pause = require("../models/pause");
const Price = require("../models/price");
const User = require("../models/user");
const autorize = require("../middlewares/authorize");

router.get("/ispaused", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  const isPaused = req.body.isPaused;
  let newPause = new Pause({
    isPause: isPaused,
    date: Date.now()
  });
  await newPause.save();

  if (isPaused) {
    Log("Method: IsPaused, Info: Application Paused", "");
    return res.json({ success: true, msg: "Application Paused" });
  } else {
    Log("Method: IsPaused, Info: Application Unpaused", "");
    return res.json({ success: true, msg: "Application Unpaused" });
  }
});

router.post("/token-ether-price", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  price = req.body.price;
  let newPrice = new Price({
    price: price,
    type: "Ether",
    date: Date.now()
  });
  await newPrice.save();
  Log("Method: SetPrice, Info: New Ether-Price Added", "");
  return res.json({ success: true, msg: "New Ether-Price Saved" });
});

router.post("/token-euro-price", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  price = req.body.price;
  let newPrice = new Price({
    price: price,
    type: "Euro",
    date: Date.now()
  });
  await newPrice.save();
  Log("Method: SetPrice, Info: New Euro-Price Added", "");
  return res.json({ success: true, msg: "New Euro-Price Saved" });
});

router.post("/get-price", async (req, res, next) => {
  from = req.body.from;
  to = req.body.to;
  type = req.body.type;

  prices = await Price.getPrice(from, to, type);
  Log("Method: GetPrice, Info: Get price list", "");
  return res.json({ success: true, prices: prices });
});

router.post("/get-last-price", async (req, res, next) => {
  type = req.body.type;

  price = await Price.getLastPrice(type);
  Log("Method: GetLastPrice, Info: Get last price in " + type + "(" + price.price + ")", "");
  return res.json({ success: true, price: price });
});

router.get("/get-last-price-ether", async (req, res, next) => {
  type = "Ether";

  price = await Price.getLastPrice(type);
  Log("Method: GetLastPriceEther, Info: Get last price in Ether(" + price.price + ")", "");
  return res.json({ success: true, price: price });
});

router.get("/get-last-price-euro", async (req, res, next) => {
  type = "Euro";

  price = await Price.getLastPrice(type);
  Log("Method: GetLastPriceEther, Info: Get last price in Euro(" + price.price + ")", "");
  return res.json({ success: true, price: price });
});

module.exports = router;
