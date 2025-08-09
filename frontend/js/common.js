/* common.js - shared utilities, data, theme, payments */

/* ======= CONFIG - REPLACE THESE BEFORE DEPLOY ======= */
const CONFIG = {
  PAYMENT_SERVER: 'https://your-payment-server.example.com', // <-- set after you deploy backend
  STRIPE_PUBLISHABLE_KEY: 'pk_test_replace_with_yours',      // <-- your Stripe publishable key (pk_test_... or pk_live_...)
  RAZORPAY_KEY_ID: '',                                       // <-- optional (Razorpay key id for client)
  PRICE_ID_MONTHLY: 'price_monthly_replace',                 // <-- Stripe Price ID for monthly subscription (price_...)
  PRICE_ID_YEARLY: 'price_yearly_replace'                    // <-- Stripe Price ID for yearly subscription
};
/* ==================================================== */

/* == Problems dataset (demo) == */
const PROBLEMS = [
  { id:1, title:"Simple Harmonic Motion — Spring-Mass System", difficulty:"Easy", topic:"Classical Mechanics", acceptance:78.4, solved:true, likes:234, timeEstimate:"15 min",
    statement: `A mass m = 2.0 kg is attached to a spring with spring constant k = 200 N/m. The mass is displaced from equilibrium by x₀ = 0.1 m and released.\n\nFind:\n1) ω\n2) T\n3) v_max\n4) x(t)`,
    hint: `Use ω = √(k/m). Energy conservation gives v_max via ½ k x₀² = ½ m v_max².`,
    solution: `ω = √(k/m) = 10 rad/s\nT = 2π/ω = 0.628 s\nv_max = x₀ ω = 1.0 m/s\nx(t) = 0.1 cos(10 t) m`
  },
  { id:2, title:"Electric Field of Two Point Charges", difficulty:"Easy", topic:"Electromagnetism", acceptance:72.1, solved:false, likes:189, timeEstimate:"20 min",
    statement: `Two point charges +q and -q separated by 2a. Find E on perpendicular bisector at distance x.`,
    hint: `Use symmetry and vector addition.`,
    solution: `E = (1/(4πε₀)) * (2 q x) / ((x² + a²)^(3/2))`
  },
  { id:3, title:"Particle in a Box — Energy Eigenvalues", difficulty:"Medium", topic:"Quantum Mechanics", acceptance:45.6, solved:false, likes:312, timeEstimate:"35 min",
    statement:`Find E_n for an infinite square well width a.`,
    hint:`Solve Schrödinger with ψ(0)=ψ(a)=0.`,
    solution:`E_n = (n² π² ħ²)/(2 m a²)`
  }
];
window.PHYSICSNOVA = { PROBLEMS };

/* == Utilities == */
const $ = (q, ctx=document) => ctx.querySelector(q);
const $$ = (q, ctx=document) => Array.from(ctx.querySelectorAll(q));
const escapeHtml = s => s ? String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : '';

/* == Theme == */
const THEME_KEY = 'pn_theme';
function applyTheme() {
  const t = localStorage.getItem(THEME_KEY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.classList.toggle('dark', t === 'dark');
  $$('.theme-indicator').forEach(el => { el.textContent = t === 'dark' ? '☀' : '🌙'; });
}
function toggleTheme() {
  const current = document.body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, current === 'dark' ? 'light' : 'dark');
  applyTheme();
}

/* == Heatmap progress stored locally as array [{date:'YYYY-MM-DD',count:1}] == */
const PROG_KEY = 'physicsnova_progress';
function readProgress(){ try { return JSON.parse(localStorage.getItem(PROG_KEY) || '[]'); } catch(e){ return []; } }
function writeProgress(arr){ localStorage.setItem(PROG_KEY, JSON.stringify(arr)); }

