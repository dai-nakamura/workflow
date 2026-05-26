function resetRecipeEditor() {
      appState.currentRecipeId = null;
      appState.currentRecipeMaterials = [];
      appState.currentRecipeFlows = [];
      appState.editingRecipeMaterialIndex = null;
      appState.editingFlowIndex = null;

      els.recipeName.value = '';
      els.recipeType.value = '試作';
      els.recipeDate.value = getTodayString();
      els.recipeOwner.value = '';
      els.recipeYieldQuantity.value = '';
      els.recipeYieldUnit.value = '個';
      els.recipeMemo.value = '';
      els.recipeYieldCustomUnit.value = '';

      els.recipeBaseShape.value = 'round';
      els.recipeBaseDiameter.value = '';
      els.recipeBaseWidth.value = '';
      els.recipeBaseDepth.value = '';
      els.recipeBaseHeight.value = '';

      els.targetDiameter.value = '';
      els.targetHeight.value = '';

      renderReservations();
      closeRecipeMaterialForm();
      closeFlowForm();
      renderRecipeMaterials();
      renderFlows();
      updateEditingLabel();
      updateRecipeCostLabel();
      toggleRecipeBaseSizeFields();
      toggleRecipeYieldCustomField();
    }

function getRecipeMaterialCategories() { const set = new Set(); db.materialsMaster.forEach(m => { if (m.category) set.add(m.category); }); return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja')); }

function initRecipeMaterialFilter() { els.recipeMaterialFilterCategory.innerHTML = [`<option value="">すべて</option>`].concat(getRecipeMaterialCategories().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)).join(''); }

function refreshRecipeMaterialSelect() { renderRecipeMaterialOptions(); }

function renderRecipeMaterialOptions() {
      const category = els.recipeMaterialFilterCategory.value;
      let list = db.materialsMaster;
      if (category) list = list.filter(m => m.category === category);
      els.recipeMaterialSelect.innerHTML = ['<option value="">選択してください</option>']
        .concat(list.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)).join('');
    }

function openAddRecipeMaterialForm() { appState.editingRecipeMaterialIndex = null; initRecipeMaterialFilter(); els.recipeMaterialFilterCategory.value = ''; renderRecipeMaterialOptions(); els.recipeMaterialAmountValue.value = ''; els.recipeMaterialAmountUnit.value = 'g'; els.recipeMaterialNote.value = ''; els.recipeMaterialFormCard.classList.remove('is-hidden'); }

function closeRecipeMaterialForm() { els.recipeMaterialFormCard.classList.add('is-hidden'); appState.editingRecipeMaterialIndex = null; els.recipeMaterialFilterCategory.value = ''; els.recipeMaterialSelect.innerHTML = '<option value="">選択してください</option>'; els.recipeMaterialAmountValue.value = ''; els.recipeMaterialAmountUnit.value = 'g'; els.recipeMaterialNote.value = ''; }

function saveRecipeMaterial() { const materialId = els.recipeMaterialSelect.value; const amountValue = Number(els.recipeMaterialAmountValue.value); if (!materialId) { alert('材料を選択してください。'); return; } if (els.recipeMaterialAmountValue.value === '' || Number.isNaN(amountValue)) { alert('数値を入力してください。'); return; } const mat = db.materialsMaster.find(x => x.id === materialId); if (!mat) return; const item = { materialId, name: mat.name, amountValue, amountUnit: els.recipeMaterialAmountUnit.value, note: els.recipeMaterialNote.value.trim() }; if (appState.editingRecipeMaterialIndex === null) appState.currentRecipeMaterials.unshift(item); else appState.currentRecipeMaterials[appState.editingRecipeMaterialIndex] = item; renderRecipeMaterials(); closeRecipeMaterialForm(); updateRecipeCostLabel(); }

