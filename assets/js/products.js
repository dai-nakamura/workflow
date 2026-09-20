function resetProductEditor() {
      appState.currentProductId = null; appState.currentProductComponents = []; appState.editingProductComponentIndex = null; els.productName.value = ''; els.productCategory.value = ''; els.productUnitLabel.value = ''; els.productNote.value = ''; closeProductComponentForm(); renderProductComponents(); els.productKind.value = 'other';
      els.productUseReservationSize.value = 'false';
      els.productAliases.value = '';
      els.productSalePrice.value = '';
    }

function refreshProductComponentRefSelect() {
     
      const type = els.productComponentSourceType.value;
 if (type === 'material') {
    refreshProductComponentMaterialFilters();
  }
      let options = ['<option value="">選択してください</option>'];

      if (type === 'recipe') {
        options = options.concat(
          db.recipeMasters.map(x =>
            `<option value="${x.id}">${escapeHtml(x.name)}</option>`
          )
        );
      }

    if (type === 'material') {

  const category =
    els.productComponentCategoryFilter.value;

  const subCategory =
    els.productComponentSubCategoryFilter.value;

  let list = [...db.materialsMaster];

  if (category) {
    list = list.filter(x => x.category === category);
  }

  if (subCategory) {
    list = list.filter(x =>
      x.subCategory === subCategory
    );
  }

  options = options.concat(
    list.map(x =>
      `<option value="${x.id}">
        ${escapeHtml(x.name)}
      </option>`
    )
  );
}

      if (type === 'product') {
        options = options.concat(
          db.productMasters
            .filter(x => x.id !== appState.currentProductId)
            .map(x =>
              `<option value="${x.id}">${escapeHtml(x.name)}</option>`
            )
        );
      }

      if (type === 'task') {
        options = options.concat(
          db.taskMasters.map(x =>
            `<option value="${x.id}">${escapeHtml(x.name)}</option>`
          )
        );
      }

      els.productComponentRefSelect.innerHTML = options.join('');
    }

function openAddProductComponentForm() {
      appState.editingProductComponentIndex = null; els.productComponentSourceType.value = 'recipe'; refreshProductComponentRefSelect(); els.productComponentRefSelect.value = ''; els.productComponentQuantity.value = '1'; els.productComponentUnit.value = ''; els.productComponentFormCard.classList.remove('is-hidden'); els.productComponentDiameter.value = '';
      els.productComponentHeight.value = ''; els.productComponentWidth.value=''; els.productComponentDepth.value=''; els.productComponentShape.value='round'; toggleproductConponentSizeFields();
    }

function closeProductComponentForm() {
      els.productComponentFormCard.classList.add('is-hidden'); appState.editingProductComponentIndex = null; els.productComponentDiameter.value = '';
      els.productComponentHeight.value = '';
    }

function resolveComponentName(type, refId) {
      if (type === 'recipe') return findRecipe(refId)?.name || '';
      if (type === 'material') return db.materialsMaster.find(m => m.id === refId)?.name || '';
      if (type === 'product') return findProduct(refId)?.name || '';
      if (type === 'task') return findTask(refId)?.name || '';
      return '';
    }

function saveProductComponent() {
      const sourceType = els.productComponentSourceType.value;
      const refId = els.productComponentRefSelect.value;
      const quantity = Number(els.productComponentQuantity.value || 0);
      const unit = els.productComponentUnit.value.trim();

      if (!refId) {
        alert('参照先を選択してください。');
        return;
      }

      const item = {
        sourceType,
        refId,
        name: resolveComponentName(sourceType, refId),
        quantity,
        unit,
        size: {
          shape: els.productComponentShape.value || 'round',
          diameter: Number(els.productComponentDiameter.value || 0),
          width: Number(els.productComponentWidth.value || 0),
          depth: Number(els.productComponentDepth.value || 0),
          height: Number(els.productComponentHeight.value || 0)
        }
      };

      if (appState.editingProductComponentIndex === null) {
        appState.currentProductComponents.unshift(item);
      } else {
        appState.currentProductComponents[appState.editingProductComponentIndex] = item;
      }

      renderProductComponents();
      closeProductComponentForm();
    }

