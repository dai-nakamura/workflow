(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={query:'',type:'',materialCategory:'',yieldUnit:'',flow:'all',productId:'',sort:'name'};
  const norm=v=>String(v??'').normalize('NFKC').toLowerCase().trim();
  const unique=a=>[...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),'ja'));
  const recipes=()=>Array.isArray(window.db?.recipeMasters)?window.db.recipeMasters:(typeof db!=='undefined'&&Array.isArray(db.recipeMasters)?db.recipeMasters:[]);
  const materials=()=>Array.isArray(window.db?.materialsMaster)?window.db.materialsMaster:(typeof db!=='undefined'&&Array.isArray(db.materialsMaster)?db.materialsMaster:[]);
  const products=()=>Array.isArray(window.db?.productMasters)?window.db.productMasters:(typeof db!=='undefined'&&Array.isArray(db.productMasters)?db.productMasters:[]);

  function recipeCost(r){
    try{return typeof calculateRecipeCost==='function'?Number(calculateRecipeCost(r))||0:0}catch(e){return 0}
  }
  function linkedProductIds(recipeId){
    return products().filter(p=>(p.components||[]).some(c=>(c.sourceType==='recipe'||c.type==='recipe')&&(c.refId===recipeId||c.recipeId===recipeId))).map(p=>p.id);
  }
  function linkedProductNames(recipeId){
    const ids=linkedProductIds(recipeId);return products().filter(p=>ids.includes(p.id)).map(p=>p.name).filter(Boolean);
  }
  function recipeMaterialCategories(r){
    const byId=new Map(materials().map(m=>[m.id,m]));
    return unique((r.materials||[]).map(x=>byId.get(x.materialId)?.category||'').filter(Boolean));
  }
  function refreshOptions(){
    const all=recipes();
    const types=unique(all.map(r=>r.type||''));
    const chips=$('recipeTypeChips');
    if(chips) chips.innerHTML=['',...types].map(t=>`<button type="button" class="recipe-type-chip ${state.type===t?'is-active':''}" data-recipe-type="${esc(t)}">${t?esc(t):'すべて'}</button>`).join('');
    const matCat=$('recipeMaterialCategoryFilter');
    if(matCat){const vals=unique(materials().map(m=>m.category||''));const cur=state.materialCategory;matCat.innerHTML='<option value="">すべて</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');matCat.value=vals.includes(cur)?cur:'';if(matCat.value!==cur)state.materialCategory='';}
    const yieldSel=$('recipeYieldUnitFilter');
    if(yieldSel){const vals=unique(all.map(r=>r.yieldUnit||''));const cur=state.yieldUnit;yieldSel.innerHTML='<option value="">すべて</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');yieldSel.value=vals.includes(cur)?cur:'';if(yieldSel.value!==cur)state.yieldUnit='';}
    const prodSel=$('recipeProductFilter');
    if(prodSel){const vals=products().filter(p=>(p.components||[]).some(c=>c.sourceType==='recipe'||c.type==='recipe'));const cur=state.productId;prodSel.innerHTML='<option value="">すべて</option>'+vals.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'名称未設定')}</option>`).join('');prodSel.value=vals.some(p=>p.id===cur)?cur:'';if(prodSel.value!==cur)state.productId='';}
  }
  function filtered(){
    const q=norm(state.query);
    let list=recipes().filter(r=>{
      if(q){
        const productText=linkedProductNames(r.id).join(' ');
        const ingredientText=(r.materials||[]).map(m=>m.name||'').join(' ');
        const flowText=(r.flows||[]).map(f=>[f.title,f.description,f.equipment].join(' ')).join(' ');
        const hay=norm([r.name,r.type,r.owner,r.memo,r.yieldUnit,ingredientText,flowText,productText].join(' '));
        if(!hay.includes(q))return false;
      }
      if(state.type&&r.type!==state.type)return false;
      if(state.materialCategory&&!recipeMaterialCategories(r).includes(state.materialCategory))return false;
      if(state.yieldUnit&&r.yieldUnit!==state.yieldUnit)return false;
      if(state.flow==='with'&&!(r.flows||[]).length)return false;
      if(state.flow==='without'&&(r.flows||[]).length)return false;
      if(state.productId&&!linkedProductIds(r.id).includes(state.productId))return false;
      return true;
    });
    list=list.slice().sort((a,b)=>{
      if(state.sort==='updated-desc')return String(b.updatedAt||b.date||'').localeCompare(String(a.updatedAt||a.date||''))||String(a.name||'').localeCompare(String(b.name||''),'ja');
      if(state.sort==='cost-desc')return recipeCost(b)-recipeCost(a)||String(a.name||'').localeCompare(String(b.name||''),'ja');
      if(state.sort==='cost-asc')return recipeCost(a)-recipeCost(b)||String(a.name||'').localeCompare(String(b.name||''),'ja');
      return String(a.name||'').localeCompare(String(b.name||''),'ja');
    });
    return list;
  }
  function dupCount(r){const n=norm(r.name);return recipes().filter(x=>norm(x.name)===n).length;}
  function renderRecipeListV2(){
    const all=recipes(),list=filtered(),host=$('recipeMasterList');
    if($('recipeCountBadge'))$('recipeCountBadge').textContent=`${all.length}件`;
    refreshOptions();
    if($('recipeResultLine'))$('recipeResultLine').innerHTML=`表示 ${list.length}件 <span class="recipe-count-muted">/ 全${all.length}件</span>`;
    if(!host)return;
    if(!list.length){host.innerHTML='<div class="recipe-empty">条件に合うレシピがありません。</div>';return;}
    host.innerHTML=list.map(r=>{
      const d=dupCount(r),products=linkedProductNames(r.id),meta=[r.type||'未分類',`出来高 ${Number(r.yieldQuantity||0)}${r.yieldUnit||''}`];
      if(products.length)meta.push(products.slice(0,2).join('・'));
      return `<article class="recipe-compact-row" data-recipe-row-id="${esc(r.id)}" tabindex="0">
        <div class="recipe-row-main"><div class="recipe-row-name">${esc(r.name||'名称未設定')}${d>1?`<span class="recipe-dup-badge">同名${d}件</span>`:''}</div><div class="recipe-row-meta">${esc(meta.join(' / '))}</div></div>
        <div class="recipe-row-cost">原価 ¥${recipeCost(r).toLocaleString('ja-JP',{maximumFractionDigits:2})}</div>
        <button class="recipe-delete-btn delete-recipe-btn" type="button" data-id="${esc(r.id)}">削除</button>
      </article>`;
    }).join('');
  }
  function makeModal(){ return; }
  function openModal(){const m=$('recipeEditorModal');if(m){m.classList.add('is-open');m.setAttribute('aria-hidden','false');setTimeout(()=>$('recipeName')?.focus(),80);}}
  function closeModal(){const m=$('recipeEditorModal');if(m){m.classList.remove('is-open');m.setAttribute('aria-hidden','true');}}
  function titleFromEditor(){const name=$('recipeName')?.value.trim();$('recipeEditorTitle').textContent=name||'レシピを追加';}
  function openExisting(id){if(typeof loadRecipeMaster==='function')loadRecipeMaster(id);titleFromEditor();openModal();}
  function openNew(){if(typeof resetRecipeEditor==='function')resetRecipeEditor();titleFromEditor();openModal();}
  window.renderRecipeMasterList=renderRecipeListV2;try{renderRecipeMasterList=renderRecipeListV2}catch(e){}

  function bind(){
    makeModal();
    $('recipeSearchInput')?.addEventListener('input',e=>{state.query=e.target.value;renderRecipeListV2();});
    $('recipeTypeChips')?.addEventListener('click',e=>{const b=e.target.closest('[data-recipe-type]');if(!b)return;state.type=b.dataset.recipeType||'';renderRecipeListV2();});
    $('recipeFilterToggleBtn')?.addEventListener('click',()=>$('recipeAdvancedFilters')?.classList.toggle('is-hidden'));
    $('recipeMaterialCategoryFilter')?.addEventListener('change',e=>{state.materialCategory=e.target.value;renderRecipeListV2();});
    $('recipeYieldUnitFilter')?.addEventListener('change',e=>{state.yieldUnit=e.target.value;renderRecipeListV2();});
    $('recipeFlowFilter')?.addEventListener('change',e=>{state.flow=e.target.value;renderRecipeListV2();});
    $('recipeProductFilter')?.addEventListener('change',e=>{state.productId=e.target.value;renderRecipeListV2();});
    $('recipeSortSelect')?.addEventListener('change',e=>{state.sort=e.target.value;renderRecipeListV2();});
    $('clearRecipeFiltersBtn')?.addEventListener('click',()=>{Object.assign(state,{query:'',type:'',materialCategory:'',yieldUnit:'',flow:'all',productId:'',sort:'name'});if($('recipeSearchInput'))$('recipeSearchInput').value='';if($('recipeFlowFilter'))$('recipeFlowFilter').value='all';if($('recipeSortSelect'))$('recipeSortSelect').value='name';renderRecipeListV2();});
    $('openNewRecipeBtn')?.addEventListener('click',openNew);
    $('closeRecipeEditorBtn')?.addEventListener('click',closeModal);
    $('recipeEditorBackdrop')?.addEventListener('click',closeModal);
    $('recipeName')?.addEventListener('input',titleFromEditor);
    $('recipeMasterList')?.addEventListener('click',e=>{if(e.target.closest('.delete-recipe-btn'))return;const row=e.target.closest('[data-recipe-row-id]');if(row){e.preventDefault();e.stopPropagation();openExisting(row.dataset.recipeRowId);}},true);
    $('recipeMasterList')?.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest('[data-recipe-row-id]');if(!row)return;e.preventDefault();openExisting(row.dataset.recipeRowId);});
    $('saveRecipeBtn')?.addEventListener('click',()=>setTimeout(()=>{renderRecipeListV2();if($('recipeName')?.value.trim()&&appState.currentRecipeId)closeModal();},0));
    $('newRecipeBtn')?.addEventListener('click',()=>setTimeout(()=>{titleFromEditor();},0));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('recipeEditorModal')?.classList.contains('is-open'))closeModal();});
    renderRecipeListV2();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
