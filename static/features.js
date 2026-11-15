function localDate() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
let liveSequence=[], liveChart=null, liveSaving=false;
const LIVE_KEY='catan-live-draft-v1';
function liveCounts() {
  const counts=Object.fromEntries(Array.from({length:11},(_,i)=>[i+2,0]));
  liveSequence.forEach(n=>counts[n]++);
  return counts;
}
function initLiveGame() {
  document.getElementById('liveWinner').value='';
  document.getElementById('liveDate').value=localDate();
  try {
    const draft=JSON.parse(localStorage.getItem(LIVE_KEY));
    if(draft && Array.isArray(draft.sequence) && draft.sequence.every(n=>Number.isInteger(n)&&n>=2&&n<=12)) {
      liveSequence=draft.sequence;
      if ([2,3,4,5,6].includes(Number(draft.players))) document.getElementById('livePlayers').value=draft.players;
      if (/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) document.getElementById('liveDate').value=draft.date;
    }
  } catch(e) { document.getElementById('liveDraftNote').textContent='Черновик недоступен. Не закрывай страницу до сохранения игры.'; }
  renderLiveGame();
}
function persistLiveGame() {
  try {
    localStorage.setItem(LIVE_KEY,JSON.stringify({sequence:liveSequence,players:document.getElementById('livePlayers').value,date:document.getElementById('liveDate').value}));
  } catch(e) { document.getElementById('liveDraftNote').textContent='Не удалось сохранить черновик на устройстве. Не закрывай страницу до сохранения игры.'; }
}
function addLiveRoll(n) { if(liveSaving) return; liveSequence.push(n); persistLiveGame(); renderLiveGame(); }
function undoLiveRoll() { if(liveSaving) return; liveSequence.pop(); persistLiveGame(); renderLiveGame(); }
function resetLiveGame() {
  if(liveSaving || !confirm('Очистить текущую партию и начать заново?')) return;
  liveSequence=[]; persistLiveGame(); renderLiveGame();
}
function renderLiveGame() {
  const counts=liveCounts(), total=liveSequence.length;
  document.getElementById('liveStats').innerHTML=`<div class="stat-card"><span class="val">${total}</span><span class="lbl">Бросков в партии</span></div><div class="stat-card"><span class="val">${total?liveSequence[total-1]:'—'}</span><span class="lbl">Последняя сумма</span></div><div class="stat-card"><span class="val">${total?(counts[7]/total*100).toFixed(1)+'%':'—'}</span><span class="lbl">Семёрок</span></div>`;
  document.getElementById('liveRollButtons').innerHTML=Object.entries(counts).map(([n,count])=>`<button class="live-roll" ${liveSaving?'disabled':''} aria-label="Добавить сумму ${n}" onclick="addLiveRoll(${n})">${n}<small>Выпало: ${count}</small></button>`).join('');
  document.getElementById('liveUndo').disabled=!total||liveSaving;
  document.getElementById('liveReset').disabled=!total||liveSaving;
  document.getElementById('liveHistory').innerHTML=liveSequence.slice(-20).map(n=>`<span>${n}</span>`).join('');
  const data=Object.values(counts), theory=Object.keys(counts).map(n=>PROBS[n]/36*total);
  if(liveChart) liveChart.destroy();
  liveChart=new Chart(document.getElementById('liveChart'),{data:{labels:Object.keys(counts),datasets:[
    {type:'bar',label:'Выпало',data,backgroundColor:COLORS.bars,borderRadius:4,yAxisID:'y',order:2},
    {type:'line',label:'Теория',data:theory,borderColor:'#27AE60',borderDash:[6,4],pointRadius:3,yAxisID:'y',order:1}
  ]},options:chartOpts(total,Math.max(...data,...theory))});
}
async function saveLiveGame() {
  if(liveSaving) return;
  if(!liveSequence.length) return showToast('❌ Добавь хотя бы один бросок!',false);
  const winner=document.getElementById('liveWinner').value;
  if(!winner) return showToast('❌ Выбери победителя!',false);
  const date=document.getElementById('liveDate').value;
  if(!date) return showToast('❌ Укажи дату игры!',false);
  const payload={rolls:liveCounts(),total:liveSequence.length,winner,date,players:Number(document.getElementById('livePlayers').value)};
  liveSaving=true;
  const button=document.getElementById('liveSave');
  button.disabled=true; button.textContent='Сохраняю…';
  ['liveWinner','livePlayers','liveDate'].forEach(id=>document.getElementById(id).disabled=true);
  renderLiveGame();
  try {
    await apiFetch('/api/games',{method:'POST',body:JSON.stringify(payload)});
    liveSequence=[];
    document.getElementById('liveWinner').value='';
    document.getElementById('liveDate').value=localDate();
    persistLiveGame();
    await loadGames();
    showToast('✅ Партия сохранена! Победитель: '+winner);
  } catch(e) { showToast('❌ Сохранение не подтверждено. Черновик оставлен; проверь список игр перед повтором.',false); }
  finally {
    liveSaving=false; button.disabled=false; button.textContent='💾 Завершить и сохранить';
    ['liveWinner','livePlayers','liveDate'].forEach(id=>document.getElementById(id).disabled=false);
    renderLiveGame();
  }
}

let unusualWorker=null, unusualVersion=0;
const unusualResults=new Map();
function unusualText(percent) {
  const value=percent<0.1?'Менее 0,1':percent.toLocaleString('ru-RU',{maximumFractionDigits:1});
  return `${value}% случайных партий такой же длины отклоняются от теории не меньше этой.`;
}
function updateUnusualGames() {
  const version=++unusualVersion;
  unusualResults.clear();
  document.getElementById('unusualGames').textContent=games.length?'Сравниваем партии…':'Пока нет сохранённых игр.';
  if(unusualWorker) unusualWorker.terminate();
  if(!games.length) return;
  unusualWorker=new Worker('/static/unusual-worker.js');
  unusualWorker.onmessage=({data})=>{
    if(data.version!==unusualVersion) return;
    unusualResults.set(data.id,data.percent);
    const ranked=games.filter(g=>unusualResults.has(g.id)).sort((a,b)=>unusualResults.get(a.id)-unusualResults.get(b.id));
    document.getElementById('unusualGames').innerHTML=ranked.slice(0,3).map(g=>`<div class="record"><small>${formatDate(g.date)} · ${escapeHTML(g.winner)} · ${g.total} бросков</small><strong>${unusualResults.get(g.id)<0.1?'&lt; 0,1':unusualResults.get(g.id).toLocaleString('ru-RU',{maximumFractionDigits:1})}%</strong>${unusualText(unusualResults.get(g.id))}<br><button class="btn" onclick="showTab('games');selectGame(${games.indexOf(g)})">Открыть партию</button></div>`).join('');
    renderSelectedUnusual();
  };
  unusualWorker.onerror=()=>{ document.getElementById('unusualGames').textContent='Не удалось рассчитать оценку. Обнови страницу, чтобы повторить.'; };
  unusualWorker.postMessage({version,games:games.filter(g=>g.total>0).map(g=>({id:g.id,total:g.total,counts:Array.from({length:11},(_,i)=>g.rolls[i+2]||0)}))});
}
function renderSelectedUnusual() {
  const game=games[selectedGameIndex];
  document.getElementById('selectedGameUnusual').textContent=!game?'':unusualResults.has(game.id)?unusualText(unusualResults.get(game.id)):'Оценка необычности рассчитывается…';
}