function renderProductComponents() {
      els.productComponentsList.innerHTML = '';
      if (!appState.currentProductComponents.length) {
        els.productComponentsEmpty.classList.remove('is-hidden');
        return;
      }

      els.productComponentsEmpty.classList.add('is-hidden');

      appState.currentProductComponents.forEach((item, index) => {
        const sizeText = item.size?.shape === 'rectangle'
          ? ((item.size?.width || item.size?.depth) ? ` / サイズ: ${item.size.width || '-'}×${item.size.depth || '-'}mm${item.size?.height ? ` 高さ${item.size.height}mm` : ''}` : '')
          : (item.size?.diameter ? ` / サイズ: φ${item.size.diameter}mm${item.size?.height ? ` 高さ${item.size.height}mm` : ''}` : '');

        const card = document.createElement('article');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-title">${escapeHtml(item.name)}</div>
      <div class="record-sub">
        種類: ${escapeHtml(item.sourceType)} / 数量: ${round2(item.quantity)}${escapeHtml(item.unit || '')}${escapeHtml(sizeText)}
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-inline edit-productcomponent-btn" type="button" data-index="${index}">開く</button>
        <button class="btn btn-danger btn-inline delete-productcomponent-btn" type="button" data-index="${index}">削除</button>
      </div>
    `;
        els.productComponentsList.appendChild(card);
      });
    }

function handleProductComponentsListClick(e) {
  const edit = e.target.closest('.edit-productcomponent-btn');
  const del = e.target.closest('.delete-productcomponent-btn');
  if (edit) {
    const idx = Number(edit.dataset.index);
    const item = appState.currentProductComponents[idx];
    if (!item) return;
    appState.editingProductComponentIndex = idx;
    els.productComponentSourceType.value = item.sourceType || 'recipe';
    refreshProductComponentRefSelect();
    els.productComponentRefSelect.value = item.refId || '';
    els.productComponentQuantity.value = item.quantity ?? 1;
    els.productComponentUnit.value = item.unit || '';
    els.productComponentShape.value = item.size?.shape || 'round';
    els.productComponentDiameter.value = item.size?.diameter || '';
    els.productComponentWidth.value = item.size?.width || '';
    els.productComponentDepth.value = item.size?.depth || '';
    els.productComponentHeight.value = item.size?.height || '';
    toggleproductConponentSizeFields();
    els.productComponentFormCard.classList.remove('is-hidden');
  }
  if (del) {
    appState.currentProductComponents.splice(Number(del.dataset.index), 1);
    renderProductComponents();
  }
}

function saveProductMaster() {
  const name = els.productName.value.trim();
  if (!name) {
    alert('商品名を入力してください。');
    return;
  }
  const product = {
    id: appState.currentProductId || createId('product'),
    name,
    category: els.productCategory.value.trim(),
    unitLabel: els.productUnitLabel.value.trim(),
    salePrice: Number(els.productSalePrice.value || 0),
    productKind: els.productKind.value,
    useReservationSize: els.productUseReservationSize.value === 'true',
    aliases: els.productAliases.value.split('\n').map(s => s.trim()).filter(Boolean),
    components: deepCopy(appState.currentProductComponents),
    note: els.productNote.value.trim()
  };
  const idx = db.productMasters.findIndex(x => x.id === product.id);
  if (idx === -1) db.productMasters.unshift(product);
  else db.productMasters[idx] = product;
  appState.currentProductId = product.id;
  // 正式名だけでなく登録済みの別名も含めて、既存の未紐付け予約を再判定する。
  // 呼び名が複数の商品マスターに重複する場合は自動紐付けしない。
  const linkedCount = typeof window.autoLinkExactReservationItems === 'function'
    ? window.autoLinkExactReservationItems(product.id)
    : 0;
  refreshAll();
  alert(linkedCount
    ? `商品を保存しました。正式名・別名が一致した未紐付け予約 ${linkedCount}件を自動で紐付けました。`
    : '商品を保存しました。');
}

function loadProductMaster(id) {
      const product = findProduct(id); if (!product) return; appState.currentProductId = product.id; els.productName.value = product.name || ''; els.productSalePrice.value = product.salePrice || ''; els.productCategory.value = product.category || ''; els.productUnitLabel.value = product.unitLabel || ''; els.productName.value = product.name || '';
      els.productCategory.value = product.category || '';

      els.productKind.value = product.productKind || 'other';

      els.productUseReservationSize.value =
        product.useReservationSize ? 'true' : 'false';

      els.productAliases.value =
        (product.aliases || []).join('\n');

      els.productNote.value = product.note || ''; els.productNote.value = product.note || ''; appState.currentProductComponents = deepCopy(product.components || []); renderProductComponents(); activateTab('products');
   refreshProductComponentMaterialFilters();
    }

function deleteProductMaster(id) { if (!confirm('この商品を削除しますか？')) return; db.productMasters = db.productMasters.filter(x => x.id !== id); if (appState.currentProductId === id) resetProductEditor(); refreshAll(); }

function renderProductList() {
      els.productCountBadge.textContent = `${db.productMasters.length}件`;
      els.productList.innerHTML = '';

      if (!db.productMasters.length) {
        els.productList.innerHTML = '<div class="empty-box">まだ商品がありません。</div>';
        return;
      }

      db.productMasters.forEach(product => {
        const cost = calcProductCost(product);

        const card = document.createElement('article');
        card.className = 'item-card';

        card.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(product.name)}</div>

        <div class="record-sub">
          ${escapeHtml(product.category || '')} / 単位: ${escapeHtml(product.unitLabel || '')}
        </div>

        <div class="record-sub">
          構成 ${product.components?.length || 0}件
        </div>

        <div class="record-sub">
          原価: ${round2(cost.cost)}円 /
          売価: ${round2(cost.salePrice)}円 /
          原価率: ${round2(cost.costRate)}% /
          粗利: ${round2(cost.profit)}円
        </div>
      </div>

      <div class="item-actions">
        <button class="btn btn-secondary btn-inline load-product-btn" type="button" data-id="${product.id}">
          開く
        </button>

        <button class="btn btn-secondary btn-inline duplicate-product-btn" type="button" data-id="${product.id}">
  複製
</button>

        <button class="btn btn-danger btn-inline delete-product-btn" type="button" data-id="${product.id}">
          削除
        </button>
      </div>
    `;

        els.productList.appendChild(card);
      });
    }