function renderRecipeMaterials() { els.recipeMaterialsList.innerHTML = ''; if (!appState.currentRecipeMaterials.length) { els.recipeMaterialsEmpty.classList.remove('is-hidden'); return; } els.recipeMaterialsEmpty.classList.add('is-hidden'); appState.currentRecipeMaterials.forEach((item, index) => { const mat = db.materialsMaster.find(x => x.id === item.materialId); const cost = mat ? round2(unitCostFromMaterial(mat) * Number(item.amountValue || 0)) : 0; const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(item.name)}</div><div class="record-sub">${round2(item.amountValue)}${escapeHtml(item.amountUnit)}${item.note ? ' / ' + escapeHtml(item.note) : ''}</div><div class="record-sub">原価目安: ¥${cost}</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline edit-recipemat-btn" type="button" data-index="${index}">開く</button><button class="btn btn-danger btn-inline delete-recipemat-btn" type="button" data-index="${index}">削除</button></div>`; els.recipeMaterialsList.appendChild(card); }); }

function handleRecipeMaterialsListClick(e) { const edit = e.target.closest('.edit-recipemat-btn'); const del = e.target.closest('.delete-recipemat-btn'); if (edit) { const idx = Number(edit.dataset.index); const item = appState.currentRecipeMaterials[idx]; if (!item) return; appState.editingRecipeMaterialIndex = idx; initRecipeMaterialFilter(); const mat = db.materialsMaster.find(x => x.id === item.materialId); els.recipeMaterialFilterCategory.value = mat?.category || ''; renderRecipeMaterialOptions(); els.recipeMaterialSelect.value = item.materialId || ''; els.recipeMaterialAmountValue.value = item.amountValue ?? ''; els.recipeMaterialAmountUnit.value = item.amountUnit || 'g'; els.recipeMaterialNote.value = item.note || ''; els.recipeMaterialFormCard.classList.remove('is-hidden'); } if (del) { appState.currentRecipeMaterials.splice(Number(del.dataset.index), 1); renderRecipeMaterials(); updateRecipeCostLabel(); } }

function parseChecks(text) { return String(text || '').split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, done: false })); }

function openAddFlowForm() { appState.editingFlowIndex = null; els.flowTitle.value = ''; els.flowDescription.value = ''; els.flowDurationMinutes.value = ''; els.flowType.value = 'prep'; els.flowCanParallel.value = 'true'; els.flowEquipment.value = ''; els.flowChecks.value = ''; els.flowFormCard.classList.remove('is-hidden'); }

function closeFlowForm() { els.flowFormCard.classList.add('is-hidden'); appState.editingFlowIndex = null; els.flowTitle.value = ''; els.flowDescription.value = ''; els.flowDurationMinutes.value = ''; els.flowType.value = 'prep'; els.flowCanParallel.value = 'true'; els.flowEquipment.value = ''; els.flowChecks.value = ''; }

function saveFlow() { const title = els.flowTitle.value.trim(); if (!title) { alert('工程名を入力してください。'); return; } const flow = { title, description: els.flowDescription.value.trim(), durationMinutes: Number(els.flowDurationMinutes.value || 0), type: els.flowType.value, canParallel: els.flowCanParallel.value === 'true', equipment: els.flowEquipment.value.trim(), checks: parseChecks(els.flowChecks.value) }; if (appState.editingFlowIndex === null) appState.currentRecipeFlows.unshift(flow); else appState.currentRecipeFlows[appState.editingFlowIndex] = flow; renderFlows(); closeFlowForm(); }

