const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs');
const profile={goal:'half',experience:'steady',model:'polarized',days:4,currentKm:28,longestKm:11,recent5kMin:28,known5k:false,age:36,weeks:10,sleep:8,soreness:0,stress:0,pain:0,route:'river',heat:false,night:true,emergency:false,illness:false,gaitPain:false,measuredHr:0,hrAffected:false};
async function range(page,id,value){await page.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
test('phone layout, research search, touch controls and axe accessibility',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');await expect(page.locator('#sourceCount')).toContainText('30 / 30');
  for(const width of [320,375,390,430,844]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:844});
  await page.locator('#sourceSearch').fill('Seiler');await expect(page.locator('.source-card')).toHaveCount(4);
  await page.locator('#sourceSearch').fill('');await page.locator('#sourceCategory').selectOption('iPhone');await expect(page.locator('.source-card')).toHaveCount(4);
  await page.locator('#sourceCategory').selectOption('all');
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(errors).toEqual([]);
});
test('pain, heat, day count, exact weekly totals and local persistence',async({page})=>{
  await page.goto('./');await range(page,'daysRange',2);
  const total=await page.locator('.day-card').evaluateAll(cards=>cards.reduce((sum,c)=>sum+Number(c.dataset.km),0));
  expect(Math.round(total*10)/10).toBe(Number(await page.locator('#weeklyMetric').innerText()));
  await expect(page.locator('.day-card[data-kind="hard"]')).toHaveCount(0);
  await range(page,'painRange',5);await expect(page.locator('#weeklyMetric')).toHaveText('0');await expect(page.locator('#calendarButton')).toBeDisabled();
  await expect(page.locator('#timerStart')).toBeDisabled();await expect(page.locator('#statusPill')).toContainText('暫停');
  await page.locator('#mobileSaveButton').click();await page.reload();await expect(page.locator('#painRange')).toHaveValue('5');
  await range(page,'painRange',0);await page.locator('#heatToggle').check();await expect(page.locator('.day-card[data-kind="hard"]')).toHaveCount(0);
  await page.locator('#emergencyToggle').check();await expect(page.locator('#weeklyMetric')).toHaveText('0');await expect(page.locator('#statusCopy')).toContainText('緊急醫療');
});
test('journal escapes notes, persists load, exports backup and validates restore',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});
  await page.goto('./');await page.locator('#logKm').fill('5');await page.locator('#logMinutes').fill('30');await page.locator('#logRpe').fill('4');
  await page.locator('#logNote').fill('<img src=x onerror=alert(1)>');await page.locator('#logForm button').click();
  await expect(page.locator('#logSummary')).toContainText('120 AU');await expect(page.locator('.log-note')).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('#logList img')).toHaveCount(0);
  await page.reload();await expect(page.locator('.log-entry')).toHaveCount(1);
  const download=page.waitForEvent('download');await page.locator('#backupButton').click();const file=await download;const json=JSON.parse(fs.readFileSync(await file.path(),'utf8'));expect(json.logs).toHaveLength(1);expect(json.schema).toBe(2);
  await page.locator('#restoreFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('#backupStatus')).toContainText('匯入失敗');await expect(page.locator('.log-entry')).toHaveCount(1);
  page.once('dialog',d=>d.accept());
  await page.locator('#restoreFile').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...json,profile:{...json.profile,currentKm:40}}))});
  await expect(page.locator('#currentKmRange')).toHaveValue('40');await expect(page.locator('.log-entry')).toHaveCount(1);
});
test('corrupt legacy and blocked storage stay usable and never report successful save',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('pacer-iq-coach-state','{broken');});await page.goto('./');await expect(page.locator('#saveState')).toContainText('無法讀取');await expect(page.locator('.day-card')).toHaveCount(7);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});
  page.once('dialog',d=>d.accept());await page.locator('#mobileSaveButton').click();await expect(page.locator('#saveState')).toContainText('儲存失敗');
});
test('calendar download is all-day and Monday checked',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});await page.goto('./');
  await page.locator('#weekStart').fill('2026-11-03');await page.locator('#calendarButton').click();await expect(page.locator('#calendarStatus')).toContainText('週一');
  await page.locator('#weekStart').fill('2026-11-02');const pending=page.waitForEvent('download');await page.locator('#calendarButton').click();const file=await pending;const content=fs.readFileSync(await file.path(),'utf8');expect(content).toContain('DTSTART;VALUE=DATE:20261102');expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(7);
});
test('optional measured heart rate supports typing without clearing partial numbers',async({page})=>{
  await page.goto('./');await page.locator('.advanced-settings summary').click();
  await page.locator('#measuredHrInput').pressSequentially('197');await expect(page.locator('#measuredHrInput')).toHaveValue('197');await page.locator('#measuredHrInput').blur();
  await expect(page.locator('#zoneSummary')).toContainText('實測最大心率 197');
  await page.locator('#hrAffectedToggle').check();await expect(page.locator('#zoneSummary')).toContainText('停用百分比');
});
test('foreground timer pauses on visibility change and resets when health state changes',async({page})=>{
  await page.goto('./');await page.locator('#timerStart').click();await expect(page.locator('#timerStart')).toHaveText('暫停');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#timerStatus')).toContainText('暫停');await expect(page.locator('#timerStart')).toHaveText('開始／繼續');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});});
  await range(page,'painRange',6);await expect(page.locator('#timerStart')).toBeDisabled();await expect(page.locator('#timerClock')).toHaveText('00:00');
});
test('subpath PWA installs, reloads offline, and saves diary offline',async({page,context})=>{
  await page.goto('./');await expect(page.locator('#connectionState')).toContainText('已備妥',{timeout:15000});await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await expect(page.locator('#sourceCount')).toContainText('30 / 30');
  await page.locator('#logKm').fill('3');await page.locator('#logMinutes').fill('22');await page.locator('#logRpe').fill('3');await page.locator('#logForm button').click();await expect(page.locator('#logSummary')).toContainText('66 AU');
  await page.reload();await expect(page.locator('.log-entry')).toHaveCount(1);await context.setOffline(false);
});
