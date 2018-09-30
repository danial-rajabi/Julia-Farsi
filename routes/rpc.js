const express = require("express");
const router = express.Router();
const passport = require("passport");

const Log = require("../middlewares/log");
const Price = require("../models/price");
const autorize = require("../middlewares/authorize");
//TODO i18n
router.post("/token-price", [passport.authenticate("jwt", { session: false }), autorize], async (req, res, next) => {
  price = req.body.price;
  let newPrice = new Price({
    price: price,
    date: Date.now()
  });
  await newPrice.save();
  Log(req, "Info: New Price Saved", "");
  return res.json({ success: true, msg: "New Price Saved" });
});

router.post("/get-price", async (req, res, next) => {
  from = req.body.from;
  to = req.body.to;

  prices = await Price.getPrice(from, to);
  Log(req, "Info: Get price list", "");
  return res.json({ success: true, prices: prices });
});

router.post("/get-last-price", async (req, res, next) => {
  price = await Price.getLastPrice();
  Log(req, "Info: Get last price in " + type + "(" + price.price + ")", "");
  return res.json({ success: true, price: price });
});

module.exports = router;
