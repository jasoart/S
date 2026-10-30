const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../assets/js/storage.js');
function memory(items={}){return {getItem:k=>items[k]??null,setItem:(k,v)=>items[k]=v,items};}
test('migrates original index.html profile without destroying legacy data',()=>{
  const store=memory({'pacer-iq-coach-state':JSON.stringify({currentKm:40,goal:'10k',model:'invalid',days:9})});
  const read=S.read(store);assert.equal(read.status,'migrated');assert.equal(read.data.profile.currentKm,40);assert.equal(read.data.profile.days,6);
  assert(S.write(store,read.data).ok);assert(store.items['pacer-iq-coach-state']);assert.equal(S.read(store).status,'loaded');
});
test('corrupt state and inaccessible storage do not crash or remove existing data',()=>{
  const store=memory({[S.KEY]:'{broken'});const read=S.read(store);assert.equal(read.status,'unavailable');assert.equal(store.items[S.KEY],'{broken');
  assert.equal(S.read({getItem(){throw new Error('denied');}}).status,'unavailable');
});
test('quota failure cannot pretend save succeeded',()=>{
  const result=S.write({setItem(){throw new Error('quota');}},S.fresh());assert.equal(result.ok,false);assert.match(result.error,/儲存失敗/);
});
test('backup round-trip and rejection are atomic at validation boundary',()=>{
  const data=S.fresh();data.logs=[{id:'one',date:'2026-01-01',km:5,minutes:30,rpe:4,note:'<img src=x onerror=alert(1)>'}];
  assert.deepEqual(S.parseBackup(JSON.stringify(data)).logs,data.logs);
  assert.throws(()=>S.parseBackup(JSON.stringify({...data,schema:99})));
  assert.throws(()=>S.parseBackup(JSON.stringify({...data,profile:{...data.profile,days:100}})));
  assert.throws(()=>S.parseBackup(JSON.stringify({...data,logs:[...data.logs,...data.logs]})));
  assert.throws(()=>S.parseBackup('x'.repeat(2*1024*1024+1)));
});