/* render heatmap into a container element (DOM element) */
function renderHeatmap(dom, days=210){
  if(!dom) return;
  dom.innerHTML = '';
  const today = new Date();
  const map = {};
  readProgress().forEach(r => map[r.date] = (map[r.date]||0) + (r.count||0));
  for(let i = days - 1; i >= 0; i--){
    const d = new Date(); d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0,10);
    const c = map[iso] || 0;
    const cell = document.createElement('div');
    cell.className = 'heat-cell ' + (c===0 ? '' : c>=4 ? 'level4' : c>=3 ? 'level3' : c===2 ? 'level2' : 'level1');
    cell.title = `${iso}: ${c} solved`;
    dom.appendChild(cell);
  }
}

/* local helpers: add today's solved count */
function addProgress(count=1){
  const today = new Date().toISOString().slice(0,10);
  const arr = readProgress();
  const found = arr.find(r => r.date === today);
  if(found) found.count = Math.min(5, (found.count||0) + count);
  else arr.push({ date: today, count });
  writeProgress(arr);
}

/* == Orbit animation (small decorative) == */
let orbitTime = 0;
function orbitTick(){
  orbitTime += 0.01;
  $$('.orbit-dot').forEach((d,i) => {
    const r = 48 + (i%3)*6;
    const angle = orbitTime * (0.6 + i*0.15);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * (r * 0.28);
    d.style.transform = `translate(${x}px, ${y}px)`;
  });
  requestAnimationFrame(orbitTick);
}

/* == Stripe + Razorpay client helpers == */
function loadScript(url){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement('script'); s.src = url; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}

/* Stripe Checkout (redirect) */
async function startStripeCheckout(priceId, customerEmail=''){
  if(!priceId || !CONFIG.PAYMENT_SERVER || !CONFIG.STRIPE_PUBLISHABLE_KEY){
    alert('Stripe not configured. Set keys in common.js (CONFIG).');
    return;
  }
  try{
    const resp = await fetch(`${CONFIG.PAYMENT_SERVER}/create-checkout-session`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ priceId, mode: 'subscription', customerEmail })
    });
    const data = await resp.json();
    if(data.error) throw new Error(data.error);
    await loadScript('https://js.stripe.com/v3/');
    const stripe = Stripe(CONFIG.STRIPE_PUBLISHABLE_KEY);
    await stripe.redirectToCheckout({ sessionId: data.sessionId || data.id || data });
  }catch(e){ console.error(e); alert('Stripe error: ' + (e.message || e)); }
}

/* Razorpay: create order on server then open checkout */
async function startRazorpay(amountInRupees, email=''){
  if(!CONFIG.PAYMENT_SERVER || !CONFIG.RAZORPAY_KEY_ID){
    alert('Razorpay not configured (client key missing).');
    return;
  }
  try{
    const resp = await fetch(`${CONFIG.PAYMENT_SERVER}/create-razorpay-order`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount: Math.round(amountInRupees*100), currency:'INR', email })
    });
    const order = await resp.json();
    if(order.error) throw new Error(order.error);
    // open Razorpay
    const options = {
      key: CONFIG.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'PhysicsNova',
      description: 'Subscription',
      order_id: order.id,
      handler: async function(response){
        // send to server to verify & record
        await fetch(`${CONFIG.PAYMENT_SERVER}/verify-razorpay`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(response) });
        alert('Payment recorded — thank you!');
      },
      prefill: { email }
    };
    const rzp = new Razorpay(options);
    rzp.open();
  }catch(e){ console.error(e); alert('Razorpay error: ' + (e.message || e)); }
}

/* Export utilities for page scripts */
window.PN = {
  PROBLEMS,
  renderHeatmap,
  addProgress,
  startStripeCheckout,
  startRazorpay,
  toggleTheme,
  applyTheme
};

/* Init global behavior */
document.addEventListener('DOMContentLoaded', ()=>{
  applyTheme();
  orbitTick();
  // wire global modal buttons
  $$('#themeToggle').forEach(b => b.addEventListener('click', toggleTheme));
  $$('#upgradeBtn, #ctaUpgrade, #footerUpgrade').forEach(b => b && b.addEventListener('click', ()=> {
    const m = $('#subModal'); if(m) { m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); }
  }));
  // modal close
  $$('.modal-close').forEach(b => b.addEventListener('click', ()=>{
    b.closest('.modal').classList.add('hidden');
  }));
});
