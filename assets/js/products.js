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
      els.productComponentHeight.value = '';
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
          shape: els.productComponentshape.value || 'round',
          diameter: Number(els.productComponentDiameter.value || 0),
          width: Number(els.productComponentwidth.value || 0),
          depth: Number(els.productComponentdepth.value || 0),
          height: Number(els.productComponentheight.value || 0)
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
        const sizeText =
          item.size?.diameter
            ? ` / サイズ: ${item.size.diameter}mm${item.size?.height ? `×${item.size.height}mm` : ''}`
            : '';

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
      const edit = e.target.closest('.edit-productcomponent-btn'); const del = e.target.closest('.delete-productcomponent-btn'); if (edit) { const idx = Number(edit.dataset.index); const item = appState.currentProductComponents[idx]; if (!item) return; appState.editingProductComponentIndex = idx; els.productComponentSourceType.value = item.sourceType; refreshProductComponentRefSelect(); els.productComponentRefSelect.value = item.refId || ''; els.productComponentQuantity.value = item.quantity ?? 1; els.productComponentUnit.value = item.unit || ''; els.productComponentFormCard.classList.remove('is-hidden'); } if (del) { appState.currentProductComponents.splice(Number(del.dataset.index), 1); renderProductComponents(); } els.productComponentDiameter.value = item.size?.diameter || '';
      els.productComponentHeight.value = item.size?.height || '';
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
  refreshAll();
  alert('商品を保存しました。');
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

function calcProductCost(product) {
      let totalCost = 0;

      (product.components || []).forEach(component => {
        if (component.sourceType !== 'recipe') return;

        const recipe = findRecipe(component.refId);
        if (!recipe) return;

        const recipeCost = calculateRecipeCost(recipe);
        const quantity = Number(component.quantity || 1);

        totalCost += recipeCost * quantity;
      });

      const salePrice = Number(product.salePrice || els.productSalePrice?.value || 0);

      return {
        cost: totalCost,
        salePrice,
        costRate: salePrice > 0 ? (totalCost / salePrice) * 100 : 0,
        profit: salePrice - totalCost
      };
    }

function previewCurrentProductCost() {
  const product = {
    salePrice: Number(els.productSalePrice.value || 0),
    components: deepCopy(appState.currentProductComponents)
  };
  const result = calcProductCost(product);
  alert(
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
