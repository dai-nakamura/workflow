(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function matDb(){return (typeof db!=='undefined'&&Array.isArray(db.materialsMaster))?db.materialsMaster:[]}
function itemCost(item){
  const mat=matDb().find(x=>x.id===item.materialId);
  if(!mat)return 0;
  try{return typeof unitCostFromMaterial==='function' ? Number(unitCostFromMaterial(mat)||0)*Number(item.amountValue||0) : 0}catch(e){return 0}
}
function renderCompactRecipeMaterials(){
  const host=$('recipeMaterialsList'), empty=$('recipeMaterialsEmpty');
  if(!host || typeof appState==='undefined')return;
  const arr=Array.isArray(appState.currentRecipeMaterials)?appState.currentRecipeMaterials:[];
  host.classList.add('recipe-material-compact-list');
  if(!arr.length){host.innerHTML=''; if(empty)empty.classList.remove('is-hidden'); return;}
  if(empty)empty.classList.add('is-hidden');
  host.innerHTML=arr.map((item,index)=>{
    const amount=`${Number(item.amountValue||0).toLocaleString('ja-JP',{maximumFractionDigits:2})}${esc(item.amountUnit||'')}`;
    const cost=itemCost(item);
    return `<article class="recipe-material-row" data-recipe-material-index="${index}" tabindex="0">
      <div class="recipe-material-name">${esc(item.name||'名称未設定')}</div>
      <div class="recipe-material-amount">${amount}</div>
      <div class="recipe-material-cost">¥${cost.toLocaleString('ja-JP',{maximumFractionDigits:2})}</div>
      <button class="recipe-material-delete" type="button" data-rm-delete="${index}">削除</button>
    </article>`;
  }).join('');
}
try{renderRecipeMaterials=renderCompactRecipeMaterials}catch(e){}
window.renderRecipeMaterials=renderCompactRecipeMaterials;

function openNav(title){
  const nav=$('recipeMaterialNav'); if(!nav)return;
  $('recipeMaterialNavTitle').textContent=title||'材料を追加';
  nav.classList.add('is-open'); nav.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  setTimeout(()=>$('recipeMaterialSelect')?.focus(),50);
}
function closeNav(){
  const nav=$('recipeMaterialNav'); if(!nav)return;
  nav.classList.remove('is-open'); nav.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
function openNewMaterial(){
  if(typeof openAddRecipeMaterialForm==='function')openAddRecipeMaterialForm();
  openNav('材料を追加');
}
function openExistingMaterial(index){
  const item=appState.currentRecipeMaterials?.[index]; if(!item)return;
  appState.editingRecipeMaterialIndex=index;
  if(typeof initRecipeMaterialFilter==='function')initRecipeMaterialFilter();
  const mat=matDb().find(x=>x.id===item.materialId);
  if($('recipeMaterialFilterCategory'))$('recipeMaterialFilterCategory').value=mat?.category||'';
  if(typeof renderRecipeMaterialOptions==='function')renderRecipeMaterialOptions();
  if($('recipeMaterialSelect'))$('recipeMaterialSelect').value=item.materialId||'';
  if($('recipeMaterialAmountValue'))$('recipeMaterialAmountValue').value=item.amountValue??'';
  if($('recipeMaterialAmountUnit'))$('recipeMaterialAmountUnit').value=item.amountUnit||'g';
  if($('recipeMaterialNote'))$('recipeMaterialNote').value=item.note||'';
  $('recipeMaterialFormCard')?.classList.remove('is-hidden');
  openNav(item.name||'材料を編集');
}
function bind(){
  // material add: this navigation only; stop the old handler that would reveal the form below the list.
  $('addRecipeMaterialBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openNewMaterial();},true);
  $('recipeMaterialNavBack')?.addEventListener('click',e=>{e.preventDefault();if(typeof closeRecipeMaterialForm==='function')closeRecipeMaterialForm();closeNav();});
  $('cancelRecipeMaterialBtn')?.addEventListener('click',()=>setTimeout(closeNav,0));
  $('saveRecipeMaterialBtn')?.addEventListener('click',()=>setTimeout(()=>{renderCompactRecipeMaterials();closeNav();},0));
  $('recipeMaterialsList')?.addEventListener('click',e=>{
    const del=e.target.closest('[data-rm-delete]');
    if(del){e.preventDefault();e.stopImmediatePropagation();const i=Number(del.dataset.rmDelete);appState.currentRecipeMaterials.splice(i,1);renderCompactRecipeMaterials();if(typeof updateRecipeCostLabel==='function')updateRecipeCostLabel();return;}
    const row=e.target.closest('[data-recipe-material-index]');
    if(row){e.preventDefault();e.stopImmediatePropagation();openExistingMaterial(Number(row.dataset.recipeMaterialIndex));}
  },true);
  $('recipeMaterialsList')?.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest('[data-recipe-material-index]');if(!row)return;e.preventDefault();openExistingMaterial(Number(row.dataset.recipeMaterialIndex));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('recipeMaterialNav')?.classList.contains('is-open'))closeNav();});

  // Recipe master rows load editor in-place, not in a whole-recipe modal.
  $('recipeMasterList')?.addEventListener('click',e=>{if(e.target.closest('.delete-recipe-btn'))return;const row=e.target.closest('[data-recipe-row-id]');if(!row)return;setTimeout(()=>$('recipeName')?.scrollIntoView({behavior:'smooth',block:'start'}),0);},true);
  $('openNewRecipeBtn')?.addEventListener('click',()=>setTimeout(()=>$('recipeName')?.scrollIntoView({behavior:'smooth',block:'start'}),0));
  renderCompactRecipeMaterials();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
