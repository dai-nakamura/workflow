(()=>{
'use strict';
const $=id=>document.getElementById(id);
const escV13=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const normV13=v=>String(v??'').trim().replace(/\s+/g,' ').toLowerCase();

function reservationItemNameV13(item){
  const name=String(item?.name||item?.productName||'').trim();
  const type=String(item?.type||item?.category||'').trim();
  // ジャンル名より、JSONに入っている実商品名を優先
  if(name && !['アニバーサリーケーキ','ウェディングケーキ','ウエディングケーキ','ケーキ','その他'].includes(name)) return name;
  return name || type || '商品名未設定';
}
function reservationItemDetailsV13(item){
  const options=Array.isArray(item?.options)?item.options.filter(Boolean):[];
  const sizes=[item?.size,item?.squareSize,item?.multiSize].filter(Boolean);
  return {
    productName:reservationItemNameV13(item),
    itemType:String(item?.type||item?.category||''),
    size:String(item?.size||''),
    squareSize:String(item?.squareSize||''),
    multiSize:String(item?.multiSize||''),
    options,
    plateMessage:String(item?.plateMessage||''),
    dessertCostNote:String(item?.dessertCostNote||''),
    itemNotes:String(item?.notes||''),
    reportType:String(item?.reportType||''),
    cost:Number(item?.cost||0),
    sizeText:sizes.join(' / '),
    optionText:options.join(' / ')
  };
}
function findProductIdV13(item){
  const name=reservationItemNameV13(item);
  if(!name||typeof db==='undefined'||!Array.isArray(db.productMasters)) return '';
  const n=normV13(name);
  let hit=db.productMasters.find(p=>normV13(p.name)===n);
  if(hit)return hit.id;
  hit=db.productMasters.find(p=>n.includes(normV13(p.name))||normV13(p.name).includes(n));
  return hit?.id||'';
}
function convertRawReservationOrdersV13(rawOrders){
  const orders=[]; const orderItems=[];
  (rawOrders||[]).forEach(order=>{
    if(typeof window.isDoneReservation==='function' && window.isDoneReservation(order))return;
    const orderId=order.id || (typeof window.createId==='function'?createId('resord'):`resord_${Date.now()}_${Math.random()}`);
    orders.push({
      id:orderId,
      date:order.date||'', time:order.time||'',
      customer:order.clientName||order.customer||'',
      category:order.category||'', venue:order.venue||'',
      guestCount:Number(order.guestCount||0),
      notes:order.orderNotes||order.notes||'',
      status:order.status||'', productionStatus:'未送信', isProductionTarget:true
    });
    (Array.isArray(order.items)?order.items:[]).forEach(item=>{
      const d=reservationItemDetailsV13(item);
      let sizeInfo=null,sizeInfoList=[],sizeMode='';
      try{
        if(typeof window.parseReservationSize==='function'){
          const p=parseReservationSize(item)||{}; sizeInfo=p.sizeInfo||null;sizeInfoList=p.sizeInfoList||[];sizeMode=p.mode||'';
        }
      }catch(_e){}
      orderItems.push({
        id:typeof window.createId==='function'?createId('resitem'):`resitem_${Date.now()}_${Math.random()}`,
        orderId,
        productId:findProductIdV13(item), recipeId:'',
        productName:d.productName,
        category:d.itemType||order.category||'',
        quantity:Number(item.quantity||1),
        unit:d.itemType==='皿盛りデザート'?'人前':'点',
        size:d.size, squareSize:d.squareSize, multiSize:d.multiSize,
        sizeInfo,sizeInfoList,sizeMode,
        options:d.options,
        plateMessage:d.plateMessage,
        dessertCostNote:d.dessertCostNote,
        reportType:d.reportType,
        cost:d.cost,
        notes:d.itemNotes,
        rawType:d.itemType
      });
    });
  });
  return {orders,orderItems};
}

// v10/v11のconvertInputを上書きし、予約アプリ生JSONでは詳細を落とさない
window.convertInput=function(parsed){
  let rawOrders=[],payload;
  if(Array.isArray(parsed)){
    rawOrders=parsed;
    const active=rawOrders.filter(o=>!(typeof window.isDoneReservation==='function'&&isDoneReservation(o)));
    payload=convertRawReservationOrdersV13(active);
    return {payload,excluded:rawOrders.length-active.length,total:rawOrders.length};
  }
  if(parsed&&Array.isArray(parsed.orders)&&Array.isArray(parsed.orderItems)){
    const all=parsed.orders;
    const active=all.filter(o=>!(typeof window.isDoneReservation==='function'&&isDoneReservation(o)));
    const ids=new Set(active.map(o=>o.id));
    const normalizedItems=parsed.orderItems.filter(i=>ids.has(i.orderId)).map(i=>{
      const d=reservationItemDetailsV13(i);
      return {...i,
        productName:d.productName,
        category:i.category||d.itemType||'',
        size:i.size||d.size, squareSize:i.squareSize||d.squareSize, multiSize:i.multiSize||d.multiSize,
        options:Array.isArray(i.options)?i.options:d.options,
        plateMessage:i.plateMessage||d.plateMessage,
        dessertCostNote:i.dessertCostNote||d.dessertCostNote,
        notes:i.notes||d.itemNotes,
        cost:Number(i.cost??d.cost??0)
      };
    });
    return {payload:{orders:active,orderItems:normalizedItems},excluded:all.length-active.length,total:all.length};
  }
  if(parsed&&Array.isArray(parsed.orders)){
    rawOrders=parsed.orders;
    const active=rawOrders.filter(o=>!(typeof window.isDoneReservation==='function'&&isDoneReservation(o)));
    payload=convertRawReservationOrdersV13(active);
    return {payload,excluded:rawOrders.length-active.length,total:rawOrders.length};
  }
  throw new Error('予約JSONの形式を判定できません。');
};

function itemDetailTextV13(i,compact=false){
  const chunks=[];
  if(i.size)chunks.push(i.size);
  if(i.squareSize)chunks.push(i.squareSize);
  if(i.multiSize)chunks.push(i.multiSize);
  if(Array.isArray(i.options)&&i.options.length)chunks.push(i.options.join('・'));
  if(!compact&&i.plateMessage)chunks.push(`プレート: ${i.plateMessage}`);
  if(!compact&&i.notes)chunks.push(i.notes);
  return chunks.filter(Boolean).join(' / ');
}

// 一覧も「アニバーサリーケーキ」だけでなく商品名＋サイズまで見えるようにする
const oldRender=window.renderReservationsV10;
window.renderReservationsV10=function(){
  if(!$('reservationList')||typeof db==='undefined')return oldRender?.();
  const all=(db.reservationOrders||[]).filter(o=>!(typeof window.isDoneReservation==='function'&&isDoneReservation(o)));
  const visible=typeof window.resVisible==='function'?all.filter(resVisible):all;
  const list=visible.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  if($('reservationCountBadge'))$('reservationCountBadge').textContent=`${list.length}件`;
  if($('reservationResultV9'))$('reservationResultV9').textContent=`表示 ${list.length}件 / 保持 ${all.length}件`;
  $('reservationList').innerHTML=list.length?list.map(o=>{
    const items=(db.reservationOrderItems||[]).filter(i=>i.orderId===o.id),u=items.filter(i=>!i.productId&&!i.recipeId).length;
    const summary=items.slice(0,2).map(i=>{
      const d=itemDetailTextV13(i,true);return `${i.productName||'商品名未設定'}${d?' ['+d+']':''}`;
    }).join(' ・ ')+(items.length>2?` 他${items.length-2}件`: '');
    return `<article class="v9-row" data-v10-res="${escV13(o.id)}" tabindex="0"><div><div class="v9-row-title">${escV13(o.customer||'名称未設定')}</div><div class="v9-row-meta">${escV13(o.date||'-')}${o.time?' '+escV13(o.time):''}${o.venue?' / '+escV13(o.venue):''}${o.category?' / '+escV13(o.category):''}</div><div class="v9-row-sub">${escV13(summary||'商品なし')}</div></div><span class="v9-row-badge ${u?'warn':''}">${u?`未紐付 ${u}`:(o.productionStatus==='製造バッチ化済み'?'送信済':'確認')}</span></article>`;
  }).join(''):'<div class="empty-box">条件に合う予約がありません。</div>';
};

window.reservationDetail=function(id){
  const o=(db.reservationOrders||[]).find(x=>x.id===id);if(!o)return;
  const items=(db.reservationOrderItems||[]).filter(i=>i.orderId===id);
  if($('reservationDetailTitleV9'))$('reservationDetailTitleV9').textContent=o.customer||'予約詳細';
  if(!$('reservationDetailBodyV9'))return;
  $('reservationDetailBodyV9').innerHTML=`<div class="v9-detail-block"><div class="v9-detail-grid"><b>日付</b><span>${escV13(o.date||'-')}${o.time?' '+escV13(o.time):''}</span><b>区分</b><span>${escV13(o.category||'-')}</span><b>会場</b><span>${escV13(o.venue||'-')}</span><b>状態</b><span>${escV13(o.status||'-')} / ${escV13(o.productionStatus||'未送信')}</span><b>メモ</b><span>${escV13(o.notes||'-')}</span></div></div><div class="v9-detail-block"><strong>内容 ${items.length}件</strong>${items.map(i=>{
    const size=[i.size,i.squareSize,i.multiSize].filter(Boolean).join(' / ');
    const options=Array.isArray(i.options)?i.options.filter(Boolean).join(' / '):String(i.options||'');
    return `<div class="v9-item-line"><div style="min-width:0;flex:1"><b>${escV13(i.productName||'商品名未設定')}</b><div class="v9-row-sub">${escV13(i.category||'')}${i.quantity?` / ${escV13(i.quantity)}${escV13(i.unit||'点')}`:''}${size?' / '+escV13(size):''}</div>${options?`<div class="v9-row-sub"><b>オプション:</b> ${escV13(options)}</div>`:''}${i.plateMessage?`<div class="v9-row-sub"><b>プレート:</b> ${escV13(i.plateMessage)}</div>`:''}${i.notes?`<div class="v9-row-sub">${escV13(i.notes)}</div>`:''}<div class="v9-row-sub">${i.productId?'商品紐付け':i.recipeId?'レシピ紐付け':'未紐付け'}</div></div><button type="button" class="v9-link-btn" data-v10-pick-res="${escV13(i.id)}">${i.productId||i.recipeId?'変更':'紐付け'}</button></div>`;
  }).join('')}</div>${o.productionStatus==='製造バッチ化済み'?'':`<button class="btn btn-primary" style="width:100%" data-v10-send-res="${escV13(o.id)}" type="button">製造へ送る</button>`}`;
  if(typeof window.openSheet==='function')openSheet('reservationDetailV9');
};

// 既存保存データにも、保持している詳細フィールドから表示名を補正
function migrateReservationItemsV13(){
  if(typeof db==='undefined'||!Array.isArray(db.reservationOrderItems))return;
  let changed=false;
  db.reservationOrderItems.forEach(i=>{
    if(!i.productName && i.name){i.productName=i.name;changed=true;}
    if(!Array.isArray(i.options)&&i.options){i.options=[String(i.options)];changed=true;}
  });
  if(changed&&typeof window.persistDb==='function')persistDb();
}
setTimeout(()=>{migrateReservationItemsV13();window.renderReservationsV10?.();},50);
})();
