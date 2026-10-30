const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/js/engine.js');
const base={...E.DEFAULTS,pain:0,sleep:8,soreness:0,stress:0};
test('original low-volume regression: 5 km does not jump to 6 km or force minimum runs',()=>{
  const p=E.makePlan({...base,currentKm:5,longestKm:2,experience:'new',days:6});
  assert.equal(p.weeklyTarget,5);assert.equal(p.qualityCount,0);
  assert.equal(Math.round(p.week.reduce((a,d)=>a+d.km,0)*10),50);
});
test('red flags override every model and remove running and strength',()=>{
  for(const flag of [{emergency:true},{illness:true},{gaitPain:true},{pain:4},{pain:10},{sleep:3},{soreness:9}]){
    for(const model of ['guarded','polarized','pyramidal','race']){
      const p=E.makePlan({...base,...flag,model});
      assert.equal(p.stop,true);assert.equal(p.weeklyTarget,0);
      assert(p.week.every(d=>d.km===0 && d.minutes===0 && !d.strength && !d.blocks.length));
    }
  }
});
test('amber, beginner, returning, heat and two-day plans contain no quality',()=>{
  for(const change of [{pain:1},{sleep:5.5},{soreness:6},{heat:true},{experience:'new'},{experience:'returning'},{days:2},{goal:'base'}]){
    const p=E.makePlan({...base,...change});assert.equal(p.qualityCount,0);
    if(p.alert==='amber')assert(p.weeklyTarget<=p.state.currentKm);
  }
});
test('zero or unknown baseline produces no invented mileage',()=>{
  for(const input of [{currentKm:0},{longestKm:0}]){const p=E.makePlan({...base,...input});assert(p.noBaseline);assert.equal(p.weeklyTarget,0);assert.equal(p.qualityCount,0);}
});
test('few available days reduce total instead of creating one oversized easy run',()=>{
  const p=E.makePlan({...base,currentKm:90,longestKm:5,days:2});
  assert(p.capacityLimited);assert.equal(p.weeklyTarget,10.4);assert(p.week.every(d=>d.km<=5.2));
});
test('late race weeks reduce training rather than chase missed preparation',()=>{
  const p=E.makePlan({...base,currentKm:40,longestKm:18,weeks:1});assert.equal(p.weeklyTarget,24);assert.equal(p.qualityCount,0);
  assert(E.makePlan({...base,weeks:2}).weeklyTarget<=base.currentKm*.8);
});
test('10,000 deterministic profiles preserve sums, caps, duration and quality invariants',()=>{
  let seed=177;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<10000;i++){
    const s={...base,days:2+Math.floor(rand()*5),currentKm:Math.floor(rand()*901)/10,longestKm:Math.floor(rand()*351)/10,
      experience:['new','returning','steady','advanced'][Math.floor(rand()*4)],model:['guarded','polarized','pyramidal','race'][Math.floor(rand()*4)],goal:['base','5k','10k','half','marathon'][Math.floor(rand()*5)],
      sleep:3+Math.floor(rand()*15)/2,soreness:Math.floor(rand()*11),stress:Math.floor(rand()*11),pain:Math.floor(rand()*11),heat:rand()<.2,weeks:1+Math.floor(rand()*24),known5k:rand()<.5};
    const p=E.makePlan(s);
    assert.equal(Math.round(p.week.reduce((a,d)=>a+d.km,0)*10),Math.round(p.weeklyTarget*10));
    assert(p.week.filter(d=>d.km>0).length<=s.days);
    for(const d of p.week){assert(Number.isFinite(d.km)&&d.km>=0&&d.km<=p.sessionCap+1e-8);assert.equal(d.blocks.reduce((a,b)=>a+b.minutes,0),d.minutes);assert(d.fast<=d.minutes);}
    assert.equal(p.longest,Math.max(...p.week.map(d=>d.km)));
    assert.equal(p.low+p.moderate+p.hard,p.totalMinutes?100:0);
    assert(p.qualityCount<=1);
    if(p.stop){assert.equal(p.weeklyTarget,0);assert(p.week.every(d=>!d.strength));}
  }
});
test('invalid profile fields are bounded and prototype-like enum values rejected',()=>{
  const s=E.normalizeState({goal:'__proto__',model:'constructor',days:999,currentKm:NaN,longestKm:-10,heat:'true',emergency:'false',age:Infinity,measuredHr:20});
  assert.equal(s.goal,E.DEFAULTS.goal);assert.equal(s.days,6);assert.equal(s.longestKm,0);assert.equal(s.currentKm,28);assert.equal(s.heat,false);assert.equal(s.emergency,false);assert.equal(s.measuredHr,0);
  assert.doesNotThrow(()=>E.makePlan(s));assert.deepEqual(E.normalizeState(null),E.DEFAULTS);
});
test('pace, heart-rate and fuel assumptions remain explicit',()=>{
  const p=E.makePlan(base);assert.equal(p.easyPace,null);assert.equal(p.maxHr,183);
  assert.equal(E.makePlan({...base,measuredHr:197}).maxHr,197);
  assert.equal(E.makePlan({...base,hrAffected:true}).maxHr,null);
  assert.equal(E.makePlan({...base,known5k:true,heat:true}).easyPace,null);
  assert.equal(E.formatPace(359.6),'6:00');assert.match(E.fuelAdvice(100),/30–60/);assert.match(E.fuelAdvice(180),/60–90/);
});
test('diary validates dates and computes recorded seven-day load without treating missing days as data',()=>{
  assert.throws(()=>E.validateLog({date:'2026-02-30',km:5,minutes:30,rpe:4,note:''},'2026-10-30'));
  assert.throws(()=>E.validateLog({date:'2026-10-31',km:5,minutes:30,rpe:4,note:''},'2026-10-30'));
  assert.throws(()=>E.validateLog({date:'2026-10-30',km:-1,minutes:30,rpe:4,note:''},'2026-10-30'));
  const stats=E.summarizeLogs([{date:'2026-10-30',km:5,minutes:30,rpe:4},{date:'2026-10-24',km:2,minutes:20,rpe:3},{date:'2026-10-23',km:8,minutes:50,rpe:4}], '2026-10-30');
  assert.deepEqual(stats.current,{count:2,km:7,load:180});assert.deepEqual(stats.previous,{count:1,km:8,load:200});
});
test('calendar uses local all-day dates, valid UTF-8 folding, and blocks stopped plans',()=>{
  const p=E.makePlan(base),ics=E.makeCalendar(p,'2026-11-02',new Date('2026-10-30T22:30:00+08:00'));
  assert.match(ics,/DTSTART;VALUE=DATE:20261102/);assert.match(ics,/DTEND;VALUE=DATE:20261109/);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,7);
  assert(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
  assert.throws(()=>E.makeCalendar(p,'2026-11-03'));
  assert.throws(()=>E.makeCalendar(E.makePlan({...base,pain:6}),'2026-11-02'));
});
test('source library has 26 sports/health and 4 platform entries with unique primary links',()=>{
  const sources=require('../assets/js/evidence.js');
  assert.equal(sources.length,30);assert.equal(sources.filter(s=>s.category==='iPhone').length,4);
  assert.equal(new Set(sources.map(s=>s.id)).size,30);assert.equal(new Set(sources.map(s=>s.url)).size,30);
  for(const s of sources)assert.match(s.url,/^https:\/\//);
});
