// Run with Node.js: node tests/features.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const elements=new Map();
const document={getElementById:id=>{
  if(!elements.has(id)) elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false});
  return elements.get(id);
}};
const storage=new Map();
let failSave=false, saved;
const context=vm.createContext({document,Date,console,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  PROBS:{2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1},
  COLORS:{bars:[]}, Chart:class {destroy(){}}, chartOpts:()=>({}),showToast:()=>{},loadGames:async()=>{},
  apiFetch:async(url,opts)=>{if(failSave) throw Error('offline');saved=JSON.parse(opts.body);},confirm:()=>true
});
vm.runInContext(fs.readFileSync(new URL('../static/features.js',import.meta.url),'utf8'),context);
const run=code=>vm.runInContext(code,context);
run('initLiveGame(); addLiveRoll(6); addLiveRoll(7); addLiveRoll(8); undoLiveRoll();');
assert.equal(run('liveSequence.length'),2);
assert.equal(JSON.parse(storage.get('catan-live-draft-v1')).sequence.length,2);
run('liveSequence=[];initLiveGame();');
assert.equal(run('liveSequence.length'),2);
document.getElementById('liveWinner').value='Максим';
document.getElementById('livePlayers').value='4';
failSave=true;
await run('saveLiveGame()');
assert.equal(run('liveSequence.length'),2);
assert.equal(document.getElementById('liveSave').disabled,false);
failSave=false;
await run('saveLiveGame()');
assert.equal(saved.total,2);
assert.equal(saved.rolls['6'],1);
assert.equal(saved.rolls['7'],1);
assert.equal(saved.winner,'Максим');
assert.equal(run('liveSequence.length'),0);
assert.equal(JSON.parse(storage.get('catan-live-draft-v1')).sequence.length,0);

const results=[];
globalThis.self={postMessage:r=>results.push(r)};
await import('../static/unusual-worker.js');
self.onmessage({data:{version:1,games:[
  {id:1,total:36,counts:[1,2,3,4,5,6,5,4,3,2,1]},
  {id:2,total:36,counts:[36,0,0,0,0,0,0,0,0,0,0]},
  {id:3,total:1,counts:[1,0,0,0,0,0,0,0,0,0,0]}
]}});
assert.equal(results[0].percent,100);
assert(results[1].percent<0.1);
assert(results[2].percent>4&&results[2].percent<8);
console.log('PASS: live counts, undo, draft restore, failed save retention, successful save, Monte Carlo extremes and short game');