function handleProductListClick(e) {
      const load = e.target.closest('.load-product-btn'); const duplicate = e.target.closest('.duplicate-product-btn'); const del = e.target.closest('.delete-product-btn'); if (load) loadProductMaster(load.dataset.id); if (duplicate) {
        duplicateProductToEditor(duplicate.dataset.id);
      } if (del) deleteProductMaster(del.dataset.id);
    }

function duplicateProductToEditor(productId) {
      const product = db.productMasters.find(p => p.id === productId);
      if (!product) return;

      appState.currentProductId = null;

      els.productName.value = `${product.name || ''} コピー`;
      els.productCategory.value = product.category || '';
      els.productUnitLabel.value = product.unitLabel || '';

      if (els.productKind) {
        els.productKind.value = product.productKind || 'other';
      }

      if (els.productUseReservationSize) {
        els.productUseReservationSize.value =
          product.useReservationSize ? 'true' : 'false';
      }

      if (els.productAliases) {
        els.productAliases.value = (product.aliases || []).join('\n');
      }

      if (els.productSalePrice) {
        els.productSalePrice.value = product.salePrice || '';
      }

      els.productNote.value = product.note || '';

      appState.currentProductComponents =
        deepCopy(product.components || []);

      renderProductComponents();
      activateTab('products');

      alert('商品を複製しました。名前を変更して保存してください。');
    }

