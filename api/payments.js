const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const Razorpay = require("razorpay");
const Stripe = require("stripe");

dotenv.config();

const app = express();
app.use(cors());

// Stripe webhook needs raw body parsing for signature verification
app.post("/webhook/stripe", express.raw({ type: "application/json" }), (req, res) => {
  try {
    // Your webhook logic here
    const sig = req.headers["stripe-signature"];
    const stripe = Stripe(process.env.STRIPE_SECRET);
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    console.log("Stripe event received:", event.type);
    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Parse JSON for all other routes
app.use(bodyParser.json());

// Razorpay route
app.post("/razorpay", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: req.body.amount * 100, // amount in smallest currency unit
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating Razorpay order");
  }
});

// Stripe payment route
app.post("/stripe", async (req, res) => {
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount * 100, // in cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating Stripe payment");
  }
});

module.exports = app;
