// Monte Carlo calibration of Pearson's statistic, valid even for short games.
const probabilities = [1,2,3,4,5,6,5,4,3,2,1].map(n=>n/36);
const distributions = new Map();
function score(counts, total) {
  return counts.reduce((sum,count,i)=>sum+(count-total*probabilities[i])**2/(total*probabilities[i]),0);
}
function distribution(total) {
  if (distributions.has(total)) return distributions.get(total);
  let seed = (total ^ 0x9e3779b9) >>> 0;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed>>>0)/4294967296; };
  const values = [];
  for (let trial=0;trial<10000;trial++) {
    const counts = Array(11).fill(0);
    for (let roll=0;roll<total;roll++) counts[Math.floor(random()*6)+Math.floor(random()*6)]++;
    values.push(score(counts,total));
  }
  values.sort((a,b)=>a-b);
  distributions.set(total,values);
  return values;
}
self.onmessage = ({data}) => {
  for (const game of data.games) {
    if (!Number.isInteger(game.total) || game.total<=0 || game.total>100000) continue;
    const values=distribution(game.total), observed=score(game.counts,game.total);
    let low=0, high=values.length;
    while(low<high) { const mid=(low+high)>>>1; if(values[mid]<observed-1e-9) low=mid+1; else high=mid; }
    self.postMessage({version:data.version,id:game.id,percent:(values.length-low+1)/(values.length+1)*100});
  }
};