function renderFlows() { els.flowList.innerHTML = ''; if (!appState.currentRecipeFlows.length) { els.flowEmpty.classList.remove('is-hidden'); return; } els.flowEmpty.classList.add('is-hidden'); appState.currentRecipeFlows.forEach((flow, index) => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(flow.title)}</div><div class="record-sub">${escapeHtml(flow.description || '説明なし')} / ${flow.durationMinutes || 0}分 / ${escapeHtml(flow.type)}</div><div class="record-sub">設備: ${escapeHtml(flow.equipment || '未設定')} / 並行: ${flow.canParallel ? 'しやすい' : 'しにくい'}</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline edit-flow-btn" type="button" data-index="${index}">開く</button><button class="btn btn-danger btn-inline delete-flow-btn" type="button" data-index="${index}">削除</button></div>`; els.flowList.appendChild(card); }); }

function handleFlowListClick(e) { const edit = e.target.closest('.edit-flow-btn'); const del = e.target.closest('.delete-flow-btn'); if (edit) { const idx = Number(edit.dataset.index); const flow = appState.currentRecipeFlows[idx]; if (!flow) return; appState.editingFlowIndex = idx; els.flowTitle.value = flow.title || ''; els.flowDescription.value = flow.description || ''; els.flowDurationMinutes.value = flow.durationMinutes ?? ''; els.flowType.value = flow.type || 'prep'; els.flowCanParallel.value = String(!!flow.canParallel); els.flowEquipment.value = flow.equipment || ''; els.flowChecks.value = (flow.checks || []).map(c => c.text).join('\n'); els.flowFormCard.classList.remove('is-hidden'); } if (del) { appState.currentRecipeFlows.splice(Number(del.dataset.index), 1); renderFlows(); } }

function saveRecipeMaster() {
  const name = els.recipeName.value.trim();
  if (!name) {
    alert('レシピ名を入力してください。');
    return;
  }
  const recipe = {
    id: appState.currentRecipeId || createId('recipe'),
    name,
    type: els.recipeType.value,
    date: els.recipeDate.value,
    owner: els.recipeOwner.value.trim(),
    memo: els.recipeMemo.value.trim(),
    yieldQuantity: Number(els.recipeYieldQuantity.value || 0),
    yieldUnit: els.recipeYieldUnit.value === '自由入力' ? (els.recipeYieldCustomUnit.value.trim() || '自由入力') : els.recipeYieldUnit.value,
    baseSize: {
      shape: els.recipeBaseShape.value || 'round',
      diameter: Number(els.recipeBaseDiameter.value || 0),
      width: Number(els.recipeBaseWidth.value || 0),
      depth: Number(els.recipeBaseDepth.value || 0),
      height: Number(els.recipeBaseHeight.value || 0)
    },
    baseShape: els.recipeBaseShape.value || 'round',
    baseDiameter: Number(els.recipeBaseDiameter.value || 0),
    baseWidth: Number(els.recipeBaseWidth.value || 0),
    baseDepth: Number(els.recipeBaseDepth.value || 0),
    baseHeight: Number(els.recipeBaseHeight.value || 0),
    materials: deepCopy(appState.currentRecipeMaterials),
    flows: deepCopy(appState.currentRecipeFlows),
    updatedAt: new Date().toISOString()
  };
  const idx = db.recipeMasters.findIndex(x => x.id === recipe.id);
  if (idx === -1) db.recipeMasters.unshift(recipe);
  else db.recipeMasters[idx] = recipe;
  appState.currentRecipeId = recipe.id;
  refreshAll();
  alert('レシピを保存しました。');
}

function loadRecipeMaster(id) {
      const recipe = findRecipe(id);
      if (!recipe) return;

      appState.currentRecipeId = recipe.id;
      els.recipeName.value = recipe.name || '';
      els.recipeType.value = recipe.type || '試作';
      els.recipeDate.value = recipe.date || getTodayString();
      els.recipeOwner.value = recipe.owner || '';
      els.recipeYieldQuantity.value = recipe.yieldQuantity ?? '';
      els.recipeMemo.value = recipe.memo || '';

      const presetUnits = getRecipeYieldPresetValues();
      if (presetUnits.includes(recipe.yieldUnit)) {
        els.recipeYieldUnit.value = recipe.yieldUnit || '個';
        els.recipeYieldCustomUnit.value = '';
      } else {
        els.recipeYieldUnit.value = '自由入力';
        els.recipeYieldCustomUnit.value = recipe.yieldUnit || '';
      }

      els.recipeBaseDiameter.value = recipe.baseSize?.diameter || '';
      els.recipeBaseHeight.value = recipe.baseSize?.height || '';
      els.recipeBaseWidth.value = recipe.baseSize?.width || '';
      els.recipeBaseDepth.value = recipe.baseSize?.depth || '';
      els.recipeBaseHeight.value = recipe.baseSize?.height || '';
      els.targetDiameter.value = '';
      els.targetHeight.value = '';

      toggleRecipeBaseSizeFields();
      toggleRecipeYieldCustomField();

      appState.currentRecipeMaterials = deepCopy(recipe.materials || []);
      appState.currentRecipeFlows = deepCopy(recipe.flows || []);

      renderRecipeMaterials();
      renderFlows();
      updateEditingLabel();
      updateRecipeCostLabel();
      activateTab('recipes');
    }

function deleteRecipeMaster(id) { if (!confirm('このレシピを削除しますか？')) return; db.recipeMasters = db.recipeMasters.filter(x => x.id !== id); if (appState.currentRecipeId === id) resetRecipeEditor(); refreshAll(); }

function renderRecipeMasterList() { els.recipeCountBadge.textContent = `${db.recipeMasters.length}件`; els.recipeMasterList.innerHTML = ''; if (!db.recipeMasters.length) { els.recipeMasterList.innerHTML = '<div class="empty-box">まだレシピがありません。</div>'; return; } db.recipeMasters.forEach(recipe => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(recipe.name)}</div><div class="record-sub">${escapeHtml(recipe.type)} / 出来高 ${round2(recipe.yieldQuantity || 0)}${escapeHtml(recipe.yieldUnit || '')}</div><div class="record-sub">原価: ¥${calculateRecipeCost(recipe)}</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline load-recipe-btn" type="button" data-id="${recipe.id}">開く</button><button
  class="btn btn-secondary btn-inline duplicate-recipe-btn"
  type="button"
  data-id="${recipe.id}">

  複製

</button><button class="btn btn-danger btn-inline delete-recipe-btn" type="button" data-id="${recipe.id}">削除</button></div>`; els.recipeMasterList.appendChild(card); }); }

function handleRecipeMasterListClick(e) { const load = e.target.closest('.load-recipe-btn');const duplicate = e.target.closest('.duplicate-recipe-btn');if (duplicate) {
  duplicateRecipeToEditor(duplicate.dataset.id);
} const del = e.target.closest('.delete-recipe-btn'); if (load) loadRecipeMaster(load.dataset.id); if (del) deleteRecipeMaster(del.dataset.id); }

function updateRecipeCostLabel() { els.recipeCostLabel.textContent = `原価: ¥${calculateRecipeCost({ materials: appState.currentRecipeMaterials })}`; }

function calcSizeScale(baseSize, targetSize) {
  const base = baseSize || {};
  const target = targetSize || {};
  const shape = target.shape || base.shape || 'round';
  if (shape === 'rectangle') {
    const baseW = Number(base.width || 0);
    const baseD = Number(base.depth || 0);
    const baseH = Number(base.height || 1);
    const targetW = Number(target.width || 0);
    const targetD = Number(target.depth || 0);
    const targetH = Number(target.height || baseH || 1);
    if (!baseW || !baseD || !targetW || !targetD) return 1;
    return round2((targetW * targetD * targetH) / (baseW * baseD * baseH));
  }
  const baseDiameter = Number(base.diameter || 0);
  const baseH = Number(base.height || 1);
  const targetDiameter = Number(target.diameter || 0);
  const targetH = Number(target.height || baseH || 1);
  if (!baseDiameter || !targetDiameter) return 1;
  return round2((targetDiameter / baseDiameter) ** 2 * (targetH / baseH));
}

function scaleRecipeBySize() {
  const baseD = Number(els.recipeBaseDiameter.value);
  const baseH = Number(els.recipeBaseHeight.value) || 1;
  const targetD = Number(els.targetDiameter.value);
  const targetH = Number(els.targetHeight.value) || baseH;
  if (!baseD || !targetD) {
    alert('直径を入力してください');
    return;
  }
  const scale = (targetD / baseD) ** 2 * (targetH / baseH);
  appState.currentRecipeMaterials = appState.currentRecipeMaterials.map(m => ({
    ...m,
    amountValue: round2(Number(m.amountValue || 0) * scale)
  }));
  els.recipeBaseDiameter.value = targetD || '';
  els.recipeBaseHeight.value = targetH || '';
  els.targetDiameter.value = '';
  els.targetHeight.value = '';
  renderRecipeMaterials();
  updateRecipeCostLabel();
  alert(`倍率 ${scale.toFixed(2)}倍 に変換しました`);
}
function relinkAllRecipeMaterials() {
  db.recipeMasters = db.recipeMasters.map(recipe => ({
    ...recipe,
    materials: attachMaterialIdsToRecipeMaterials(recipe.materials || [])
  }));

  appState.currentRecipeMaterials =
  attachMaterialIdsToRecipeMaterials(appState.currentRecipeMaterials || []);

  refreshAll();
  alert('レシピ材料を原価マスターと再照合しました。');
}
window.relinkAllRecipeMaterials = relinkAllRecipeMaterials;
function duplicateRecipeToEditor(recipeId) {

  const recipe = findRecipe(recipeId);

  if (!recipe) return;

  appState.currentRecipeId = null;

  els.recipeName.value =
    `${recipe.name || ''} コピー`;

  els.recipeType.value =
    recipe.type || '試作';

  els.recipeDate.value =
    getTodayString();

  els.recipeOwner.value =
    recipe.owner || '';

  els.recipeYieldQuantity.value =
    recipe.yieldQuantity || '';

  const presetUnits =
    getRecipeYieldPresetValues();

  if (presetUnits.includes(recipe.yieldUnit)) {

    els.recipeYieldUnit.value =
      recipe.yieldUnit || '個';

    els.recipeYieldCustomUnit.value = '';

  } else {

    els.recipeYieldUnit.value = '自由入力';

    els.recipeYieldCustomUnit.value =
      recipe.yieldUnit || '';
  }

  els.recipeMemo.value =
    recipe.memo || '';

  els.recipeBaseShape.value =
    recipe.baseShape || 'round';

  els.recipeBaseDiameter.value =
    recipe.baseDiameter || '';

  els.recipeBaseHeight.value =
    recipe.baseHeight || '';

  els.recipeBaseWidth.value =
    recipe.baseWidth || '';

  els.recipeBaseDepth.value =
    recipe.baseDepth || '';

  appState.currentRecipeMaterials =
    deepCopy(recipe.materials || []);

  appState.currentRecipeFlows =
    deepCopy(recipe.flows || []);

  renderRecipeMaterials();
  renderFlows();

  toggleRecipeBaseSizeFields();
  toggleRecipeYieldCustomField();

  updateEditingLabel();
  updateRecipeCostLabel();

  activateTab('recipes');

  alert(
    'レシピを複製しました。名前を変更して保存してください。'
  );
}

window.duplicateRecipeToEditor =
  duplicateRecipeToEditor;

function calcShapeVolumeScale(baseSize, targetSize) {
  const baseShape = baseSize.shape || 'round';
  const targetShape = targetSize.shape || 'round';

  const baseHeight = Number(baseSize.height || 1);
  const targetHeight = Number(targetSize.height || baseHeight || 1);

  let baseArea = 0;
  let targetArea = 0;

  if (baseShape === 'rectangle') {
    baseArea =
      Number(baseSize.width || 0) *
      Number(baseSize.depth || 0);
  } else {
    const d = Number(baseSize.diameter || 0);
    baseArea = Math.PI * Math.pow(d / 2, 2);
  }

  if (targetShape === 'rectangle') {
    targetArea =
      Number(targetSize.width || 0) *
      Number(targetSize.depth || 0);
  } else {
    const d = Number(targetSize.diameter || 0);
    targetArea = Math.PI * Math.pow(d / 2, 2);
  }

  if (!baseArea || !targetArea) return 1;

  return round2((targetArea * targetHeight) / (baseArea * baseHeight));
}
function toggleRecipeCalcShapeRows() {
  const isRectangle = els.recipeCalcTargetShape.value === 'rectangle';

  els.recipeCalcRoundRow.classList.toggle('is-hidden', isRectangle);
  els.recipeCalcRectangleRow.classList.toggle('is-hidden', !isRectangle);
}

function getCurrentRecipeBaseSize() {
  return {
    shape: els.recipeBaseShape.value || 'round',
    diameter: Number(els.recipeBaseDiameter.value || 0),
    width: Number(els.recipeBaseWidth.value || 0),
    depth: Number(els.recipeBaseDepth.value || 0),
    height: Number(els.recipeBaseHeight.value || 1)
  };
}

function getRecipeCalcTargetSize() {
  const shape = els.recipeCalcTargetShape.value || 'round';

  if (shape === 'rectangle') {
    return {
      shape: 'rectangle',
      width: Number(els.recipeCalcTargetWidth.value || 0),
      depth: Number(els.recipeCalcTargetDepth.value || 0),
      height: Number(els.recipeCalcTargetHeight.value || els.recipeBaseHeight.value || 1)
    };
  }

  return {
    shape: 'round',
    diameter: Number(els.recipeCalcTargetDiameter.value || 0),
    height: Number(els.recipeCalcTargetHeight.value || els.recipeBaseHeight.value || 1)
  };
}

function runRecipeCalcNavigator() {
  const baseSize = getCurrentRecipeBaseSize();
  const targetSize = getRecipeCalcTargetSize();
  const quantity = Number(els.recipeCalcQuantity.value || 1);

  const sizeScale = calcShapeVolumeScale(baseSize, targetSize);
  const finalScale = round2(sizeScale * quantity);

  if (!appState.currentRecipeMaterials.length) {
    alert('換算するレシピ材料がありません。');
    return;
  }

  const rows = appState.currentRecipeMaterials.map(m => `
    <div class="record-sub">
      ${escapeHtml(m.name)}：
      ${round2(Number(m.amountValue || 0) * finalScale)}
      ${escapeHtml(m.amountUnit || '')}
    </div>
  `).join('');

  els.recipeCalcResult.innerHTML = `
    <div class="item-title">換算結果</div>
    <div class="record-sub">サイズ倍率：${sizeScale}倍</div>
    <div class="record-sub">数量込み倍率：${finalScale}倍</div>
    <div class="sub-card">${rows}</div>
  `;
}