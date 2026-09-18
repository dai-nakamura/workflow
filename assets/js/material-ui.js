(function(){
  'use strict';
  const filterState={query:'',category:'',supplier:'',price:'all',sort:'name',mode:'normal'};
  const $=id=>document.getElementById(id);
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v)||0;
  const yen=v=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2}).format(Number(v)||0);

  function normalizedUnitCost(mat){
    const amount=n(mat.baseAmount),price=n(mat.basePrice),unit=String(mat.baseUnit||'').trim();
    if(amount<=0||price<0)return null;
    const per=price/amount;
    if(unit==='g')return {value:per*1000,label:'kg'};
    if(unit==='kg')return {value:per,label:'kg'};
    if(unit==='ml'||unit==='mL')return {value:per*1000,label:'L'};
    if(unit==='L'||unit==='l')return {value:per,label:'L'};
    return {value:per,label:unit||'単位'};
  }
  function rawCostLabel(mat){
    const c=normalizedUnitCost(mat);
    if(!c||!Number.isFinite(c.value)||n(mat.basePrice)<=0)return '原価未入力';
    return `¥${yen(c.value)}/${esc2(c.label)}`;
  }
  function unique(list){return [...new Set(list.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ja'));}
  function getMaterials(){return (typeof db!=='undefined'&&Array.isArray(db.materialsMaster))?db.materialsMaster:[];}

  function refreshFilterOptions(){
    const mats=getMaterials();
    const categories=unique(mats.map(x=>x.category||''));
    const suppliers=unique(mats.map(x=>x.supplier||''));
    const chips=$('materialCategoryChips');
    if(chips){
      chips.innerHTML=['',...categories].map(c=>`<button type="button" class="material-category-chip ${filterState.category===c?'is-active':''}" data-material-category="${esc2(c)}">${c?esc2(c):'すべて'}</button>`).join('');
    }
    const supplier=$('materialSupplierFilter');
    if(supplier){
      const current=filterState.supplier;
      supplier.innerHTML='<option value="">すべて</option>'+suppliers.map(s=>`<option value="${esc2(s)}">${esc2(s)}</option>`).join('');
      supplier.value=suppliers.includes(current)?current:'';
      if(supplier.value!==current)filterState.supplier='';
    }
  }

  function filteredMaterials(){
    const q=filterState.query.trim().normalize('NFKC').toLowerCase();
    let list=getMaterials().filter(mat=>{
      if(q){
        const hay=[mat.name,mat.category,mat.subCategory,mat.supplier,mat.note].join(' ').normalize('NFKC').toLowerCase();
        if(!hay.includes(q))return false;
      }
      if(filterState.category&&mat.category!==filterState.category)return false;
      if(filterState.supplier&&mat.supplier!==filterState.supplier)return false;
      const c=normalizedUnitCost(mat);
      if(filterState.price==='missing'&&n(mat.basePrice)>0&&n(mat.baseAmount)>0)return false;
      if(['1000','5000','10000'].includes(filterState.price)){
        if(!c||c.value<Number(filterState.price))return false;
      }
      return true;
    });
    list=list.slice().sort((a,b)=>{
      const ca=normalizedUnitCost(a)?.value??-Infinity,cb=normalizedUnitCost(b)?.value??-Infinity;
      if(filterState.sort==='price-desc')return cb-ca||String(a.name).localeCompare(String(b.name),'ja');
      if(filterState.sort==='price-asc')return (ca<0?Infinity:ca)-(cb<0?Infinity:cb)||String(a.name).localeCompare(String(b.name),'ja');
      if(filterState.sort==='category')return String(a.category||'').localeCompare(String(b.category||''),'ja')||String(a.name).localeCompare(String(b.name),'ja');
      return String(a.name||'').localeCompare(String(b.name||''),'ja');
    });
    return list;
  }

  function renderMaterialListV2(){
    const all=getMaterials(),list=filteredMaterials(),host=$('materialsMasterList');
    if($('materialsMasterCountBadge'))$('materialsMasterCountBadge').textContent=`${all.length}件`;
    refreshFilterOptions();
    if($('materialResultLine'))$('materialResultLine').innerHTML=`表示 ${list.length}件 <span class="material-count-muted">/ 全${all.length}件</span>`;
    if(!host)return;
    if(!list.length){host.innerHTML='<div class="material-empty">条件に合う材料がありません。</div>';return;}
    host.innerHTML=list.map(mat=>{
      const cost=rawCostLabel(mat),missing=cost==='原価未入力';
      return `<article class="material-compact-row ${filterState.mode==='cost'?'cost-mode':''}" data-material-row-id="${esc2(mat.id)}" tabindex="0">
        <div class="material-row-name">${esc2(mat.name||'名称未設定')}</div>
        <div class="material-row-cost ${missing?'material-cost-missing':''}">${cost}</div>
        <button class="material-delete-btn delete-matmaster-btn" type="button" data-id="${esc2(mat.id)}">削除</button>
      </article>`;
    }).join('');
  }

  function fillEditor(mat){
    if(!mat)return;
    appState.currentMaterialMasterId=mat.id;
    $('matName').value=mat.name||'';
    $('matBaseAmount').value=mat.baseAmount??'';
    $('matBaseUnit').value=mat.baseUnit||'g';
    $('matBasePrice').value=mat.basePrice??'';
    $('matCategory').value=mat.category||'';
    if($('matSubCategory'))$('matSubCategory').value=mat.subCategory||'';
    $('matSupplier').value=mat.supplier||'';
    $('matNote').value=mat.note||'';
    $('materialEditorTitle').textContent=mat.name||'材料編集';
  }
  function openEditor(){const m=$('materialEditorModal');if(m){m.classList.add('is-open');m.setAttribute('aria-hidden','false');setTimeout(()=>$('matName')?.focus(),80);}}
  function closeEditor(){const m=$('materialEditorModal');if(m){m.classList.remove('is-open');m.setAttribute('aria-hidden','true');}}
  function newEditor(){
    if(typeof resetMaterialMasterEditor==='function')resetMaterialMasterEditor();
    else {appState.currentMaterialMasterId=null;['matName','matBaseAmount','matBasePrice','matCategory','matSubCategory','matSupplier','matNote'].forEach(id=>{if($(id))$(id).value=''});if($('matBaseUnit'))$('matBaseUnit').value='g';}
    $('materialEditorTitle').textContent='材料を追加';
    openEditor();
  }

  window.renderMaterialsMasterList=renderMaterialListV2;
  try{renderMaterialsMasterList=renderMaterialListV2;}catch(e){}

  function bind(){
    $('materialSearchInput')?.addEventListener('input',e=>{filterState.query=e.target.value;renderMaterialListV2();});
    $('materialCategoryChips')?.addEventListener('click',e=>{const b=e.target.closest('[data-material-category]');if(!b)return;filterState.category=b.dataset.materialCategory||'';renderMaterialListV2();});
    $('materialSupplierFilter')?.addEventListener('change',e=>{filterState.supplier=e.target.value;renderMaterialListV2();});
    $('materialPriceFilter')?.addEventListener('change',e=>{filterState.price=e.target.value;renderMaterialListV2();});
    $('materialSortSelect')?.addEventListener('change',e=>{filterState.sort=e.target.value;renderMaterialListV2();});
    $('materialFilterToggleBtn')?.addEventListener('click',()=>{$('materialAdvancedFilters')?.classList.toggle('is-hidden');});
    $('clearMaterialFiltersBtn')?.addEventListener('click',()=>{filterState.query='';filterState.category='';filterState.supplier='';filterState.price='all';filterState.sort='name';if($('materialSearchInput'))$('materialSearchInput').value='';if($('materialPriceFilter'))$('materialPriceFilter').value='all';if($('materialSortSelect'))$('materialSortSelect').value='name';renderMaterialListV2();});
    document.querySelectorAll('[data-material-mode]').forEach(btn=>btn.addEventListener('click',()=>{filterState.mode=btn.dataset.materialMode;document.querySelectorAll('[data-material-mode]').forEach(x=>x.classList.toggle('is-active',x===btn));renderMaterialListV2();}));
    $('openNewMaterialBtn')?.addEventListener('click',newEditor);
    $('closeMaterialEditorBtn')?.addEventListener('click',closeEditor);
    $('materialEditorBackdrop')?.addEventListener('click',closeEditor);
    $('newMaterialMasterBtn')?.addEventListener('click',()=>{setTimeout(()=>{$('materialEditorTitle').textContent='材料を追加';},0);});
    $('saveMaterialMasterBtn')?.addEventListener('click',()=>{setTimeout(()=>{renderMaterialListV2();closeEditor();},0);});
    $('materialsMasterList')?.addEventListener('click',e=>{
      if(e.target.closest('.delete-matmaster-btn'))return;
      const row=e.target.closest('[data-material-row-id]');if(!row)return;
      const mat=getMaterials().find(x=>x.id===row.dataset.materialRowId);if(!mat)return;
      fillEditor(mat);openEditor();
    },true);
    $('materialsMasterList')?.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest('[data-material-row-id]');if(!row)return;e.preventDefault();const mat=getMaterials().find(x=>x.id===row.dataset.materialRowId);if(mat){fillEditor(mat);openEditor();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditor();});
    renderMaterialListV2();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
