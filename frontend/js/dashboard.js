// dashboard.js
document.addEventListener('DOMContentLoaded', ()=>{
  const solvedEl = document.getElementById('dashSolved');
  const streakEl = document.getElementById('dashStreak');
  const lb = document.getElementById('leaderboard');

  function calcSolved(){
    const arr = JSON.parse(localStorage.getItem('physicsnova_progress')||'[]');
    return arr.reduce((s,r)=> s + (r.count||0), 0);
  }
  function calcStreak(){
    const arr = JSON.parse(localStorage.getItem('physicsnova_progress')||'[]');
    const map = {}; arr.forEach(r => map[r.date]=r.count||0);
    let streak = 0;
    for(let i=0;i<365;i++){
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      if(map[iso] && map[iso] > 0) streak++; else break;
    }
    return streak;
  }

  solvedEl && (solvedEl.textContent = calcSolved());
  streakEl && (streakEl.textContent = calcStreak());
  lb && (lb.innerHTML = `<li>You — ${calcSolved()}</li><li>Top user — 75</li>`);
  const hm = document.getElementById('dashHeatmap');
  if(hm) window.PN.renderHeatmap(hm, 210);
});
