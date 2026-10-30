/* PacerIQ v2: deterministic planning, independent of browser/storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PacerEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({
    goal: 'half', experience: 'steady', model: 'polarized', days: 4,
    currentKm: 28, longestKm: 11, recent5kMin: 28, known5k: false,
    age: 36, weeks: 10, sleep: 7.5, soreness: 2, stress: 2, pain: 0,
    route: 'river', heat: false, night: true, emergency: false,
    illness: false, gaitPain: false, measuredHr: 0, hrAffected: false
  });
  const ENUMS = {goal: ['base','5k','10k','half','marathon'], experience: ['new','returning','steady','advanced'], model: ['guarded','polarized','pyramidal','race'], route: ['river','city','trail','treadmill']};
  const RANGES = {days:[2,6,1],currentKm:[0,90,0.1],longestKm:[0,35,0.1],recent5kMin:[16,60,0.5],age:[18,85,1],weeks:[1,24,1],sleep:[3,10,0.5],soreness:[0,10,1],stress:[0,10,1],pain:[0,10,1],measuredHr:[0,230,1]};
  const GOALS = {base:'建立跑步習慣','5k':'5K 速度','10k':'10K 成績',half:'半馬備賽',marathon:'全馬備賽'};
  const MODELS = {guarded:'保守累積',polarized:'低強度優先',pyramidal:'金字塔',race:'賽前維持'};
  const DAY_NAMES = ['週一','週二','週三','週四','週五','週六','週日'];
  const DAYS = {2:[1,5],3:[1,3,6],4:[1,3,5,6],5:[0,1,3,5,6],6:[0,1,2,3,5,6]};
  const round = (x, d=1) => Math.round((x + Number.EPSILON) * 10**d) / 10**d;
  const floorKm = x => Math.floor((x + 1e-8) * 10) / 10;
  const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
  function normalizeState(input) {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const out = {...DEFAULTS};
    for (const [key, value] of Object.entries(out)) {
      if (ENUMS[key]) { if (ENUMS[key].includes(src[key])) out[key] = src[key]; }
      else if (typeof value === 'boolean') { if (typeof src[key] === 'boolean') out[key] = src[key]; }
      else if (typeof src[key] === 'number' && Number.isFinite(src[key])) {
        const [min,max,step] = RANGES[key];
        out[key] = round(Math.round(clamp(src[key],min,max)/step)*step,1);
      }
    }
    if (out.measuredHr > 0 && out.measuredHr < 60) out.measuredHr = 0;
    return out;
  }
  function formatPace(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const s = Math.round(seconds);
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }
  function readiness(s) {
    // Product heuristic, not a validated readiness or injury probability score.
    const score = Math.round(clamp(90+(s.sleep-7)*6-s.soreness*3-s.stress*3-s.pain*9,0,100));
    if (s.emergency) return {score,alert:'red',stop:true,reason:'出現胸痛、昏厥或異常呼吸困難：立即停止運動並尋求緊急醫療協助。症狀持續或嚴重時聯絡當地緊急服務。'};
    if (s.illness || s.gaitPain || s.pain >= 4) return {score,alert:'red',stop:true,reason:'暫停跑步與肌力課。發燒、局部疼痛、疼痛加劇或步態改變時，先接受醫療評估；本系統不替你安排復健。'};
    if (score < 45 || s.sleep < 4.5 || s.soreness >= 8) return {score,alert:'red',stop:true,reason:'恢復訊號偏弱，暫停本次自動課表；休息並重新評估，不補做漏掉的跑量。'};
    if (s.pain > 0 || score < 70 || s.sleep < 6 || s.soreness >= 6 || s.heat) return {score,alert:'amber',stop:false,reason:'本週保守降載、只保留輕鬆跑。跑中若疼痛增加或步態改變，立即停止；熱濕天以跑感調整。'};
    return {score,alert:'green',stop:false,reason:'可參考保守課表；這不代表醫療許可或無受傷風險。每次出門前重新確認身體反應。'};
  }
  function makePlan(input) {
    const state = normalizeState(input), s = state, status = readiness(s);
    const noBaseline = s.currentKm === 0 || s.longestKm === 0;
    const beginner = ['new','returning'].includes(s.experience);
    const taper = s.goal !== 'base' && s.weeks <= 2;
    let factor = status.stop ? 0 : status.alert === 'amber' ? 0.8 : beginner ? 1 : 1.03;
    if (s.model === 'guarded' || s.model === 'race') factor = Math.min(factor,1);
    if (taper) factor = Math.min(factor,s.weeks === 1 ? 0.6 : 0.8);
    // Every session is capped against the same 30-day baseline; never compound in-week.
    const sessionCap = floorKm(Math.min(35,s.longestKm * (factor > 1 ? 1.05 : 1)));
    const desired = floorKm(s.currentKm * factor);
    const weeklyTarget = noBaseline ? 0 : floorKm(Math.min(desired,sessionCap*s.days));
    const active = DAYS[s.days];
    const units = Math.round(weeklyTarget*10);
    const base = Math.floor(units/s.days), extra = units % s.days;
    // Integer tenths keep the weekly sum exact; distribute remainders to later runs.
    const distances = active.map((_,i) => (base+(i>=s.days-extra?1:0))/10);
    const last = active.length-1;
    let longUnits = Math.round(distances[last]*10);
    const desiredLong = Math.min(Math.floor(sessionCap*10),Math.round(units*Math.max(1/s.days,0.32)));
    for (let i=0;i<last && longUnits<desiredLong;i++) {
      const available = Math.max(0,Math.round(distances[i]*10)-Math.floor(base*0.8));
      const moved = Math.min(available,desiredLong-longUnits);
      distances[i] = (Math.round(distances[i]*10)-moved)/10; longUnits += moved;
    }
    if (distances.length) distances[last] = longUnits/10;
    const easyPace = s.known5k ? s.recent5kMin*12 + (beginner ? 120 : 90) : 480;
    const qualityIndex = s.days >= 5 ? 1 : 1;
    const qualityDay = active[qualityIndex];
    const canQuality = !status.stop && !noBaseline && status.alert==='green' && !beginner && s.days>=3 && s.goal!=='base' && s.model!=='guarded' && s.weeks>1 && !s.heat;
    const week = DAY_NAMES.map((day,dayIndex) => {
      const i = active.indexOf(dayIndex);
      const km = i<0 ? 0 : distances[i];
      const estimated = km * easyPace / 60;
      const canFitQuality = canQuality && dayIndex===qualityDay && estimated>=30 && km>=4;
      const kind = status.stop || noBaseline || km===0 ? 'rest' : canFitQuality ? 'hard' : i===last ? 'long' : 'easy';
      const minutes = kind==='rest' ? 0 : Math.max(1,Math.round(estimated));
      const fast = kind==='hard' ? Math.min(s.model==='race'?6:10,Math.floor((minutes-20)/2)) : 0;
      const strength = !status.stop && !noBaseline && status.alert==='green' && [2,4].includes(dayIndex);
      const title = kind==='rest' ? (status.stop?'暫停訓練':noBaseline?'先建立基準':strength?'休跑＋可選肌力':'休息') : kind==='hard' ? (s.model==='pyramidal'?'控制節奏':'短段品質課') : kind==='long' ? '本週最長輕鬆跑' : '輕鬆跑';
      const blocks = kind==='rest' ? [] : kind==='hard' ? [
        {minutes:10,title:'輕鬆暖身',detail:'能完整說話，RPE 2–3。'},
        {minutes:minutes-15,title:`主段含 ${fast} 分鐘較快跑`,detail:`每次較快跑最多 2 分鐘，合計 ${fast} 分鐘；段間至少 2 分鐘慢跑，其餘時間輕鬆。RPE ${s.model==='pyramidal'?'5–6':'6–7'}，不衝刺。`},
        {minutes:5,title:'輕鬆收操',detail:'慢跑或走路至呼吸平穩。'}
      ] : minutes>=15 ? [
        {minutes:5,title:'放慢開始',detail:'逐漸進入節奏，RPE 2。'},
        {minutes:minutes-10,title:beginner?'輕鬆跑走':'輕鬆有氧',detail:'能完整說話、RPE 2–4；需要時改走路。'},
        {minutes:5,title:'放慢結束',detail:'慢跑或走路，不追加距離。'}
      ] : [{minutes,title:'短時間跑走',detail:'全程輕鬆，隨時可改走路。'}];
      return {day,dayIndex,kind,title,km,minutes,fast,strength,blocks};
    });
    const totalMinutes = week.reduce((a,d)=>a+d.minutes,0);
    const qualityMinutes = week.reduce((a,d)=>a+d.fast,0);
    const moderate = s.model==='pyramidal' && totalMinutes ? round(qualityMinutes/totalMinutes*100,0) : 0;
    const hard = s.model!=='pyramidal' && totalMinutes ? round(qualityMinutes/totalMinutes*100,0) : 0;
    const low = totalMinutes ? 100-moderate-hard : 0;
    const longest = Math.max(0,...week.map(d=>d.km));
    const longMinutes = Math.max(0,...week.map(d=>d.minutes));
    const chosen = week.find(d=>d.kind==='hard') || week.find(d=>d.kind==='easy') || week.find(d=>d.km>0) || week[0];
    return {state,...status,noBaseline,taper,beginner,weeklyTarget,sessionCap,longest,longMinutes,totalMinutes,qualityMinutes,low,moderate,hard,week,chosen,
      qualityCount:week.filter(d=>d.kind==='hard').length,
      progression:s.currentKm ? round((weeklyTarget/s.currentKm-1)*100) : null,
      capacityLimited:weeklyTarget<desired && !noBaseline,
      easyPace:s.known5k && !s.heat && s.route!=='trail'?easyPace:null,
      maxHr:s.hrAffected?null:s.measuredHr || Math.round(208-0.7*s.age),
      estimatedHr:!s.measuredHr,
      reason:noBaseline && !status.stop?'缺少跑量基準：請填最近約 4 週的平均週量與近 30 天最長跑。剛開始跑步可先參考 NHS 的跑走入門計畫。':status.reason
    };
  }
  function fuelAdvice(minutes) {
    if (!Number.isFinite(minutes) || minutes<=0) return '尚未安排跑步，先維持規律飲食；不為休息日刻意節食。';
    if (minutes<45) return '短課表通常不必額外補碳水；規律飲食與個人耐受度優先。';
    if (minutes<75) return '45–75 分鐘可依強度與耐受度少量補碳水，輕鬆短跑不必硬塞能量膠。';
    if (minutes<=150) return '約 1–2.5 小時：可從每小時 30–60 g 碳水演練，先在訓練中確認腸胃耐受。';
    return '超過 2.5 小時：有補給訓練者可朝每小時 60–90 g 碳水個人化調整；須逐步演練，初次不要直接用上限。';
  }
  function localDate(date=new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function validDate(value) {
    if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d=new Date(value+'T12:00:00');
    return Number.isFinite(d.getTime()) && localDate(d)===value;
  }
  function dateOrdinal(value) {
    const [y,m,d]=value.split('-').map(Number);
    return Math.floor(Date.UTC(y,m-1,d)/86400000);
  }
  function validateLog(entry,today=localDate()) {
    if (!entry || !validDate(entry.date) || entry.date>today || entry.date<'2000-01-01') throw new Error('日期須為有效的今日或過去日期。');
    const {km,minutes,rpe}=entry;
    if (![km,minutes,rpe].every(v=>typeof v==='number' && Number.isFinite(v)) || km<0 || km>200 || minutes<1 || minutes>1440 || rpe<0 || rpe>10) throw new Error('請輸入有效距離、1–1440 分鐘與 0–10 的 RPE。');
    if (typeof entry.note!=='string' || entry.note.length>240) throw new Error('備註最多 240 字。');
    return {id:typeof entry.id==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(entry.id)?entry.id:undefined,date:entry.date,km:round(km),minutes:round(minutes),rpe:round(rpe),note:entry.note};
  }
  function summarizeLogs(logs,today=localDate()) {
    const now=dateOrdinal(today), current={km:0,load:0,count:0},previous={km:0,load:0,count:0};
    for(const log of logs) {
      const days=now-dateOrdinal(log.date);
      const period=days>=0 && days<7?current:days>=7 && days<14?previous:null;
      if(period){period.km+=log.km;period.load+=log.minutes*log.rpe;period.count++;}
    }
    return {current:{...current,km:round(current.km),load:round(current.load)},previous:{...previous,km:round(previous.km),load:round(previous.load)}};
  }
  function nextMonday(date=new Date()) {
    const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
    d.setDate(d.getDate()+((8-d.getDay())%7 || 7));
    return localDate(d);
  }
  const escapeICS = text => String(text).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  function foldICS(line) {
    const encoder=new TextEncoder(); let out='',buf='',bytes=0;
    for(const c of line){const size=encoder.encode(c).length;if(bytes+size>75){out+=buf+'\r\n';buf=' ';bytes=1;}buf+=c;bytes+=size;}
    return out+buf;
  }
  function makeCalendar(plan,start,now=new Date()) {
    if (!validDate(start) || new Date(start+'T12:00:00').getDay()!==1) throw new Error('請選擇週一作為課表起日。');
    if (plan.stop || plan.noBaseline || !plan.weeklyTarget) throw new Error('目前沒有可匯出的跑步課表。');
    const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PacerIQ//Coach 2//ZH-TW','CALSCALE:GREGORIAN'];
    for(const d of plan.week){
      const date=new Date(start+'T12:00:00');date.setDate(date.getDate()+d.dayIndex);
      const day=localDate(date).replace(/-/g,'');date.setDate(date.getDate()+1);
      const desc=d.km ? `${d.km} km 上限，約 ${d.minutes} 分鐘（含暖身收操）；距離或時間先到即收操。${d.blocks.map(b=>b.title+' '+b.minutes+' 分：'+b.detail).join('；')} 每次出門前檢查身體狀態。` : '休息；肌力僅依當天恢復與無痛狀態自選。';
      lines.push('BEGIN:VEVENT',`UID:paceriq-${day}@local`, `DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${day}`,`DTEND;VALUE=DATE:${localDate(date).replace(/-/g,'')}`,`SUMMARY:${escapeICS('PacerIQ · '+d.title+(d.km?' '+d.km+'K':''))}`,`DESCRIPTION:${escapeICS(desc)}`,'END:VEVENT');
    }
    lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n';
  }
  return {DEFAULTS,GOALS,MODELS,RANGES,normalizeState,makePlan,readiness,formatPace,fuelAdvice,localDate,validDate,validateLog,summarizeLogs,nextMonday,makeCalendar};
});