function normalizeCostUnit(unit) {
  const raw = String(unit || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'g' || raw === 'ｇ') return 'g';
  if (lower === 'kg' || raw === '㎏') return 'kg';
  if (lower === 'ml' || raw === '㎖') return 'ml';
  if (lower === 'l' || raw === 'ℓ') return 'l';
  return raw;
}

function convertCostAmount(amount, fromUnit, toUnit) {
  const value = Number(amount || 0);
  const from = normalizeCostUnit(fromUnit);
  const to = normalizeCostUnit(toUnit);
  if (!from || !to || from === to) return value;

  const mass = { g: 1, kg: 1000 };
  const volume = { ml: 1, l: 1000 };
  if (mass[from] && mass[to]) return value * mass[from] / mass[to];
  if (volume[from] && volume[to]) return value * volume[from] / volume[to];
  return null;
}

function hasComponentSize(size) {
  if (!size) return false;
  return Number(size.diameter || 0) > 0 ||
    (Number(size.width || 0) > 0 && Number(size.depth || 0) > 0);
}

function calcProductComponentCost(component, visitedProductIds = new Set()) {
  const quantity = Number(component?.quantity || 0);
  if (!component || !component.sourceType) return { cost: 0, scale: 0, note: '構成情報なし' };

  if (component.sourceType === 'material') {
    const material = db.materialsMaster.find(m => m.id === component.refId);
    if (!material) return { cost: 0, scale: 0, note: '材料未登録' };
    const converted = convertCostAmount(quantity, component.unit, material.baseUnit);
    if (converted === null) return { cost: 0, scale: 0, note: `単位不一致: ${component.unit || '-'} → ${material.baseUnit || '-'}` };
    return {
      cost: unitCostFromMaterial(material) * converted,
      scale: converted,
      note: `${round2(converted)}${material.baseUnit || ''}`
    };
  }

  if (component.sourceType === 'recipe') {
    const recipe = findRecipe(component.refId);
    if (!recipe) return { cost: 0, scale: 0, note: 'レシピ未登録' };

    const recipeCost = Number(calculateRecipeCost(recipe) || 0);
    const yieldQuantity = Number(recipe.yieldQuantity || 0);
    let requiredQuantity = quantity;
    let unitNote = '';

    if (yieldQuantity > 0 && component.unit && recipe.yieldUnit) {
      const converted = convertCostAmount(quantity, component.unit, recipe.yieldUnit);
      if (converted !== null) {
        requiredQuantity = converted;
        unitNote = `${round2(converted)}${recipe.yieldUnit}`;
      } else if (normalizeCostUnit(component.unit) !== normalizeCostUnit(recipe.yieldUnit)) {
        return { cost: 0, scale: 0, note: `単位不一致: ${component.unit} → ${recipe.yieldUnit}` };
      }
    }

    const quantityScale = yieldQuantity > 0 ? requiredQuantity / yieldQuantity : requiredQuantity;
    const sizeScale = hasComponentSize(component.size) && recipe.baseSize
      ? Number(calcSizeScale(recipe.baseSize, component.size) || 1)
      : 1;
    const scale = quantityScale * sizeScale;

    return {
      cost: recipeCost * scale,
      scale,
      note: `${round2(scale)}倍${unitNote ? ` (${unitNote} / 出来高${round2(yieldQuantity)}${recipe.yieldUnit || ''})` : ''}`
    };
  }

  if (component.sourceType === 'product') {
    const nested = findProduct(component.refId);
    if (!nested || visitedProductIds.has(nested.id)) return { cost: 0, scale: 0, note: '商品参照エラー' };
    const nextVisited = new Set(visitedProductIds);
    nextVisited.add(nested.id);
    const nestedCost = calcProductCost(nested, nextVisited).cost;
    return { cost: nestedCost * quantity, scale: quantity, note: `${round2(quantity)}倍` };
  }

  return { cost: 0, scale: quantity, note: '原価対象外' };
}

