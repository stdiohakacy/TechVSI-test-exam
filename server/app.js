require("dotenv").config({ path: "./.env" });
const feathers = require("@feathersjs/feathers");
const express = require("@feathersjs/express");
const socketio = require("@feathersjs/socketio");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
const { resolve } = require("path");

// Ensure environment variables are set.
checkEnv();

// Creates an ExpressJS compatible Feathers application
const app = express(feathers());

app.use(cors());
// Parse HTTP JSON bodies
app.use(express.json());
// Parse URL-encoded params
app.use(express.urlencoded({ extended: true }));
// Host static files from the current folder
app.use(express.static(__dirname));
// Add REST API support
app.configure(express.rest());
// Configure Socket.io real-time APIs
app.configure(socketio());
// Register an in-memory messages service
// app.use("/messages", new MessageService());
// Register a nicer error handler than the default Express one
app.use(express.errorHandler());
//
app.use(express.static(process.env.STATIC_DIR));

app.get("/", (req, res) => {
  const path = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(path);
});

app.post("/products", async (req, res) => {
  const { name } = req.body;
  try {
    const product = await stripe.products.create({ name });
    return res.json(product);
  } catch (error) {
    console.error(error);
  }
});

app.post("/prices", async (req, res) => {
  // {
  //   "unit_amount": 2000,
  //   "currency": "usd",
  //   "product": "prod_JCEvztOLohgxSr"
  // }
  const { unit_amount, currency, recurring, product } = req.body;
  try {
    const price = await await stripe.prices.create({
      unit_amount,
      currency,
      recurring,
      product,
    });
    return res.json(price);
  } catch (error) {
    console.error(error);
  }
});

app.get("/config", async (req, res) => {
  try {
    const price = await stripe.prices.retrieve(process.env.PRICE);
    res.send({
      publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
      unitAmount: price.unit_amount,
      currency: price.currency,
    });
  } catch (error) {
    console.error(error);
  }
});

app.post("/create-checkout-session", async (req, res) => {
  const domainURL = process.env.DOMAIN;
  const { quantity, locale } = req.body;

  const pmTypes = (process.env.PAYMENT_METHOD_TYPES || "card")
    .split(",")
    .map((m) => m.trim());

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: pmTypes,
      mode: "payment",
      locale: locale,
      line_items: [
        {
          price: process.env.PRICE,
          quantity: quantity,
        },
      ],
      // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
      success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domainURL}/canceled.html`,
    });

    res.send({
      sessionId: session.id,
    });
  } catch (error) {
    console.error(error);
  }
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get("/checkout-session", async (req, res) => {
  const { sessionId } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.send(session);
  } catch (error) {
    console.error(error);
  }
});

function checkEnv() {
  const price = process.env.PRICE;
  if (!price || price !== 'price_1IZqWNEUTrPaloDu2wfw36QL') {
    console.log(
      "You must set a Price ID in the environment variables. Please see the README."
    );
    process.exit(0);
  }
}

// Start the server
app
  .listen(5000)
  .on("listening", () =>
    console.log("Feathers server listening on localhost:5000")
  );
