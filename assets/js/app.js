(function(){
  'use strict';
  const E=window.PacerEngine,S=window.PacerStorage,sources=window.PacerEvidence;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(id,value)=>{$(id).textContent=value;};
  const ref=id=>`<a href="#source-${id}" class="source-ref" data-source="${id}">查看來源</a>`;
  let storage;
  try{storage=window.localStorage;}catch{storage={getItem(){throw new Error('Unavailable');},setItem(){throw new Error('Unavailable');}};}
  const loaded=S.read(storage);
  let data=loaded.data,plan,selectedDay=null,saveTimer,writeAllowed=loaded.status!=='unavailable',conflict=false;
  let logLimit=8;
  const controls={goal:'goalSelect',days:'daysRange',currentKm:'currentKmRange',longestKm:'longRunRange',recent5kMin:'fiveKRange',known5k:'known5kToggle',age:'ageRange',weeks:'weeksRange',sleep:'sleepRange',soreness:'sorenessRange',stress:'stressRange',pain:'painRange',route:'routeSelect',heat:'heatToggle',night:'nightToggle',emergency:'emergencyToggle',illness:'illnessToggle',gaitPain:'gaitPainToggle',measuredHr:'measuredHrInput',hrAffected:'hrAffectedToggle'};
  function persist(explicit=false){
    clearTimeout(saveTimer);
    if((!writeAllowed || conflict) && !explicit){text('saveState',conflict?'其他分頁已修改資料。請重新載入以取用新版，或先匯出本頁備份。':loaded.error);return false;}
    if((!writeAllowed || conflict) && !confirm('目前儲存資料無法同步讀取。要以本頁設定與日誌覆寫嗎？建議先匯出備份。'))return false;
    const result=S.write(storage,data);
    if(result.ok){data=result.data;writeAllowed=true;conflict=false;text('saveState','已儲存在此瀏覽器 · '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}));}
    else text('saveState',result.error);
    $('saveState').classList.toggle('save-error',!result.ok);
    return result.ok;
  }
  function scheduleSave(){clearTimeout(saveTimer);text('saveState','設定已變更，正在儲存…');saveTimer=setTimeout(()=>persist(),350);}
  function syncControls(){
    for(const [k,id] of Object.entries(controls)){
      const el=$(id);if(el.type==='checkbox')el.checked=data.profile[k];else el.value=k==='measuredHr'&&!data.profile[k]?'':data.profile[k];
    }
    for(const type of ['experience','model'])document.querySelectorAll(`[data-${type}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[type]===data.profile[type])));
    $('fiveKRange').disabled=!data.profile.known5k;
    $('measuredHrInput').disabled=data.profile.hrAffected;
  }
  function updateOutputs(){
    const s=data.profile;
    for(const [id,value] of Object.entries({daysValue:s.days+' 天',currentKmValue:s.currentKm+' km',longRunValue:s.longestKm+' km',fiveKValue:s.known5k?E.formatPace(s.recent5kMin*60):'未提供',ageValue:s.age+' 歲',weeksValue:s.weeks+' 週',sleepValue:s.sleep.toFixed(1)+' h',sorenessValue:s.soreness+' / 10',stressValue:s.stress+' / 10',painValue:s.pain+' / 10'}))text(id,value);
  }
  function change(){
    pauseTimer('參數已變更，請確認新課程後重新開始。');
    const next={...data.profile};
    for(const [k,id] of Object.entries(controls)){const el=$(id);next[k]=el.type==='checkbox'?el.checked:typeof E.DEFAULTS[k]==='number'?Number(el.value):el.value;}
    data.profile=E.normalizeState(next);syncControls();render();resetTimer();scheduleSave();
    text('profileNotice','目前顯示你設定的參數。恢復參考分數與課表是保守估算，不是醫療判斷；請確認每項資料都符合近況。');
  }
  function render(){
    plan=E.makePlan(data.profile);
    document.body.dataset.alert=plan.alert;
    text('statusPill',plan.stop?'暫停訓練':plan.noBaseline?'先建立跑量基準':plan.alert==='amber'?'保守降載 · 輕鬆為主':'依狀態持續累積');
    text('statusCopy',plan.reason);text('readinessMetric',plan.score);
    text('readinessNote','啟發式分數，非醫療評分');text('weeklyMetric',plan.weeklyTarget);
    text('progressionNote',plan.noBaseline?'尚無公里基準':`${plan.progression>=0?'+':''}${plan.progression}% 對照近期平均週量`);
    text('lowMetric',plan.totalMinutes?plan.low:'—');text('intensityNote',`預計 ${plan.qualityCount} 堂品質課 · 按時間估計`);
    text('longMetric',plan.longest);text('longNote',`每次均不超過 ${plan.sessionCap} km 的保守上限`);
    $('gaugeRing').style.setProperty('--score',plan.score);text('gaugeValue',plan.score);
    text('gaugeCaption','分數僅供整理睡眠、痠痛與壓力；警訊優先於分數，不代表受傷機率。');
    $('riskState').hidden=!plan.stop;text('riskState',plan.reason);
    const sessions=plan.week.filter(d=>d.km>0);
    if(!sessions.some(d=>d.dayIndex===selectedDay))selectedDay=plan.chosen.dayIndex;
    $('sessionSelect').innerHTML=sessions.length?sessions.map(d=>`<option value="${d.dayIndex}">${d.day} · ${esc(d.title)} · ${d.km} km</option>`).join(''):'<option value="">尚無跑步課程</option>';
    $('sessionSelect').value=String(selectedDay);$('sessionSelect').disabled=!sessions.length;
    renderSession();
    $('weekBoard').innerHTML=plan.week.map(d=>`<article class="day-card" data-kind="${d.kind}" data-km="${d.km}"><div><div class="day-card__top"><span class="day-card__day">${d.day}</span><span class="day-card__tag">${d.kind==='hard'?'品質':d.km?'輕鬆':'休息'}</span></div><h3>${d.title}</h3><p>${d.km?`總量 ${d.km} km，約 ${d.minutes} 分（含暖身與收操）；距離或時間先到就放慢收操。` : plan.stop||plan.noBaseline?esc(plan.reason):d.strength?'可選 15–25 分鐘無痛肌力：深蹲、髖鉸鏈、提踵與核心，先從熟悉動作開始。':'休息，觀察睡眠與跑後反應。'}</p></div><div class="day-card__metric">${d.km?d.km+'K':'—'}</div></article>`).join('');
    text('weekSummary',plan.noBaseline?'未建立基準，因此不自動開立跑步公里數。':`本週合計 ${plan.weeklyTarget} km · 約 ${plan.totalMinutes} 分鐘 · ${plan.qualityCount} 堂品質課。${plan.capacityLimited?'可跑天數與單次上限不足以容納原跑量，因此已降低週目標。':''}${plan.taper?'已採賽前減量；不補追距離。':''}`);
    $('calendarButton').disabled=plan.stop||plan.noBaseline||!plan.weeklyTarget;
    renderFuel();renderZones();renderRules();
    text('loadSummary',`偏好：${E.MODELS[data.profile.model]}。${plan.totalMinutes?`課表估算低強度 ${plan.low}%、中強度 ${plan.moderate}%、高強度 ${plan.hard}%。`:'尚無訓練時間。'}比例按課程分鐘估算，並非實測，也不強迫湊足 80/20。`);
    for(const [id,value,label] of [['lowBar',plan.low,'低'],['moderateBar',plan.moderate,'中'],['hardBar',plan.hard,'高']]){$(id).style.setProperty('--height',value+'%');$(id).textContent=label+'強度 '+value+'%';}
    text('dockStatus',plan.stop?'已暫停訓練':`下週 ${plan.weeklyTarget}K · ${plan.qualityCount} 堂品質`);updateOutputs();
  }
  function selectedSession(){return plan.week.find(d=>d.dayIndex===selectedDay) || plan.chosen;}
  function renderSession(){
    const d=selectedSession();text('sessionType',d.title);
    text('coachOutput',!d.km?plan.reason:`${d.day} · ${d.km} km 上限，約 ${d.minutes} 分鐘（已含暖身收操）。${d.kind==='hard'?`較快主段採 RPE ${data.profile.model==='pyramidal'?'5–6':'6–7'}，段間充分恢復。`:'能說完整句、RPE 2–4；不舒服就改走或停止。'}${plan.easyPace?'輕鬆配速粗估 '+E.formatPace(plan.easyPace)+'/km，以跑感校正。':data.profile.known5k?'熱濕或坡路不指定配速；時間依基本配速粗估，按跑感縮短，不為湊里程加速。':'尚無可靠配速基準，時間僅以 8:00/km 估算；依跑感縮短，不為湊里程加速。'}`);
    $('blockList').innerHTML=d.blocks.map(b=>`<article class="block-item"><div class="block-item__time">${b.minutes} 分</div><div><h3>${esc(b.title)}</h3><p>${esc(b.detail)}</p></div></article>`).join('');
    $('timerStart').disabled=!d.blocks.length;
  }
  function renderFuel(){
    text('fuelSummary',`本週最長課估計 ${plan.longMinutes} 分鐘；${!data.profile.known5k?'目前採 8:00/km 粗估時間，實際補給應依你真正的時間與強度調整。':'配速估值不是比賽預測。'}`);
    const cards=[['跑中碳水',E.fuelAdvice(plan.longMinutes),'carbs'],['補水與熱天',data.profile.heat?'選較涼時段與有遮蔭路線，安排水源；依個人汗量與口渴調整，避免過量飲水。':'補水按個人汗量、環境與口渴調整，避免為達固定水量而強喝。','fluid'],['能量與恢復','無法由本頁排除或診斷 REDs。若持續疲勞、月經改變、反覆骨壓力傷或刻意長期少吃，請找運動醫學及營養專業。','reds'],['夜跑與路況',data.profile.night?'穿反光裝備、帶照明，事先安排返程；不要低頭操作課程。':'路口先停止；坡路與停等多時按時間和跑感調整。','heat']];
    $('fuelList').innerHTML=cards.map(([title,copy,id],i)=>`<div class="fuel-card"><strong>${title}</strong><span>${esc(copy)} ${i<3?ref(id):''}</span></div>`).join('');
  }
  function renderZones(){
    text('zoneSummary',plan.maxHr?`${plan.estimatedHr?'年齡公式粗估':'你提供的實測'}最大心率 ${plan.maxHr} bpm。百分比分帶只是示意，不等於乳酸／通氣閾值，也不與下方三區時間比例直接對應。`:'心率受藥物或健康狀況影響：停用百分比數字，請按專業建議、談話測試與跑感調整。');
    const rows=[['輕鬆跑感','能說完整句，RPE 2–4；需要時改走。'],['品質主段','較吃力但可控制，RPE 6–7；恢復不足或有疼痛就取消。']];
    if(plan.maxHr)for(const [name,a,b] of [['HR 50–60%',.5,.6],['HR 60–70%',.6,.7],['HR 70–80%',.7,.8],['HR 80–90%',.8,.9],['HR 90–100%',.9,1]])rows.push([name,`${Math.round(plan.maxHr*a)}–${Math.round(plan.maxHr*b)} bpm（僅示意，不是必須達到的目標）`]);
    $('zoneTable').innerHTML=rows.map(([a,b])=>`<div class="zone-row"><strong>${a}</strong><span>${b}</span></div>`).join('')+`<p>${ref('hr')} · ${ref('talk')}</p>`;
  }
  function renderRules(){
    const rules=[
      ['進展規則',`新手與回鍋維持基準；穩定跑者最多加 3%，黃燈乘 0.8，紅燈為零。這些是可檢查的產品預設，不是驗證過的安全閾值。`,'iocload'],
      ['每次距離',`每次均以相同的近 30 天最長跑為基準，最多乘 1.05；目前上限 ${plan.sessionCap} km。同一週不連續複利加長。`,'spike'],
      ['品質與恢復',`本週實排 ${plan.qualityCount} 堂；有疼痛、熱濕、低恢復、新手、回鍋或兩天訓練時取消品質課。`,'munoz'],
      ['賽前兩週','倒數兩週／一週分別將基準量最多乘 0.8／0.6，不為賽事追趕跑量；這是簡化規則，須配合既有訓練史。','taper'],
      ['恢復參考公式','90 + (睡眠 − 7) × 6 − 痠痛 × 3 − 壓力 × 3 − 疼痛 × 9，限制在 0–100；警訊可直接停課，分數不提供醫療許可。','sleep'],
      ['肌力與休息','僅在恢復良好、無痛時提示週三／週五自選熟悉肌力。停止旗標生效時不排任何運動。','strength']
    ];
    $('rulesList').innerHTML=rules.map(([a,b,id])=>`<div class="rule"><strong>${a}</strong><span>${esc(b)} ${ref(id)}</span></div>`).join('');
  }
  // A foreground timer; visibility changes pause instead of promising iOS background execution.
  let running=false,stepIndex=0,remaining=0,lastTick=0,timerHandle=null,wake=null,wakeEpoch=0;
  function releaseWake(){wakeEpoch++;if(wake){wake.release().catch(()=>{});wake=null;}}
  async function acquireWake(){
    if(!running || !$('wakeToggle').checked)return;
    if(!navigator.wakeLock){text('timerStatus','此瀏覽器不支援保持亮屏；離開或鎖屏仍會暫停。');return;}
    const epoch=++wakeEpoch;
    try{const lock=await navigator.wakeLock.request('screen');if(!running||epoch!==wakeEpoch){await lock.release();return;}wake=lock;text('timerStatus','已要求保持亮屏；省電模式或系統仍可能解除。');lock.addEventListener('release',()=>{if(wake===lock)wake=null;});}
    catch{text('timerStatus','系統未允許保持亮屏，計時仍可在前景使用。');}
  }
  function displayTimer(){
    const d=selectedSession(),step=d.blocks[stepIndex];
    text('timerClock',E.formatPace(Math.max(1,Math.ceil(remaining))));if(remaining<=0)text('timerClock','00:00');
    text('timerPhase',step?`${stepIndex+1} / ${d.blocks.length} · ${step.title}`:'課程完成');
    $('timerStart').textContent=running?'暫停':stepIndex>=d.blocks.length&&d.blocks.length?'重新開始':'開始／繼續';
  }
  function tick(){
    if(!running)return;
    const now=performance.now();remaining-=(now-lastTick)/1000;lastTick=now;
    const blocks=selectedSession().blocks;
    while(remaining<=0 && stepIndex<blocks.length){stepIndex++;if(stepIndex<blocks.length)remaining+=blocks[stepIndex].minutes*60;}
    if(stepIndex>=blocks.length){remaining=0;running=false;clearInterval(timerHandle);releaseWake();text('timerStatus','課程計時結束。請在日誌記下實際時間與跑感。');}
    displayTimer();
  }
  function pauseTimer(message){if(running){tick();running=false;clearInterval(timerHandle);releaseWake();if(message)text('timerStatus',message);displayTimer();}}
  function resetTimer(){running=false;clearInterval(timerHandle);releaseWake();stepIndex=0;remaining=selectedSession().blocks[0]?.minutes*60||0;displayTimer();}
  $('timerStart').addEventListener('click',()=>{if(running){pauseTimer('已暫停。按開始／繼續後恢復。');return;}if(stepIndex>=selectedSession().blocks.length)resetTimer();if(!remaining)return;running=true;lastTick=performance.now();timerHandle=setInterval(tick,250);text('timerStatus','前景計時中；距離先到請自行停止並收操。');displayTimer();acquireWake();});
  $('timerReset').addEventListener('click',()=>{resetTimer();text('timerStatus','已重設。切換 App 或鎖屏會暫停。');});
  $('wakeToggle').addEventListener('change',()=>{$('wakeToggle').checked?acquireWake():releaseWake();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseTimer('已因切換 App 或鎖屏暫停；回來後按開始／繼續。');if(saveTimer)persist();}});
  window.addEventListener('pagehide',()=>{pauseTimer();if(saveTimer)persist();});
  $('sessionSelect').addEventListener('change',()=>{pauseTimer();selectedDay=Number($('sessionSelect').value);renderSession();resetTimer();});
  for(const id of Object.values(controls)){const el=$(id);el.addEventListener(el.type==='checkbox'||el.type==='number'||el.tagName==='SELECT'?'change':'input',change);}
  for(const type of ['experience','model'])document.querySelectorAll(`[data-${type}]`).forEach(b=>b.addEventListener('click',()=>{data.profile[type]=b.dataset[type];change();}));
  for(const id of ['saveButton','mobileSaveButton','syncButton'])$(id).addEventListener('click',()=>persist(true));
  for(const id of ['rebuildButton','mobileRebuildButton'])$(id).addEventListener('click',()=>{change();if(id==='mobileRebuildButton')$('weekly').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  function renderLogs(){
    const stats=E.summarizeLogs(data.logs);
    text('logSummary',data.logs.length?`近 7 天 ${stats.current.count} 筆 · ${stats.current.km} km · ${stats.current.load} AU；前 7 天 ${stats.previous.count} 筆 · ${stats.previous.km} km · ${stats.previous.load} AU。`:'還沒有紀錄。完成一次訓練後，從距離、時間與跑感開始。');
    const sorted=[...data.logs].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
    $('logList').innerHTML=sorted.slice(0,logLimit).map(l=>`<article class="log-entry"><div><strong>${l.date} · ${l.km} km</strong><p>${l.minutes} 分 · RPE ${l.rpe} · ${Math.round(l.minutes*l.rpe)} AU</p><p class="log-note">${esc(l.note)}</p></div><button class="button-secondary" type="button" data-delete="${esc(l.id)}" aria-label="刪除 ${l.date} ${l.km} 公里紀錄">刪除</button></article>`).join('');
    $('moreLogs').hidden=sorted.length<=logLimit;
  }
  $('logForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{if(data.logs.length>=2000)throw new Error('已達 2,000 筆，請先備份並整理紀錄。');
      const log=E.validateLog({id:crypto.randomUUID?crypto.randomUUID():`log-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,date:$('logDate').value,km:Number($('logKm').value),minutes:Number($('logMinutes').value),rpe:Number($('logRpe').value),note:$('logNote').value});
      data.logs.push(log);renderLogs();const ok=persist();text('logStatus',ok?'已新增並儲存紀錄。':'紀錄已加入本頁，但未成功儲存；請匯出備份。');$('logForm').reset();$('logDate').value=E.localDate();
    }catch(err){text('logStatus',err.message);}
  });
  $('logList').addEventListener('click',event=>{const b=event.target.closest('[data-delete]');if(!b)return;const log=data.logs.find(l=>l.id===b.dataset.delete);if(log&&confirm(`刪除 ${log.date}、${log.km} km 這一筆紀錄？`)){data.logs=data.logs.filter(l=>l.id!==log.id);renderLogs();persist();text('logStatus','已刪除紀錄。');}});
  $('moreLogs').addEventListener('click',()=>{logLimit+=20;renderLogs();});
  function renderSources(){
    const term=$('sourceSearch').value.trim().toLocaleLowerCase(),category=$('sourceCategory').value;
    const filtered=sources.filter(s=>(category==='all'||s.category===category)&&[s.authors,s.title,s.takeaway,s.application,s.category].join(' ').toLocaleLowerCase().includes(term));
    text('sourceCount',`顯示 ${filtered.length} / ${sources.length} 份來源 · 查核日期 2026-10-30`);
    $('sourceList').innerHTML=filtered.map(s=>`<article class="source-card" id="source-${s.id}"><p class="source-meta">${esc(s.category)} · ${esc(s.type)}${s.year?' · '+s.year:''}</p><h3>${esc(s.authors)}</h3><p class="source-title"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></p><p>${esc(s.takeaway)}</p><details><summary>如何用在這個系統</summary><p>${esc(s.application)}</p></details></article>`).join('') || '<p>找不到符合的來源，請換個關鍵字。</p>';
  }
  $('sourceCategory').insertAdjacentHTML('beforeend',[...new Set(sources.map(s=>s.category))].map(c=>`<option value="${c}">${c}</option>`).join(''));
  $('sourceSearch').addEventListener('input',renderSources);$('sourceCategory').addEventListener('change',renderSources);
  document.addEventListener('click',event=>{const link=event.target.closest('[data-source]');if(link){event.preventDefault();$('sourceSearch').value='';$('sourceCategory').value='all';renderSources();const card=$('source-'+link.dataset.source);card.scrollIntoView({block:'start'});card.tabIndex=-1;card.focus({preventScroll:true});}});
  // Explicit export actions use the iOS share sheet when supported, then a download fallback.
  const objectURLs=[];
  async function exportFile(content,name,type,statusId){
    const file=new File([content],name,{type});
    try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'PacerIQ '+name});text(statusId,'已交由系統分享選單處理。');return;}}
    catch(err){if(err.name==='AbortError'){text(statusId,'已取消分享，資料未變更。');return;}}
    const url=URL.createObjectURL(file);objectURLs.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.textContent='若未開始下載，點此開啟／另存檔案';a.rel='noopener';
    $(statusId).replaceChildren(document.createTextNode('已建立 '+name+'。'),a);a.click();
  }
  window.addEventListener('unload',()=>objectURLs.forEach(url=>URL.revokeObjectURL(url)));
  $('backupButton').addEventListener('click',()=>exportFile(JSON.stringify({...data,updatedAt:new Date().toISOString()},null,2),'paceriq-backup-'+E.localDate()+'.json','application/json','backupStatus'));
  $('restoreButton').addEventListener('click',()=>$('restoreFile').click());
  $('restoreFile').addEventListener('change',async()=>{
    const file=$('restoreFile').files[0];if(!file)return;
    try{if(file.size>2*1024*1024)throw new Error('備份限 2 MB 以內。');const incoming=S.parseBackup(await file.text());
      if(!confirm(`匯入 ${incoming.logs.length} 筆紀錄與設定，將替換本頁的 ${data.logs.length} 筆紀錄與設定。確定繼續？`)){text('backupStatus','已取消，資料未修改。');return;}
      const result=S.write(storage,incoming);if(!result.ok)throw new Error(result.error+' 未替換目前資料。');
      clearTimeout(saveTimer);pauseTimer();data=result.data;writeAllowed=true;conflict=false;syncControls();render();resetTimer();renderLogs();text('backupStatus',`已還原 ${data.logs.length} 筆紀錄與設定。`);text('profileNotice','已載入備份參數；請先確認今天的健康與恢復狀態。');text('saveState','備份已還原並儲存。');
    }catch(err){text('backupStatus','匯入失敗：'+err.message);}finally{$('restoreFile').value='';}
  });
  $('calendarButton').addEventListener('click',()=>{try{exportFile(E.makeCalendar(plan,$('weekStart').value),'paceriq-'+$('weekStart').value+'.ics','text/calendar','calendarStatus');}catch(err){text('calendarStatus',err.message);}});
  $('sharePlanButton').addEventListener('click',async()=>{
    const body=`PacerIQ 本週建議 · ${plan.weeklyTarget} km\n${plan.reason}\n`+plan.week.map(d=>`${d.day} ${d.title}${d.km?' '+d.km+' km / 約 '+d.minutes+' 分':''}`).join('\n')+'\n保守估算；每次訓練前重新評估。';
    if(navigator.share){try{await navigator.share({title:'PacerIQ 週課表',text:body});text('calendarStatus','已交由系統分享。');return;}catch(err){if(err.name==='AbortError'){text('calendarStatus','已取消分享。');return;}}}
    await exportFile(body,'paceriq-plan.txt','text/plain','calendarStatus');
  });
  $('sweatForm').addEventListener('submit',event=>{
    event.preventDefault();const before=Number($('weightBefore').value),after=Number($('weightAfter').value),drunk=Number($('waterDrunk').value)/1000,urine=Number($('urine').value)/1000,hours=Number($('sweatMinutes').value)/60;
    const loss=before-after+drunk-urine,rate=loss/hours;
    if(!Number.isFinite(rate)||loss<0||rate>4){text('sweatResult','數據不合理或量測誤差較大，請重新確認體重、飲水、尿量與時間。');return;}
    text('sweatResult',`估計汗率 ${rate.toFixed(2)} L/h＝（跑前 − 跑後 kg ＋ 飲水 L − 排尿 L）÷ 小時。這不是必須補足的飲水目標；避免過量飲水。${after>before?'跑後體重增加，請注意可能喝得過多並重查量測條件。':''}`);
  });
  $('persistButton').addEventListener('click',async()=>{try{if(!navigator.storage?.persist){text('persistStatus','此瀏覽器未提供持久儲存申請，請定期匯出備份。');return;}const ok=await navigator.storage.persist();text('persistStatus',ok?'已取得持久儲存，但清除網站資料仍會刪除內容；請定期備份。':'瀏覽器未授予持久儲存；加入主畫面後仍請定期備份。');}catch{text('persistStatus','無法取得持久儲存；請使用備份功能。');}});
  window.addEventListener('storage',event=>{if(event.key===S.KEY){conflict=true;pauseTimer('其他分頁已修改資料，請先確認設定。');text('saveState','其他分頁已更新資料；已暫停自動儲存。請重新載入，或匯出本頁備份。');}});
  let swRegistration,offlineReady=false;
  function connectionStatus(){text('connectionState',!navigator.onLine?(offlineReady?'目前離線 · 本機計算與紀錄可用':'目前離線 · 離線檔案狀態尚未確認'):offlineReady?'離線檔案已備妥 · 外部來源連結仍需網路':'線上 · 正在準備離線檔案');}
  for(const event of ['online','offline'])window.addEventListener(event,connectionStatus);
  async function setupOffline(){
    if(!('serviceWorker' in navigator)||!window.isSecureContext||location.protocol==='file:'){text('connectionState','本機計算可用；離線安裝需以 HTTPS 或 localhost 開啟。');return;}
    try{
      swRegistration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
      const watch=()=>{if(swRegistration.waiting&&navigator.serviceWorker.controller)$('updateButton').hidden=false;};watch();
      swRegistration.addEventListener('updatefound',()=>{const worker=swRegistration.installing;worker?.addEventListener('statechange',()=>{watch();if(worker.state==='redundant'&&!swRegistration.active)text('connectionState','離線檔案準備失敗，請保持連線後重新開啟。');});});
      navigator.serviceWorker.ready.then(()=>{offlineReady=true;connectionStatus();});
      let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;location.reload();});
    }catch{text('connectionState','離線功能未啟用；本頁仍可運算。請連線後重試。');}
  }
  $('updateButton').addEventListener('click',()=>{if(!persist(true))return;pauseTimer();swRegistration?.waiting?.postMessage({type:'SKIP_WAITING'});});
  $('weekStart').value=E.nextMonday();$('logDate').value=E.localDate();$('logDate').max=E.localDate();
  text('installState',matchMedia('(display-mode: standalone)').matches||navigator.standalone?'目前以主畫面 App 模式開啟。':'目前以瀏覽器模式開啟；可使用分享選單加入主畫面。');
  syncControls();render();resetTimer();renderLogs();renderSources();
  text('saveState',loaded.status==='loaded'?'已載入本機設定與日誌。':loaded.status==='migrated'?'已讀取舊版設定，下一次儲存會使用新版格式。':loaded.error||'目前使用示範參數；調整前請先確認自己的近況。');
  if(loaded.status==='loaded'||loaded.status==='migrated')text('profileNotice','已載入本機參數，請重新確認今天的睡眠、疼痛與警訊。');
  setupOffline();
})();
