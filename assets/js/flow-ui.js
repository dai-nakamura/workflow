(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/\s+/g,'').trim();
const today=()=>{const d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}-${m}-${dd}`};
const state={orderQ:'',orderRange:'all',resQ:'',resRange:'active',resCat:'all',pickerType:'product',pickerTarget:null,lastAggregate:null};

function isDoneStatus(s){
  const x=norm(s);
  if(!x)return false;
  return x.includes('納品済')||x.includes('納品完了')||x.includes('完成済')||x==='完成'||
         x.includes('完了済')||x==='完了'||x.includes('処理済')||x.includes('対応済')||
         x.includes('キャンセル')||x.includes('取消')||x.includes('中止');
}
function isDoneReservation(o){
  if(!o)return false;
  if(o.isProductionTarget===false)return true;
  return [o.status,o.productionStatus,o.state,o.progressStatus,o.workflowStatus]
    .some(isDoneStatus);
}
function armDestructiveButton(btn,armedText,normalText,onConfirm){
  if(!btn)return;
  if(btn.dataset.v11Armed==='1'){
    clearTimeout(Number(btn.dataset.v11Timer)||0);
    btn.dataset.v11Armed='0';
    btn.classList.remove('v11-armed');
    btn.textContent=normalText;
    onConfirm();
    return;
  }
  btn.dataset.v11Armed='1';
  btn.classList.add('v11-armed');
  btn.textContent=armedText;
  const timer=setTimeout(()=>{
    btn.dataset.v11Armed='0';
    btn.classList.remove('v11-armed');
    btn.textContent=normalText;
  },4500);
  btn.dataset.v11Timer=String(timer);
}
function persist(){if(typeof persistDb==='function')persistDb()}
function show(el,on){if(el)el.classList.toggle('is-hidden',!on)}
function openSheet(id){$(id)?.classList.add('is-open');$(id)?.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeSheet(id){$(id)?.classList.remove('is-open');$(id)?.setAttribute('aria-hidden','true');document.body.style.overflow=''}

function orderKey(o){
  return [o.date,o.customer||o.clientName,o.venue,o.category,o.notes||o.orderNotes].map(norm).join('|');
}
function itemKey(i, canonicalOrderId){
  return [canonicalOrderId,i.productName||i.name,i.quantity,i.unit,i.category||i.type,i.size,i.squareSize,i.multiSize,
          Array.isArray(i.options)?i.options.join(','):i.options,i.notes].map(norm).join('|');
}
function mergeNonEmpty(base, incoming){
  const out={...base};
  Object.keys(incoming||{}).forEach(k=>{
    const v=incoming[k];
    if(v!==undefined&&v!==null&&v!==''&&!(Array.isArray(v)&&!v.length))out[k]=v;
  });
  return out;
}

/* 予約DBを実際に掃除する。旧mergeByIdが同じIDを別IDへ複製していたため、その既存重複も統合する。 */
function cleanupReservations(){
  if(!Array.isArray(db.reservationOrders))db.reservationOrders=[];
  if(!Array.isArray(db.reservationOrderItems))db.reservationOrderItems=[];
  const beforeOrders=db.reservationOrders.length,beforeItems=db.reservationOrderItems.length;
  const active=db.reservationOrders.filter(o=>!isDoneReservation(o));
  const keyMap=new Map(), idMap=new Map(), kept=[];
  active.forEach(o=>{
    const k=orderKey(o);
    let c=keyMap.get(k);
    if(!c){
      c={...o};
      keyMap.set(k,c); kept.push(c);
      idMap.set(o.id,c.id);
    }else{
      idMap.set(o.id,c.id);
      const prod=c.productionStatus==='製造バッチ化済み'||o.productionStatus==='製造バッチ化済み'?'製造バッチ化済み':(c.productionStatus||o.productionStatus||'未送信');
      Object.assign(c,mergeNonEmpty(c,o),{id:c.id,productionStatus:prod});
    }
  });
  kept.forEach(o=>idMap.set(o.id,o.id));
  const itemMap=new Map(), items=[];
  db.reservationOrderItems.forEach(i=>{
    const oid=idMap.get(i.orderId);
    if(!oid)return;
    const rec={...i,orderId:oid};
    const k=itemKey(rec,oid);
    const old=itemMap.get(k);
    if(!old){
      itemMap.set(k,rec);items.push(rec);
    }else{
      // 紐付け済み情報を優先して残す
      if(!old.productId&&rec.productId)old.productId=rec.productId;
      if(!old.recipeId&&rec.recipeId)old.recipeId=rec.recipeId;
      Object.assign(old,mergeNonEmpty(old,rec),{id:old.id,orderId:oid});
    }
  });
  db.reservationOrders=kept;
  db.reservationOrderItems=items;
  persist();
  return {removedOrders:beforeOrders-kept.length,removedItems:beforeItems-items.length,orders:kept.length,items:items.length};
}

function convertInput(parsed){
  let rawOrders=[],payload;
  if(Array.isArray(parsed)){
    rawOrders=parsed;
    const active=rawOrders.filter(o=>!isDoneReservation(o));
    payload=typeof convertReservationAppOrdersToPayload==='function'
      ? convertReservationAppOrdersToPayload(active)
      : {orders:active,orderItems:[]};
    return {payload,excluded:rawOrders.length-active.length,total:rawOrders.length};
  }
  if(parsed&&Array.isArray(parsed.orders)&&Array.isArray(parsed.orderItems)){
    const all=parsed.orders,active=all.filter(o=>!isDoneReservation(o)),ids=new Set(active.map(o=>o.id));
    payload={orders:active,orderItems:parsed.orderItems.filter(i=>ids.has(i.orderId))};
    return {payload,excluded:all.length-active.length,total:all.length};
  }
  if(parsed&&Array.isArray(parsed.orders)){
    rawOrders=parsed.orders;
    const active=rawOrders.filter(o=>!isDoneReservation(o));
    payload=typeof convertReservationAppOrdersToPayload==='function'
      ? convertReservationAppOrdersToPayload(active)
      : {orders:active,orderItems:[]};
    return {payload,excluded:rawOrders.length-active.length,total:rawOrders.length};
  }
  throw new Error('予約JSONの形式を判定できません。');
}

function mergeReservationPayload(payload){
  cleanupReservations();
  const incomingOrders=payload.orders||[], incomingItems=payload.orderItems||[];
  const incomingDone=(payload._doneOrders||[]);
  const existingById=new Map(db.reservationOrders.map(o=>[o.id,o]));
  const existingByKey=new Map(db.reservationOrders.map(o=>[orderKey(o),o]));
  const incomingToCanonical=new Map();
  let added=0,updated=0;

  incomingOrders.forEach(o=>{
    if(isDoneReservation(o))return;
    let cur=existingById.get(o.id)||existingByKey.get(orderKey(o));
    if(cur){
      const keepProd=cur.productionStatus||'未送信';
      Object.assign(cur,mergeNonEmpty(cur,o),{id:cur.id,productionStatus:keepProd});
      incomingToCanonical.set(o.id,cur.id);updated++;
    }else{
      const rec={...o,productionStatus:o.productionStatus||'未送信'};
      db.reservationOrders.push(rec);
      existingById.set(rec.id,rec);existingByKey.set(orderKey(rec),rec);
      incomingToCanonical.set(o.id,rec.id);added++;
    }
  });

  const existingItemMap=new Map(db.reservationOrderItems.map(i=>[itemKey(i,i.orderId),i]));
  incomingItems.forEach(i=>{
    const oid=incomingToCanonical.get(i.orderId)||i.orderId;
    if(!db.reservationOrders.some(o=>o.id===oid))return;
    const rec={...i,orderId:oid};
    const k=itemKey(rec,oid),cur=existingItemMap.get(k);
    if(cur){
      // 既存の手動紐付けはJSON再取込で消さない
      const productId=cur.productId||rec.productId||'';
      const recipeId=cur.recipeId||rec.recipeId||'';
      Object.assign(cur,mergeNonEmpty(cur,rec),{id:cur.id,orderId:oid,productId,recipeId});
    }else{
      if(db.reservationOrderItems.some(x=>x.id===rec.id)&&typeof createId==='function')rec.id=createId('resitem');
      db.reservationOrderItems.push(rec);existingItemMap.set(k,rec);
    }
  });
  const cleaned=cleanupReservations();
  return {added,updated,...cleaned};
}

function replaceReservationPayload(payload){
  db.reservationOrders=(payload.orders||[]).filter(o=>!isDoneReservation(o)).map(o=>({...o,productionStatus:o.productionStatus||'未送信'}));
  const ids=new Set(db.reservationOrders.map(o=>o.id));
  db.reservationOrderItems=(payload.orderItems||[]).filter(i=>ids.has(i.orderId)).map(i=>({...i}));
  return cleanupReservations();
}

function setImportStatus(text,type='ok'){
  let el=$('reservationImportStatusV10');
  if(!el){
    el=document.createElement('div');el.id='reservationImportStatusV10';el.className='v10-import-status';
    $('reservationImportCardV9')?.appendChild(el);
  }
  el.className=`v10-import-status ${type}`;el.textContent=text;
}
function doImport(mode){
  const text=$('reservationJsonArea')?.value.trim();
  if(!text){alert('予約JSONを貼り付けてください。');return}
  try{
    const parsed=JSON.parse(text);
    // 完了データは変換前から捨てる
    const x=convertInput(parsed);
    let r;
    if(mode==='replace'){
      r=replaceReservationPayload(x.payload);
    }else{
      r=mergeReservationPayload(x.payload);
    }
    renderReservationsV10();
    setImportStatus(`読込完了：対象 ${x.payload.orders.length}件 / 完了・キャンセル除外 ${x.excluded}件 / 現在 ${db.reservationOrders.length}件`);
    alert(`予約JSONを読み込みました。\n完了・キャンセル除外：${x.excluded}件\n現在の予約：${db.reservationOrders.length}件`);
  }catch(err){console.error(err);setImportStatus('読込失敗：'+(err.message||err),'warn');alert('予約JSONを読み込めませんでした。\n'+(err.message||err))}
}

/* 受注 */
function orderVisible(o){
  const q=norm(state.orderQ);
  if(q&&!norm(`${o.productName||''} ${o.customer||''} ${o.memo||''}`).includes(q))return false;
  if(state.orderRange==='upcoming'&&String(o.date||'')<today())return false;
  if(state.orderRange==='today'&&String(o.date||'')!==today())return false;
  return true;
}
function renderOrdersV10(){
  if(!$('orderList'))return;
  const all=db.orderItems||[],list=all.filter(orderVisible).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  if($('orderCountBadge'))$('orderCountBadge').textContent=`${list.length}件`;
  if($('orderResultV9'))$('orderResultV9').textContent=`表示 ${list.length}件 / 全${all.length}件`;
  $('orderList').innerHTML=list.length?list.map(o=>`<article class="v9-row" data-v10-order="${esc(o.id)}" tabindex="0"><div><div class="v9-row-title">${esc(o.productName||'商品名未設定')} × ${esc(o.quantity??0)}${esc(o.unit||'')}</div><div class="v9-row-meta">${esc(o.date||'-')}${o.customer?' / '+esc(o.customer):''}</div>${o.memo?`<div class="v9-row-sub">${esc(o.memo)}</div>`:''}</div><button class="v9-delete" data-v10-order-delete="${esc(o.id)}" type="button">削除</button></article>`).join(''):'<div class="empty-box">条件に合う受注がありません。</div>';
}
function openOrder(o){
  show($('orderEditorCardV9'),true);
  if(o){
    appState.currentOrderId=o.id;$('orderDate').value=o.date||today();$('orderProductSelect').value=o.productId||'';
    $('orderQuantity').value=o.quantity??1;$('orderUnit').value=o.unit||'';$('orderCustomer').value=o.customer||'';$('orderMemo').value=o.memo||'';
  }else if(typeof resetOrderEditor==='function')resetOrderEditor();
  $('orderEditorCardV9')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function deleteOrderV10(id){
  const o=(db.orderItems||[]).find(x=>x.id===id);if(!o)return;
  db.orderItems=db.orderItems.filter(x=>x.id!==id);
  if(appState.currentOrderId===id&&typeof resetOrderEditor==='function')resetOrderEditor();
  appState.aggregateResult={recipeTotals:[],taskTotals:[],materialTotals:[],unmatchedItems:[]};
  state.lastAggregate=null;persist();renderOrdersV10();renderAggregateV10();
}

/* 予約表示 */
function resItems(id){return (db.reservationOrderItems||[]).filter(i=>i.orderId===id)}
function resVisible(o){
  if(isDoneReservation(o))return false;
  if(state.resRange==='unsent'&&(o.productionStatus||'未送信')!=='未送信')return false;
  if(state.resRange==='active'&&o.productionStatus==='製造バッチ化済み')return false;
  if(state.resCat!=='all'&&o.category!==state.resCat)return false;
  const q=norm(state.resQ);
  if(q&&!norm(`${o.customer||''} ${o.venue||''} ${o.category||''} ${o.notes||''} ${resItems(o.id).map(i=>i.productName||'').join(' ')}`).includes(q))return false;
  return true;
}
function mappingLabel(i){return i.productId?'商品':i.recipeId?'レシピ':'未紐付け'}
function renderReservationsV10(){
  if(!$('reservationList'))return;
  const all=(db.reservationOrders||[]).filter(o=>!isDoneReservation(o));
  const list=all.filter(resVisible).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  if($('reservationCountBadge'))$('reservationCountBadge').textContent=`${list.length}件`;
  if($('reservationResultV9'))$('reservationResultV9').textContent=`表示 ${list.length}件 / 保持 ${all.length}件`;
  $('reservationList').innerHTML=list.length?list.map(o=>{
    const items=resItems(o.id),u=items.filter(i=>!i.productId&&!i.recipeId).length;
    const summary=items.slice(0,2).map(i=>i.productName||'商品名未設定').join('・')+(items.length>2?` 他${items.length-2}件`:'');
    return `<article class="v9-row" data-v10-res="${esc(o.id)}" tabindex="0"><div><div class="v9-row-title">${esc(o.customer||'名称未設定')}</div><div class="v9-row-meta">${esc(o.date||'-')}${o.venue?' / '+esc(o.venue):''}${o.category?' / '+esc(o.category):''}</div><div class="v9-row-sub">${esc(summary||'商品なし')}</div></div><span class="v9-row-badge ${u?'warn':''}">${u?`未紐付 ${u}`:(o.productionStatus==='製造バッチ化済み'?'送信済':'確認')}</span></article>`;
  }).join(''):'<div class="empty-box">条件に合う予約がありません。</div>';
}
function reservationDetail(id){
  const o=(db.reservationOrders||[]).find(x=>x.id===id);if(!o)return;
  const items=resItems(id);
  $('reservationDetailTitleV9').textContent=o.customer||'予約詳細';
  $('reservationDetailBodyV9').innerHTML=`<div class="v9-detail-block"><div class="v9-detail-grid"><b>日付</b><span>${esc(o.date||'-')}</span><b>区分</b><span>${esc(o.category||'-')}</span><b>会場</b><span>${esc(o.venue||'-')}</span><b>状態</b><span>${esc(o.status||'-')} / ${esc(o.productionStatus||'未送信')}</span><b>メモ</b><span>${esc(o.notes||'-')}</span></div></div><div class="v9-detail-block"><strong>内容 ${items.length}件</strong>${items.map(i=>`<div class="v9-item-line"><div><b>${esc(i.productName||'商品名未設定')}</b><div class="v9-row-sub">${esc(i.quantity||1)}${esc(i.unit||'点')}${i.size?' / '+esc(i.size):''} / ${mappingLabel(i)}</div></div><button type="button" class="v9-link-btn" data-v10-pick-res="${esc(i.id)}">${i.productId||i.recipeId?'変更':'紐付け'}</button></div>`).join('')}</div>${o.productionStatus==='製造バッチ化済み'?'':`<button class="btn btn-primary" style="width:100%" data-v10-send-res="${esc(o.id)}" type="button">製造へ送る</button>`}`;
  openSheet('reservationDetailV9');
}

/* 共通マスターピッカー */
function openPicker(target,type='product'){
  state.pickerTarget=target;state.pickerType=type;
  if($('masterPickerSearchV9'))$('masterPickerSearchV9').value='';
  document.querySelectorAll('[data-picker-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.pickerType===type));
  renderPicker();openSheet('masterPickerV9');
}
function renderPicker(){
  const q=norm($('masterPickerSearchV9')?.value||'');
  const list=(state.pickerType==='recipe'?db.recipeMasters:db.productMasters)||[];
  $('masterPickerTitleV9').textContent=state.pickerType==='recipe'?'レシピから選択':'商品から選択';
  $('masterPickerResultsV9').innerHTML=list.filter(m=>!q||norm(`${m.name||''} ${m.category||''} ${m.type||''}`).includes(q)).slice(0,150).map(m=>`<button class="v9-master-row" type="button" data-v10-master="${esc(m.id)}"><strong>${esc(m.name||'名称未設定')}</strong><small>${esc(state.pickerType==='recipe'?(m.type||'レシピ'):(m.category||'商品'))}</small></button>`).join('')||'<div class="empty-box">該当なし</div>';
}
function applyPicker(id){
  const t=state.pickerTarget;if(!t)return;
  if(t.kind==='order'){
    const o=(db.orderItems||[]).find(x=>x.id===t.id);if(!o)return;
    if(state.pickerType==='product'){o.productId=id;delete o.recipeId;const p=(db.productMasters||[]).find(x=>x.id===id);if(p)o.productName=p.name}
    else{o.recipeId=id;o.productId='';const r=(db.recipeMasters||[]).find(x=>x.id===id);if(r&&!o.productName)o.productName=r.name}
    persist();runAggregateV10();renderOrdersV10();
  }else if(t.kind==='reservation'){
    const i=(db.reservationOrderItems||[]).find(x=>x.id===t.id);if(!i)return;
    if(state.pickerType==='product'){i.productId=id;delete i.recipeId}else{i.recipeId=id;i.productId=''}
    persist();renderReservationsV10();reservationDetail(i.orderId);
  }
  closeSheet('masterPickerV9');
}

/* 集計。日付別に分け、商品またはレシピ直結の両方を扱う。 */
function sizeScale(recipe,component){
  try{
    if(typeof calcShapeVolumeScale==='function')return Number(calcShapeVolumeScale(recipe.baseSize||{},component.size||{}))||1;
    if(typeof calcSizeScale==='function')return Number(calcSizeScale(recipe.baseSize||{},component.size||{}))||1;
  }catch(e){}
  return 1;
}
function computeAggregate(){
  const recipeMap=new Map(),taskMap=new Map(),materialMap=new Map(),unmatched=[];
  const addRecipe=(rid,qty,unit,date,order)=>{
    const r=(db.recipeMasters||[]).find(x=>x.id===rid);if(!r)return false;
    const k=`${rid}|${date||''}`,cur=recipeMap.get(k)||{recipeId:rid,recipeName:r.name,requiredQuantity:0,requiredUnit:unit||r.yieldUnit||'',yieldQuantity:Number(r.yieldQuantity||0),yieldUnit:r.yieldUnit||'',eventDate:date||'',sourceOrders:[]};
    cur.requiredQuantity+=Number(qty||0);cur.requiredScale=cur.yieldQuantity>0?(typeof ceil2==='function'?ceil2(cur.requiredQuantity/cur.yieldQuantity):Math.ceil(cur.requiredQuantity/cur.yieldQuantity*100)/100):0;
    if(order)cur.sourceOrders.push({orderId:order.id,customer:order.customer||'',date:order.date||'',productName:order.productName||''});
    recipeMap.set(k,cur);return true;
  };
  const addTask=(id,qty,unit,date,order)=>{const t=(db.taskMasters||[]).find(x=>x.id===id);if(!t)return;const k=`${id}|${date||''}`,c=taskMap.get(k)||{taskId:id,taskName:t.name,requiredCount:0,unit:unit||'回',defaultDurationMinutes:t.defaultDurationMinutes||0,equipment:t.equipment||'',eventDate:date||'',sourceOrders:[]};c.requiredCount+=Number(qty||0);if(order)c.sourceOrders.push({orderId:order.id,customer:order.customer||'',date:order.date||'',productName:order.productName||''});taskMap.set(k,c)};
  const addMat=(id,qty,unit,date)=>{const m=(db.materialsMaster||[]).find(x=>x.id===id);if(!m)return;const k=`${id}|${date||''}`,c=materialMap.get(k)||{materialId:id,materialName:m.name,requiredQuantity:0,unit:unit||m.baseUnit||'',eventDate:date||''};c.requiredQuantity+=Number(qty||0);materialMap.set(k,c)};
  const expandProduct=(pid,mult,date,order,seen=new Set())=>{
    if(seen.has(pid))return;seen.add(pid);
    const p=(db.productMasters||[]).find(x=>x.id===pid);if(!p)return;
    (p.components||[]).forEach(c=>{const q=Number(c.quantity||0)*Number(mult||0);
      if(c.sourceType==='recipe'){const r=(db.recipeMasters||[]).find(x=>x.id===c.refId);if(r)addRecipe(c.refId,q*sizeScale(r,c),c.unit,date,order)}
      else if(c.sourceType==='material')addMat(c.refId,q,c.unit,date);
      else if(c.sourceType==='task')addTask(c.refId,q,c.unit,date,order);
      else if(c.sourceType==='product')expandProduct(c.refId,q,date,order,new Set(seen));
    });
  };
  (db.orderItems||[]).forEach(o=>{
    if(o.recipeId&&(db.recipeMasters||[]).some(r=>r.id===o.recipeId)){addRecipe(o.recipeId,Number(o.quantity||0),o.unit,o.date,o);return}
    let p=o.productId?(db.productMasters||[]).find(x=>x.id===o.productId):null;
    if(!p&&o.productName)p=(db.productMasters||[]).find(x=>norm(x.name)===norm(o.productName));
    if(p){expandProduct(p.id,Number(o.quantity||0),o.date,o);return}
    unmatched.push({orderId:o.id,productName:o.productName||'商品名なし',quantity:Number(o.quantity||0),unit:o.unit||'点',date:o.date||'',customer:o.customer||'',memo:o.memo||''});
  });
  return {recipeTotals:[...recipeMap.values()],taskTotals:[...taskMap.values()],materialTotals:[...materialMap.values()],unmatchedItems:unmatched};
}
function renderAggregateV10(){
  const r=state.lastAggregate||appState.aggregateResult||{recipeTotals:[],taskTotals:[],materialTotals:[],unmatchedItems:[]};
  const recipes=r.recipeTotals||[],tasks=r.taskTotals||[],u=r.unmatchedItems||[];
  if($('aggregateRecipeCountBadge'))$('aggregateRecipeCountBadge').textContent=`${recipes.length}件`;
  if($('aggregateTaskCountBadge'))$('aggregateTaskCountBadge').textContent=`${tasks.length}件`;
  if($('aggregateUnmatchedCountBadge'))$('aggregateUnmatchedCountBadge').textContent=`${u.length}件`;
  if($('aggregateRecipeList'))$('aggregateRecipeList').innerHTML=recipes.length?recipes.map((x,i)=>`<div class="v10-aggregate-row v12-aggregate-row"><div><div class="v10-aggregate-title">${esc(x.recipeName)}</div><div class="v10-aggregate-meta">${esc(x.eventDate||'-')} / 必要 ${esc(x.requiredQuantity)}${esc(x.requiredUnit||'')} / ${esc(x.requiredScale)}倍</div></div><button type="button" class="v12-aggregate-delete" data-v12-remove-recipe="${i}">削除</button></div>`).join(''):'<div class="empty-box">まだ集計していません。</div>';
  if($('aggregateTaskList'))$('aggregateTaskList').innerHTML=tasks.length?tasks.map((x,i)=>`<div class="v10-aggregate-row v12-aggregate-row"><div><div class="v10-aggregate-title">${esc(x.taskName)}</div><div class="v10-aggregate-meta">${esc(x.eventDate||'-')} / ${esc(x.requiredCount)}${esc(x.unit||'')}</div></div><button type="button" class="v12-aggregate-delete" data-v12-remove-task="${i}">削除</button></div>`).join(''):'<div class="empty-box">必要作業はありません。</div>';
  if($('aggregateUnmatchedList'))$('aggregateUnmatchedList').innerHTML=u.length?u.map((x,i)=>`<article class="v10-unmatched-row v12-aggregate-row" data-v10-unmatched="${esc(x.orderId)}"><div><strong>${esc(x.productName)}</strong><small>${esc(x.date||'-')} / ${esc(x.quantity)}${esc(x.unit||'')}${x.customer?' / '+esc(x.customer):''}　→ タップして商品・レシピを選択</small></div><button type="button" class="v12-aggregate-delete" data-v12-remove-unmatched="${i}">削除</button></article>`).join(''):'<div class="empty-box">要紐付けはありません。</div>';
}

function runAggregateV10(){
  const r=computeAggregate();state.lastAggregate=r;appState.aggregateResult=r;persist();renderAggregateV10();return r;
}
function aggregateKey(x){return `${x.recipeId}|${x.eventDate||''}|${(x.sourceOrders||[]).map(s=>s.orderId).sort().join(',')}`}
function createBatchesV10(){
  // 表示中の集計結果を最優先。無ければその場で再集計して作成する。
  let r=state.lastAggregate;
  if(!r||!Array.isArray(r.recipeTotals)){
    r=(appState&&appState.aggregateResult&&Array.isArray(appState.aggregateResult.recipeTotals))
      ? appState.aggregateResult
      : computeAggregate();
    state.lastAggregate=r;
    if(appState)appState.aggregateResult=r;
  }
  if((r.unmatchedItems||[]).length){
    alert(`要紐付けが ${r.unmatchedItems.length}件あります。先に紐付けるか、不要な項目は集計欄の「削除」で外してください。`);
    return;
  }
  const totals=Array.isArray(r.recipeTotals)?r.recipeTotals:[];
  if(!totals.length){alert('製造バッチにするレシピがありません。');return}
  if(!Array.isArray(db.productionBatches))db.productionBatches=[];
  let made=0,skip=0,missing=0;
  totals.forEach(t=>{
    const rec=(db.recipeMasters||[]).find(x=>x.id===t.recipeId);
    if(!rec){missing++;return}
    const key=aggregateKey(t);
    if(db.productionBatches.some(b=>b.aggregateKey===key)){skip++;return}
    const y=Number(rec.yieldQuantity||t.yieldQuantity||0);
    const q=Number(t.requiredQuantity||0);
    const scale=Number(t.requiredScale)>0?Number(t.requiredScale):(y>0?Math.ceil((q/y)*100)/100:1);
    db.productionBatches.unshift({
      id:createId('batch'),recipeId:rec.id,recipeName:rec.name,
      name:`${rec.name} ${scale}倍`,date:t.eventDate||today(),
      sourceOrders:JSON.parse(JSON.stringify(t.sourceOrders||[])),
      scale,requiredQuantity:q,requiredUnit:t.requiredUnit||rec.yieldUnit||'',
      yieldQuantity:rec.yieldQuantity||0,yieldUnit:rec.yieldUnit||'',
      materials:typeof scaleRecipeMaterials==='function'?scaleRecipeMaterials(rec,scale):[],
      flows:JSON.parse(JSON.stringify(rec.flows||[])).map((f,idx)=>({...f,flowOrder:idx,batchName:`${rec.name} ${scale}倍`,recipeName:rec.name,scale})),
      memo:'集計から自動生成',aggregateKey:key,createdAt:new Date().toISOString()
    });
    made++;
  });
  persist();
  if(typeof renderBatchList==='function')renderBatchList();
  if(made>0){
    if(typeof activateTab==='function')activateTab('production');
    alert(`製造バッチを ${made}件作成しました。${skip?`\n作成済み ${skip}件は重複作成しませんでした。`:''}${missing?`\nレシピが見つからない項目 ${missing}件は作成できませんでした。`:''}`);
  }else{
    alert(skip?`すべて作成済みです（${skip}件）。`:`製造バッチを作成できませんでした。${missing?` レシピ参照切れ ${missing}件。`:''}`);
  }
}

function removeAggregateItemV12(kind,index){
  const r=state.lastAggregate||appState.aggregateResult;
  if(!r)return;
  const map={recipe:'recipeTotals',task:'taskTotals',unmatched:'unmatchedItems'};
  const key=map[kind];
  if(!key||!Array.isArray(r[key]))return;
  const i=Number(index);
  if(!Number.isInteger(i)||i<0||i>=r[key].length)return;
  r[key].splice(i,1);
  state.lastAggregate=r;
  if(appState)appState.aggregateResult=r;
  renderAggregateV10();
}


/* 予約から製造 */
function createDirectRecipeBatch(order,item){
  const r=(db.recipeMasters||[]).find(x=>x.id===item.recipeId);if(!r)return false;
  if((db.productionBatches||[]).some(b=>b.sourceType==='reservation'&&b.sourceOrderItemId===item.id))return true;
  const q=Number(item.quantity||1),y=Number(r.yieldQuantity||1)||1,scale=typeof ceil2==='function'?ceil2(q/y):Math.ceil(q/y*100)/100;
  db.productionBatches.unshift({id:createId('batch'),sourceType:'reservation',sourceOrderId:order.id,sourceOrderItemId:item.id,recipeId:r.id,recipeName:r.name,name:`${r.name} ${scale}倍`,date:order.date||today(),scale,requiredQuantity:q,requiredUnit:item.unit||r.yieldUnit||'',yieldQuantity:r.yieldQuantity||0,yieldUnit:r.yieldUnit||'',materials:typeof scaleRecipeMaterials==='function'?scaleRecipeMaterials(r,scale):[],flows:JSON.parse(JSON.stringify(r.flows||[])),sourceOrders:[{orderId:order.id,customer:order.customer||'',date:order.date||'',productName:item.productName||r.name}],memo:'予約からレシピ直接紐付け',createdAt:new Date().toISOString()});return true;
}
function sendReservationV10(orderId){
  const order=(db.reservationOrders||[]).find(o=>o.id===orderId);if(!order)return alert('予約が見つかりません。');
  const items=resItems(orderId),unresolved=items.filter(i=>!i.productId&&!i.recipeId);
  if(unresolved.length)return alert(`未紐付けが ${unresolved.length}件あります。先に商品またはレシピへ紐付けてください。`);
  items.forEach(i=>{
    if(i.recipeId&&!i.productId)createDirectRecipeBatch(order,i);
    else if(i.productId){
      if((db.productionBatches||[]).some(b=>b.sourceType==='reservation'&&b.sourceOrderItemId===i.id))return;
      if(typeof createReservationLinkedBatch==='function')createReservationLinkedBatch(order,i);
    }
  });
  order.productionStatus='製造バッチ化済み';persist();renderReservationsV10();if(typeof renderBatchList==='function')renderBatchList();closeSheet('reservationDetailV9');if(typeof activateTab==='function')activateTab('production');alert('予約から製造バッチを作成しました。');
}

function bind(){
  // 最初に旧バージョンが残した完了済み・重複を実データから掃除
  const cleaned=cleanupReservations();
  if(cleaned.removedOrders||cleaned.removedItems)setImportStatus(`起動時整理：予約 ${cleaned.removedOrders}件・明細 ${cleaned.removedItems}件を完了/重複として整理しました。`);

  // 受注操作はcaptureで旧ハンドラより先に処理
  $('orderList')?.addEventListener('click',e=>{
    const d=e.target.closest('[data-v10-order-delete]');
    if(d){e.preventDefault();e.stopImmediatePropagation();const id=d.dataset.v10OrderDelete;armDestructiveButton(d,'もう一度押して削除','削除',()=>deleteOrderV10(id));return}
    const row=e.target.closest('[data-v10-order]');if(row){e.preventDefault();e.stopImmediatePropagation();openOrder((db.orderItems||[]).find(x=>x.id===row.dataset.v10Order))}
  },true);
  $('orderNewV9')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openOrder(null)},true);
  $('clearOrdersBtnV11')?.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const btn=e.currentTarget;
    armDestructiveButton(btn,'もう一度押して全削除','受注を一括削除',()=>{
      db.orderItems=[];
      if(typeof resetOrderEditor==='function')resetOrderEditor();
      if(appState)appState.aggregateResult={recipeTotals:[],taskTotals:[],materialTotals:[],unmatchedItems:[]};
      state.lastAggregate=null;persist();renderOrdersV10();renderAggregateV10();
      show($('orderEditorCardV9'),false);
    });
  },true);
  $('orderSearchV9')?.addEventListener('input',e=>{state.orderQ=e.target.value;renderOrdersV10()});
  $('orderDateChipsV9')?.addEventListener('click',e=>{const b=e.target.closest('[data-order-range]');if(!b)return;state.orderRange=b.dataset.orderRange;[...$('orderDateChipsV9').children].forEach(x=>x.classList.toggle('is-active',x===b));renderOrdersV10()});
  $('saveOrderBtn')?.addEventListener('click',()=>setTimeout(()=>{show($('orderEditorCardV9'),false);renderOrdersV10()},0));

  // JSON UI
  $('reservationImportToggleV9')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const c=$('reservationImportCardV9');show(c,c?.classList.contains('is-hidden'));if(!c?.classList.contains('is-hidden'))c.scrollIntoView({behavior:'smooth',block:'start'})},true);
  [['importReservationBtn','merge'],['mergeReservationBtn','merge']].forEach(([id,mode])=>$ (id)?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();doImport(mode)},true));
  $('replaceReservationBtn')?.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const btn=e.currentTarget;
    armDestructiveButton(btn,'もう一度押して上書き','現在の予約を削除して上書き',()=>doImport('replace'));
  },true);
  $('clearReservationBtn')?.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const btn=e.currentTarget;
    armDestructiveButton(btn,'もう一度押して全削除','予約データ全削除',()=>{
      db.reservationOrders=[];db.reservationOrderItems=[];
      if(appState) appState.aggregateResult={recipeTotals:[],taskTotals:[],materialTotals:[],unmatchedItems:[]};
      state.lastAggregate=null;persist();renderReservationsV10();renderAggregateV10();
      setImportStatus('予約データを全削除しました。','warn');
    });
  },true);
  $('cleanupReservationBtnV10')?.addEventListener('click',e=>{e.preventDefault();const r=cleanupReservations();renderReservationsV10();setImportStatus(`整理完了：予約 ${r.removedOrders}件・明細 ${r.removedItems}件を削除/統合しました。`)});

  $('reservationSearchV9')?.addEventListener('input',e=>{state.resQ=e.target.value;renderReservationsV10()});
  $('reservationStatusChipsV9')?.addEventListener('click',e=>{const b=e.target.closest('[data-res-range]');if(!b)return;state.resRange=b.dataset.resRange;[...$('reservationStatusChipsV9').children].forEach(x=>x.classList.toggle('is-active',x===b));renderReservationsV10()});
  $('reservationCategoryChipsV9')?.addEventListener('click',e=>{const b=e.target.closest('[data-res-cat]');if(!b)return;state.resCat=b.dataset.resCat;[...$('reservationCategoryChipsV9').children].forEach(x=>x.classList.toggle('is-active',x===b));renderReservationsV10()});
  $('reservationList')?.addEventListener('click',e=>{const row=e.target.closest('[data-v10-res]');if(row){e.preventDefault();e.stopImmediatePropagation();reservationDetail(row.dataset.v10Res)}},true);
  $('reservationDetailBodyV9')?.addEventListener('click',e=>{const p=e.target.closest('[data-v10-pick-res]');if(p)openPicker({kind:'reservation',id:p.dataset.v10PickRes},'product');const s=e.target.closest('[data-v10-send-res]');if(s)sendReservationV10(s.dataset.v10SendRes)});

  document.querySelectorAll('[data-v9-close]').forEach(x=>x.addEventListener('click',()=>closeSheet(x.dataset.v9Close)));
  $('masterPickerTypeV9')?.addEventListener('click',e=>{const b=e.target.closest('[data-picker-type]');if(!b)return;state.pickerType=b.dataset.pickerType;document.querySelectorAll('[data-picker-type]').forEach(x=>x.classList.toggle('is-active',x===b));renderPicker()});
  $('masterPickerSearchV9')?.addEventListener('input',renderPicker);
  $('masterPickerResultsV9')?.addEventListener('click',e=>{const b=e.target.closest('[data-v10-master]');if(b)applyPicker(b.dataset.v10Master)});

  // 集計・バッチ作成もcaptureで元のイベントを止める
  $('runAggregateBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();runAggregateV10()},true);
  $('createBatchesFromAggregateBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();createBatchesV10()},true);
  $('aggregateRecipeList')?.addEventListener('click',e=>{const b=e.target.closest('[data-v12-remove-recipe]');if(!b)return;e.preventDefault();e.stopPropagation();removeAggregateItemV12('recipe',b.dataset.v12RemoveRecipe)});
  $('aggregateTaskList')?.addEventListener('click',e=>{const b=e.target.closest('[data-v12-remove-task]');if(!b)return;e.preventDefault();e.stopPropagation();removeAggregateItemV12('task',b.dataset.v12RemoveTask)});
  $('aggregateUnmatchedList')?.addEventListener('click',e=>{const del=e.target.closest('[data-v12-remove-unmatched]');if(del){e.preventDefault();e.stopPropagation();removeAggregateItemV12('unmatched',del.dataset.v12RemoveUnmatched);return}const r=e.target.closest('[data-v10-unmatched]');if(r)openPicker({kind:'order',id:r.dataset.v10Unmatched},'product')});

  $('createUnlinkedBatchesBtn')?.remove();
  renderOrdersV10();renderReservationsV10();renderAggregateV10();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
