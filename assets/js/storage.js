(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.PacerEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.PacerStorage=api;})(globalThis,function(E){
  'use strict';
  const KEY='pacer-iq-v2',LEGACY='pacer-iq-coach-state',SCHEMA=2;
  function fresh(){return {schema:SCHEMA,profile:E.normalizeState({}),logs:[],updatedAt:null};}
  function validate(data,{strict=false}={}){
    if(!data || typeof data!=='object' || data.schema!==SCHEMA || !data.profile || typeof data.profile!=='object' || Array.isArray(data.profile) || !Array.isArray(data.logs))throw new Error('備份格式或版本不相容，未修改現有資料。');
    if(data.logs.length>2000)throw new Error('最多可匯入 2,000 筆紀錄。');
    const profile=E.normalizeState(data.profile);
    if(strict && Object.keys(E.DEFAULTS).some(k=>profile[k]!==data.profile[k]))throw new Error('備份中的設定無效，未修改現有資料。');
    const ids=new Set();
    const logs=data.logs.map((l,i)=>{const log=E.validateLog(l);log.id=log.id || `import-${i}`;if(ids.has(log.id))throw new Error('備份含重複紀錄 ID。');ids.add(log.id);return log;});
    return {schema:SCHEMA,profile,logs,updatedAt:typeof data.updatedAt==='string'?data.updatedAt:null};
  }
  function read(storage){
    try{
      const raw=storage.getItem(KEY);
      if(raw!==null)return {data:validate(JSON.parse(raw)),status:'loaded'};
      const old=storage.getItem(LEGACY);
      if(old){const parsed=JSON.parse(old);if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))throw new Error('Invalid legacy');return {data:{...fresh(),profile:E.normalizeState(parsed)},status:'migrated'};}
      return {data:fresh(),status:'new'};
    }catch(error){return {data:fresh(),status:'unavailable',error:'無法讀取儲存資料，已暫用示範參數；原資料未刪除。可用備份還原。'};}
  }
  function write(storage,data){
    try{const clean=validate(data);clean.updatedAt=new Date().toISOString();storage.setItem(KEY,JSON.stringify(clean));return {ok:true,data:clean};}
    catch(error){return {ok:false,error:'儲存失敗（儲存空間不足或瀏覽器限制）。目前資料仍在本頁，請立即匯出備份。'};}
  }
  function parseBackup(text){if(typeof text!=='string'||text.length>2*1024*1024)throw new Error('備份限 2 MB 以內。');return validate(JSON.parse(text),{strict:true});}
  return {KEY,SCHEMA,fresh,read,write,validate,parseBackup};
});
