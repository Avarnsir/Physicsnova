/**
 * PhysicsNova payments server
 *
 * Endpoints:
 * POST /create-checkout-session  -> Stripe Checkout session (subscriptions)
 * POST /create-razorpay-order   -> Razorpay order creation
 * POST /webhook/stripe          -> Stripe webhook (verify via STRIPE_WEBHOOK_SECRET)
 * POST /webhook/razorpay        -> Razorpay webhook verify (RAZORPAY_WEBHOOK_SECRET)
 * GET  /health
 * GET  /user?email=...
 *
 * .env required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, FRONTEND_BASE
 */

require('dotenv').config();
const path = require("path");
const express = require('express');
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const Razorpay = require('razorpay');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const PORT = process.env.PORT || 4242;
const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://localhost:5500';
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const stripe = Stripe(STRIPE_SECRET);
const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

const app = express();

// raw body for stripe webhook
app.use(cors());
app.use(express.json());

// SQLite setup
const db = new Database('data.db');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY, user_id INTEGER, provider TEXT, provider_subscription_id TEXT, price_id TEXT, status TEXT, current_period_end TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, user_id INTEGER, provider TEXT, provider_payment_id TEXT, amount INTEGER, currency TEXT, status TEXT, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER, provider TEXT, provider_order_id TEXT, amount INTEGER, currency TEXT, status TEXT, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// prepared statements
const findUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
const createUserStmt = db.prepare('INSERT INTO users (email) VALUES (?)');
const createPaymentStmt = db.prepare(`INSERT INTO payments (user_id, provider, provider_payment_id, amount, currency, status, metadata) VALUES (?,?,?,?,?,?,?)`);
const createSubscriptionStmt = db.prepare(`INSERT INTO subscriptions (user_id, provider, provider_subscription_id, price_id, status, current_period_end) VALUES (?,?,?,?,?,?)`);
const updateSubscriptionStmt = db.prepare(`UPDATE subscriptions SET status = ?, current_period_end = ? WHERE provider_subscription_id = ?`);
const createOrderStmt = db.prepare(`INSERT INTO orders (user_id, provider, provider_order_id, amount, currency, status, metadata) VALUES (?,?,?,?,?,?,?)`);

// helper getOrCreateUser
function getOrCreateUser(email){
  if(!email) return null;
  const e = findUserByEmailStmt.get(email.toLowerCase());
  if(e) return e;
  const res = createUserStmt.run(email.toLowerCase());
  return { id: res.lastInsertRowid, email: email.toLowerCase() };
}

// create stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, mode = 'subscription', customerEmail } = req.body;
    if(!priceId) return res.status(400).json({ error: 'priceId required' });

    const user = customerEmail ? getOrCreateUser(customerEmail) : null;

    const sessionPayload = {
      payment_method_types: ['card'],
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_BASE}/?checkout=success`,
      cancel_url: `${FRONTEND_BASE}/?checkout=cancel`,
      metadata: { userId: user ? user.id : '' }
    };
    if(customerEmail) sessionPayload.customer_email = customerEmail;

    const session = await stripe.checkout.sessions.create(sessionPayload);

    if(user) createSubscriptionStmt.run(user.id, 'stripe', session.id, priceId, 'pending', null);

    res.json({ sessionId: session.id });
  } catch(err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: err.message });
  }
});

// stripe webhook
app.post('/webhook/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  if(!STRIPE_WEBHOOK_SECRET) {
    // try parse without verify (not recommended)
    try { event = JSON.parse(req.body.toString()); } catch(e){ return res.status(400).send('invalid webhook'); }
  } else {
    try { event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET); } catch(e){ console.error(e); return res.status(400).send(`Webhook Error: ${e.message}`); }
  }

  (async () => {
    try {
      switch(event.type){
        case 'checkout.session.completed': {
          const session = event.data.object;
          const metadataUserId = session.metadata && session.metadata.userId ? Number(session.metadata.userId) : null;
          const subscriptionId = session.subscription || null;
          if(subscriptionId){
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const status = sub.status;
            const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
            updateSubscriptionStmt.run(status, periodEnd, subscriptionId);
          } else if(session.id){
            updateSubscriptionStmt.run('active', null, session.id);
          }
          if(metadataUserId){
            createPaymentStmt.run(metadataUserId, 'stripe', session.id, session.amount_total || 0, session.currency || 'usd', 'completed', JSON.stringify(session));
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;
          const status = invoice.status || 'paid';
          const periodEnd = invoice.lines && invoice.lines.data && invoice.lines.data[0] && invoice.lines.data[0].period && invoice.lines.data[0].period.end ? new Date(invoice.lines.data[0].period.end * 1000).toISOString() : null;
          if(subscriptionId){
            updateSubscriptionStmt.run(status, periodEnd, subscriptionId);
          }
          createPaymentStmt.run(null, 'stripe', invoice.id, invoice.amount_paid || 0, invoice.currency || 'usd', status, JSON.stringify(invoice));
          break;
        }
        case 'customer.subscription.*':
          // handle subscription events if needed
          break;
      }
    } catch(e){ console.error('Error handling stripe webhook', e); }
  })();

  res.json({ received: true });
});

// create razorpay order
app.post('/create-razorpay-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, email } = req.body;
    if(!amount) return res.status(400).json({ error: 'amount required' });
    const options = { amount: amount, currency, receipt: receipt || `rcpt_${Date.now()}`, payment_capture: 1 };
    const order = await razorpay.orders.create(options);
    let userId = null;
    if(email){
      const u = getOrCreateUser(email);
      if(u) userId = u.id;
    }
    createOrderStmt.run(userId, 'razorpay', order.id, order.amount, order.currency, order.status || 'created', JSON.stringify(order));
    res.json(order);
  } catch(err) {
    console.error('create-razorpay-order error', err);
    res.status(500).json({ error: err.message });
  }
});

// verify razorpay webhook
app.post('/webhook/razorpay', bodyParser.json(), (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const payload = JSON.stringify(req.body);
  if(RAZORPAY_WEBHOOK_SECRET){
    const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(payload).digest('hex');
    if(signature !== expected){ console.warn('Razorpay signature mismatch'); return res.status(400).json({ ok:false }); }
  } else {
    console.warn('RAZORPAY_WEBHOOK_SECRET not set; skipping verification (not recommended)');
  }
  const event = req.body;
  try {
    if(event.event === 'payment.captured' || event.event === 'order.paid'){
      const payment = event.payload && (event.payload.payment ? event.payload.payment.entity : null);
      if(payment){
        const orderId = payment.order_id;
        const row = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(orderId);
        const userId = row ? row.user_id : null;
        createPaymentStmt.run(userId, 'razorpay', payment.id, payment.amount, payment.currency, payment.status || 'captured', JSON.stringify(payment));
        db.prepare('UPDATE orders SET status = ? WHERE provider_order_id = ?').run(payment.status || 'paid', orderId);
      }
    }
  } catch(e){ console.error('Error processing razorpay webhook', e); }

  res.json({ ok:true });
});

// health & user endpoints
app.get('/health', (req,res) => res.json({ ok:true }));
app.get('/user', (req,res) => {
  const email = req.query.email;
  if(!email) return res.status(400).json({ error:'email required' });
  const user = findUserByEmailStmt.get(email.toLowerCase());
  if(!user) return res.json({ user:null, subscriptions:[] });
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  res.json({ user, subscriptions: subs });
});

module.exports = app;
