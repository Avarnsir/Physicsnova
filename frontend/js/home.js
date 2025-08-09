// home.js
document.addEventListener('DOMContentLoaded', ()=>{
  // Insert year
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  // render small heatmap preview
  const hm = document.getElementById('homeHeatmap');
  if(hm) window.PN.renderHeatmap(hm, 90);

  // wire buy buttons in modal (if present)
  const buyMonthly = document.getElementById('buyMonthly');
  const buyYearly = document.getElementById('buyYearly');
  buyMonthly && buyMonthly.addEventListener('click', ()=> {
    // If you have Stripe price ID configured, it will run checkout; otherwise, fallback to Razorpay if configured in common.js
    if(CONFIG.PRICE_ID_MONTHLY && CONFIG.PRICE_ID_MONTHLY.startsWith('price_')) window.PN.startStripeCheckout(CONFIG.PRICE_ID_MONTHLY);
    else window.PN.startRazorpay(199);
  });
  buyYearly && buyYearly.addEventListener('click', ()=> {
    if(CONFIG.PRICE_ID_YEARLY && CONFIG.PRICE_ID_YEARLY.startsWith('price_')) window.PN.startStripeCheckout(CONFIG.PRICE_ID_YEARLY);
    else window.PN.startRazorpay(1499);
  });

  // quick links
  const cta = document.getElementById('ctaUpgrade');
  cta && cta.addEventListener('click', ()=> {
    const m = document.getElementById('subModal'); if(m) m.classList.remove('hidden');
  });
});
