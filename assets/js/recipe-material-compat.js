(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mats(){return (typeof db!=='undefined'&&Array.isArray(db.materialsMaster))?db.materialsMaster:[]}
function recipesDb(){return (typeof db!=='undefined'&&Array.isArray(db.recipeMasters))?db.recipeMasters:[]}
function resolveName(item){
  if(item?.name)return item.name;
  const m=mats().find(x=>x.id===item?.materialId);
  return m?.name||'名称未設定';
}
function calcCost(item){
  const m=mats().find(x=>x.id===item?.materialId);
  if(!m)return 0;
  const amount=Number(m.baseAmount||0),price=Number(m.basePrice||0);
  const per=amount>0?price/amount:0;
  return per*Number(item?.amountValue||0);
}
function renderV15(){
  const host=$('recipeMaterialsList'),empty=$('recipeMaterialsEmpty');
  if(!host||typeof appState==='undefined')return;
  const arr=Array.isArray(appState.currentRecipeMaterials)?appState.currentRecipeMaterials:[];
  host.classList.add('recipe-material-compact-list');
  if(!arr.length){host.innerHTML='';if(empty){empty.textContent='まだ材料がありません。';empty.classList.remove('is-hidden');}return;}
  if(empty)empty.classList.add('is-hidden');
  host.innerHTML=arr.map((item,index)=>{
    const amount=`${Number(item.amountValue||0).toLocaleString('ja-JP',{maximumFractionDigits:2})}${esc(item.amountUnit||'')}`;
    const cost=calcCost(item);
    return `<article class="recipe-material-row" data-recipe-material-index="${index}" tabindex="0">
      <div class="recipe-material-name">${esc(resolveName(item))}</div>
      <div class="recipe-material-amount">${amount}</div>
      <div class="recipe-material-cost">¥${cost.toLocaleString('ja-JP',{maximumFractionDigits:2})}</div>
      <button class="recipe-material-delete" type="button" data-rm-delete="${index}">削除</button>
    </article>`;
  }).join('');
}
function syncFromRecipe(id){
  if(typeof appState==='undefined')return;
  const rid=id||appState.currentRecipeId;
  if(!rid){renderV15();return;}
  const r=recipesDb().find(x=>x.id===rid);
  if(!r){renderV15();return;}
  // The saved recipe is the source of truth when opening an existing recipe.
  appState.currentRecipeId=r.id;
  appState.currentRecipeMaterials=JSON.parse(JSON.stringify(Array.isArray(r.materials)?r.materials:[]));
  renderV15();
  try{if(typeof updateRecipeCostLabel==='function')updateRecipeCostLabel()}catch(e){}
}
try{renderRecipeMaterials=renderV15}catch(e){}
window.renderRecipeMaterials=renderV15;

function bind(){
  // Re-sync after the legacy recipe loader finishes.
  $('recipeMasterList')?.addEventListener('click',e=>{
    if(e.target.closest('.delete-recipe-btn'))return;
    const row=e.target.closest('[data-recipe-row-id]');
    if(!row)return;
    const id=row.dataset.recipeRowId;
    setTimeout(()=>syncFromRecipe(id),0);
    setTimeout(()=>syncFromRecipe(id),80);
  },false);
  $('recipeMasterList')?.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const row=e.target.closest('[data-recipe-row-id]');if(!row)return;
    const id=row.dataset.recipeRowId;setTimeout(()=>syncFromRecipe(id),50);
  });
  $('saveRecipeMaterialBtn')?.addEventListener('click',()=>setTimeout(renderV15,20));
  $('saveRecipeBtn')?.addEventListener('click',()=>setTimeout(renderV15,20));
  renderV15();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
