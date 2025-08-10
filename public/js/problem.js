// problem.js
document.addEventListener('DOMContentLoaded', ()=>{
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  const p = window.PN.PROBLEMS.find(x => x.id === id);
  if(!p){ document.getElementById('pvContent').innerText = 'Problem not found'; return; }

  document.getElementById('pvTitle').textContent = p.title;
  document.getElementById('pvMeta').textContent = `${p.topic} · ${p.difficulty} · ${p.timeEstimate}`;
  const content = document.getElementById('pvContent');
  const tabs = document.querySelectorAll('.tab');
  function show(tab){
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if(tab === 'problem') content.innerHTML = `<pre style="white-space:pre-wrap">${p.statement}</pre>`;
    if(tab === 'hint') content.innerHTML = `<div class="card"><strong>Hint</strong><p class="muted">${p.hint}</p></div>`;
    if(tab === 'solution') content.innerHTML = `<div class="card"><strong>Solution</strong><pre style="white-space:pre-wrap">${p.solution}</pre></div>`;
  }
  show('problem');
  tabs.forEach(t => t.addEventListener('click', ()=> show(t.dataset.tab)));

  document.getElementById('pvSubmit').addEventListener('click', ()=>{
    const txt = document.getElementById('pvAnswer').value.trim();
    if(!txt){ alert('Write your solution first'); return; }
    // record demo progress locally
    window.PN.addProgress(1);
    const notice = document.getElementById('pvNotice');
    notice.style.display = 'block';
    notice.textContent = 'Solution recorded locally. Check dashboard for updated heatmap.';
  });

  document.getElementById('pvBack').addEventListener('click', ()=> location.href = 'problems.html');
  document.getElementById('pvShowHint') && document.getElementById('pvShowHint').addEventListener('click', ()=> {
    show('hint');
  });
});
