// problems.js
document.addEventListener('DOMContentLoaded', ()=>{
  const problems = window.PN.PROBLEMS;
  const container = document.getElementById('problemsContainer');
  const searchBox = document.getElementById('searchBox');
  const topicFilter = document.getElementById('topicFilter');
  const difficultyFilter = document.getElementById('difficultyFilter');
  const noResults = document.getElementById('noResults');

  function populateTopics(){
    const topics = ['All', ...new Set(problems.map(p => p.topic))];
    topicFilter.innerHTML = topics.map(t => `<option value="${t}">${t}</option>`).join('');
  }
  function matches(p,q,topic,diff){
    if(topic && topic !== 'All' && p.topic !== topic) return false;
    if(diff && diff !== 'All' && p.difficulty !== diff) return false;
    if(q && q.length){
      return (p.title + ' ' + p.topic).toLowerCase().includes(q.toLowerCase());
    }
    return true;
  }
  function render(){
    container.innerHTML = '';
    const q = searchBox.value || '';
    const topic = topicFilter.value || 'All';
    const diff = difficultyFilter.value || 'All';
    const list = problems.filter(p => matches(p,q,topic,diff));
    if(list.length === 0) { noResults.classList.remove('hidden'); return; } else noResults.classList.add('hidden');
    list.forEach(p => {
      const card = document.createElement('div'); card.className = 'problem-card';
      card.innerHTML = `<div><strong>${escapeHtml(p.title)}</strong><div class="muted" style="margin-top:8px">${escapeHtml(p.topic)} · ${escapeHtml(p.timeEstimate)}</div></div>
        <div class="problem-meta"><div>❤ ${p.likes}</div><div>${p.acceptance}%</div></div>`;
      card.addEventListener('click', ()=> location.href = `problem.html?id=${p.id}`);
      container.appendChild(card);
    });
  }

  populateTopics();
  render();

  searchBox.addEventListener('input', render);
  topicFilter.addEventListener('change', render);
  difficultyFilter.addEventListener('change', render);
});