function calcProductCost(product, visitedProductIds = new Set()) {
  const ownVisited = new Set(visitedProductIds);
  if (product?.id) ownVisited.add(product.id);

  const breakdown = (product.components || []).map(component => {
    const result = calcProductComponentCost(component, ownVisited);
    return {
      name: component.name || resolveComponentName(component.sourceType, component.refId) || '名称未設定',
      sourceType: component.sourceType || '',
      quantity: Number(component.quantity || 0),
      unit: component.unit || '',
      cost: round2(result.cost || 0),
      scale: result.scale,
      note: result.note || ''
    };
  });

  const totalCost = round2(breakdown.reduce((sum, item) => sum + Number(item.cost || 0), 0));
  const salePrice = Number(product.salePrice || 0);

  return {
    cost: totalCost,
    salePrice,
    costRate: salePrice > 0 ? (totalCost / salePrice) * 100 : 0,
    profit: salePrice - totalCost,
    breakdown
  };
}

function previewCurrentProductCost() {
  const product = {
    salePrice: Number(els.productSalePrice.value || 0),
    components: deepCopy(appState.currentProductComponents)
  };
  const result = calcProductCost(product);
  const lines = (result.breakdown || []).map(item =>
    `${item.name}: ${round2(item.cost)}円${item.note ? ` / ${item.note}` : ''}`
  );
  alert(
    `${lines.length ? lines.join('\n') + '\n\n' : ''}` +
    `概算原価: ${round2(result.cost)}円\n` +
    `売価: ${round2(result.salePrice)}円\n` +
    `原価率: ${round2(result.costRate)}%\n` +
    `粗利: ${round2(result.profit)}円`
  );
}

function refreshProductComponentMaterialFilters() {
  if (!els.productComponentCategoryFilter || !els.productComponentSubCategoryFilter) return;

  const currentCategory = els.productComponentCategoryFilter.value;
  const currentSubCategory = els.productComponentSubCategoryFilter.value;

  const categories = [...new Set(
    db.materialsMaster
      .map(mat => mat.category || '')
      .filter(Boolean)
  )];

  els.productComponentCategoryFilter.innerHTML =
    '<option value="">すべて</option>' +
    categories.map(cat =>
      `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    ).join('');

  els.productComponentCategoryFilter.value = currentCategory;

  const subCategories = [...new Set(
    db.materialsMaster
      .filter(mat => !currentCategory || mat.category === currentCategory)
      .map(mat => mat.subCategory || mat.subcategory || '')
      .filter(Boolean)
  )];

  els.productComponentSubCategoryFilter.innerHTML =
    '<option value="">すべて</option>' +
    subCategories.map(sub =>
      `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`
    ).join('');

  els.productComponentSubCategoryFilter.value = currentSubCategory;
}

function mergeProductsByName(currentList, importedList) {
      const map = new Map();

      currentList.forEach(product => {
        const key = String(product.name || '').trim();
        if (key) map.set(key, product);
      });

      importedList.forEach(product => {
        const key = String(product.name || '').trim();
        if (!key) return;

        const existing = map.get(key);

        if (existing) {
          map.set(key, {
            ...existing,
            ...product,

            id: existing.id,

            components:
              Array.isArray(product.components)
                ? product.components
                : existing.components,

            aliases:
              Array.isArray(product.aliases)
                ? product.aliases
                : existing.aliases
          });
        } else {
          map.set(key, {
            ...product,
            id: product.id || createId('product')
          });
        }
      });

      return Array.from(map.values());
    }
