function aggregateOrderItems() {
      const recipeMap = new Map();
      const taskMap = new Map();
      const materialMap = new Map();
      const unmatchedItems = [];
      function addMaterialNeed(materialId, count, unit, eventDate) {
        const mat = db.materialsMaster.find(m => m.id === materialId);
        if (!mat) return;

        const cur = materialMap.get(materialId) || {
          materialId,
          materialName: mat.name,
          requiredQuantity: 0,
          unit: unit || mat.baseUnit || '',
          eventDate
        };

        cur.requiredQuantity += Number(count || 0);
        if (eventDate) cur.eventDate = eventDate;

        materialMap.set(materialId, cur);
      }

      function addRecipeNeed(recipeId, neededQty, neededUnit, eventDate, order) {
        const recipe = findRecipe(recipeId);
        if (!recipe) return;

        const cur = recipeMap.get(recipeId) || {
          recipeId,
          recipeName: recipe.name,
          requiredQuantity: 0,
          requiredUnit: neededUnit || recipe.yieldUnit || '',
          yieldQuantity: Number(recipe.yieldQuantity || 0),
          yieldUnit: recipe.yieldUnit || '',
          eventDate,
          sourceOrders: []
        };

        cur.requiredQuantity += Number(neededQty || 0);
        if (eventDate) cur.eventDate = eventDate;

        if (order) {
          cur.sourceOrders.push({
            orderId: order.id,
            customer: order.customer || '',
            date: order.date || '',
            productName: order.productName || ''
          });
        }

        recipeMap.set(recipeId, cur);
      }

      function addTaskNeed(taskId, count, unit, eventDate, order) {
        const task = findTask(taskId);
        if (!task) return;

        const cur = taskMap.get(taskId) || {
          taskId,
          taskName: task.name,
          requiredCount: 0,
          unit: unit || '回',
          defaultDurationMinutes: task.defaultDurationMinutes || 0,
          equipment: task.equipment || '',
          canParallel: !!task.canParallel,
          eventDate,
          sourceOrders: []
        };

        cur.requiredCount += Number(count || 0);
        if (eventDate) cur.eventDate = eventDate;

        if (order) {
          cur.sourceOrders.push({
            orderId: order.id,
            customer: order.customer || '',
            date: order.date || '',
            productName: order.productName || ''
          });
        }

        taskMap.set(taskId, cur);
      }

      function expandProduct(productId, multiplier, eventDate, order) {
        const product = findProduct(productId);
        if (!product) return;

        (product.components || []).forEach(component => {
          const qty = Number(component.quantity || 0) * Number(multiplier || 0);

          if (component.sourceType === 'recipe') {
            const recipe = findRecipe(component.refId);
            if (!recipe) return;

            const sizeScale = calcSizeScale(recipe.baseSize, component.size);
            const finalQty = qty * sizeScale;

            addRecipeNeed(component.refId, finalQty, component.unit, eventDate, order);
          }
          else if (component.sourceType === 'material') {
            addMaterialNeed(component.refId, qty, component.unit, eventDate);
          }
          else if (component.sourceType === 'task') {
            addTaskNeed(component.refId, qty, component.unit, eventDate, order);
          }
          else if (component.sourceType === 'product') {
            expandProduct(component.refId, qty, eventDate, order);
          }
        });
      }

      db.orderItems.forEach(order => {
        const product = findProductForOrderItem(order);

        if (product) {
          expandProduct(
            product.id,
            Number(order.quantity || 0),
            order.date,
            order
          );
          return;
        }

        unmatchedItems.push({
          orderId: order.id || '',
          sourceOrderId: order.sourceOrderId || '',
          sourceOrderItemId: order.sourceOrderItemId || '',
          productName: order.productName || '商品名なし',
          quantity: Number(order.quantity || 0),
          unit: order.unit || '点',
          date: order.date || '',
          customer: order.customer || '',
          memo: order.memo || order.notes || ''
        });
      });

      return {
        recipeTotals: Array.from(recipeMap.values()).map(item => ({
          ...item,
          requiredScale: item.yieldQuantity > 0
            ? ceil2(item.requiredQuantity / item.yieldQuantity)
            : 0
        })),
        taskTotals: Array.from(taskMap.values()),
        materialTotals: Array.from(materialMap.values()),
        unmatchedItems
      };
    }

function runAggregate() { appState.aggregateResult = aggregateOrderItems(); renderAggregate(); alert('集計しました。'); }

function renderAggregate() {
      const recipeTotals = appState.aggregateResult.recipeTotals || [], taskTotals = appState.aggregateResult.taskTotals || []; els.aggregateRecipeCountBadge.textContent = `${recipeTotals.length}件`; els.aggregateTaskCountBadge.textContent = `${taskTotals.length}件`; els.aggregateRecipeList.innerHTML = recipeTotals.length ? '' : '<div class="empty-box">まだ集計していません。</div>'; recipeTotals.forEach(item => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(item.recipeName)}</div><div class="record-sub">必要数: ${round2(item.requiredQuantity)}${escapeHtml(item.requiredUnit)}</div><div class="record-sub">出来高: ${round2(item.yieldQuantity || 0)}${escapeHtml(item.yieldUnit)}</div><div class="record-sub">必要倍率: ${item.requiredScale}倍 / 施工日 ${escapeHtml(item.eventDate || '-')}</div></div>`; els.aggregateRecipeList.appendChild(card); }); els.aggregateTaskList.innerHTML = taskTotals.length ? '' : '<div class="empty-box">必要作業はまだありません。</div>'; taskTotals.forEach(item => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(item.taskName)}</div><div class="record-sub">必要数: ${round2(item.requiredCount)}${escapeHtml(item.unit)}</div><div class="record-sub">所要時間目安: ${item.defaultDurationMinutes}分 / 設備: ${escapeHtml(item.equipment || '未設定')} / 施工日 ${escapeHtml(item.eventDate || '-')}</div></div>`; els.aggregateTaskList.appendChild(card); }); const unmatchedItems = appState.aggregateResult.unmatchedItems || [];

      if (unmatchedItems.length) {
        alert(
          '未紐付けの商品があります。\n商品マスターに登録するか、productNameを既存商品名と合わせてください。\n\n' +
          unmatchedItems.map(item =>
            `${item.date || '-'} / ${item.productName} × ${item.quantity}${item.unit}`
          ).join('\n')
        );
      }
    }

function scaleRecipeMaterials(recipe, scale) { return (recipe.materials || []).map(m => ({ materialId: m.materialId || null, name: m.name, baseAmountValue: Number(m.amountValue || 0), amountUnit: m.amountUnit, scale, scaledAmountValue: round2(Number(m.amountValue || 0) * scale), note: m.note || '' })); }

function createBatchesFromAggregate() {
      const recipeTotals = appState.aggregateResult.recipeTotals || []; if (!recipeTotals.length) { alert('先に集計してください。'); return; } recipeTotals.forEach(total => {
        const recipe = findRecipe(total.recipeId); if (!recipe) return; db.productionBatches.unshift({
          id: createId('batch'), recipeId: recipe.id, recipeName: recipe.name, name: `${recipe.name} ${total.requiredScale}倍`, date: total.eventDate || getTodayString(), sourceOrders: total.sourceOrders || [], scale: total.requiredScale, requiredQuantity: total.requiredQuantity, requiredUnit: total.requiredUnit, yieldQuantity: recipe.yieldQuantity || 0, yieldUnit: recipe.yieldUnit || '', materials: scaleRecipeMaterials(recipe, total.requiredScale), flows: deepCopy(recipe.flows || []).map((flow, idx) => ({ ...flow, flowOrder: idx, batchName: `${recipe.name} ${total.requiredScale}倍`, recipeName: recipe.name, scale: total.requiredScale })), memo: '集計から自動生成', sourceOrders: deepCopy(total.sourceOrders || []),
          createdAt: new Date().toISOString()
        });
      }); refreshAll(); alert('製造バッチを作成しました。'); activateTab('production');
    }

function createUnlinkedBatchesFromOrderItems() {
      const unlinkedItems = db.orderItems.filter(item => {
        return !item.productId || !findProduct(item.productId);
      });

      unlinkedItems.forEach(item => {
        const alreadyExists = db.productionBatches.some(batch =>
          batch.sourceOrderItemId === item.id
        );

        if (alreadyExists) return;

        db.productionBatches.unshift({
          id: createId('batch'),
          recipeId: null,
          recipeName: '未紐付け',
          name: `未紐付け：${item.productName || '商品名未入力'}`,
          date: item.date || item.eventDate || getTodayString(),
          scale: 1,
          requiredQuantity: Number(item.quantity || 0),
          requiredUnit: item.unit || '',
          yieldQuantity: 0,
          yieldUnit: '',
          materials: [],
          flows: [],
          sourceOrderItemId: item.id,
          sourceOrderId: item.orderId || '',
          sourceOrders: [{
            orderId: item.orderId || '',
            orderItemId: item.id,
            customer: item.customer || '',
            date: item.date || '',
            productName: item.productName || ''
          }],
          memo: '商品マスター未紐付けの仮バッチ',
          createdAt: new Date().toISOString()
        });
      });

      refreshAll();
      alert('未紐付け仮バッチを作成しました。');
      activateTab('production');
    }

function renderBatchList() {
      els.batchCountBadge.textContent = `${db.productionBatches.length}件`; els.batchList.innerHTML = ''; if (!db.productionBatches.length) { els.batchList.innerHTML = '<div class="empty-box">まだ製造バッチがありません。</div>'; return; } db.productionBatches.forEach(batch => {
        const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(batch.name)}</div><div class="record-sub">${escapeHtml(batch.recipeName)} / 必要 ${round2(batch.requiredQuantity || 0)}${escapeHtml(batch.requiredUnit || '')}</div><div class="record-sub">施工日 ${escapeHtml(batch.date || '-')} / 倍率 ${batch.scale}倍</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline open-batch-btn" type="button" data-id="${batch.id}">詳細</button><button class="btn btn-secondary btn-inline view-batch-btn" data-id="${batch.id}">
詳細
</button><button class="btn btn-secondary btn-inline use-batch-btn" type="button" data-id="${batch.id}">段取りへ</button><button class="btn btn-danger btn-inline delete-batch-btn" type="button" data-id="${batch.id}">削除</button></div>`; els.batchList.appendChild(card);
      });
    }

function showBatchDetail(id) {
      const batch = db.productionBatches.find(x => x.id === id); if (!batch) return; appState.currentBatchId = id; const materialsHtml = (batch.materials || []).length ? batch.materials.map(m => `<div class="record-sub">${escapeHtml(m.name)} : ${round2(m.scaledAmountValue)}${escapeHtml(m.amountUnit)}</div>`).join('') : '<div class="record-sub">材料なし</div>'; const flowsHtml = (batch.flows || []).length ? batch.flows.map(f => `<div class="record-sub">${escapeHtml(f.title)} / ${f.durationMinutes || 0}分 / ${escapeHtml(f.type || '')}</div>`).join('') : '<div class="record-sub">工程なし</div>'; els.batchDetailView.innerHTML = `<div class="stack-form"><div><strong>${escapeHtml(batch.name)}</strong></div><div class="record-sub">元レシピ: ${escapeHtml(batch.recipeName || '')}</div><div class="record-sub">施工日: ${escapeHtml(batch.date || '')}</div><div class="record-sub">  
      予約:  
      ${(batch.sourceOrders || []).length
          ? batch.sourceOrders.map(o =>
            `${escapeHtml(o.customer)} / ${escapeHtml(o.productName)}`
          ).join('<br>')
          : 'なし'}  
    </div>  <div class="record-sub">必要数: ${round2(batch.requiredQuantity || 0)}${escapeHtml(batch.requiredUnit || '')}</div><div class="record-sub">倍率: ${batch.scale || 0}倍</div><div class="record-sub">メモ: ${escapeHtml(batch.memo || '')}</div><div><strong>再計算材料</strong><div>${materialsHtml}</div></div><div><strong>工程</strong><div>${flowsHtml}</div></div></div>`;
    }

function handleBatchListClick(e) {
      const open = e.target.closest('.open-batch-btn');
      const view = e.target.closest('.view-batch-btn');

      if (view) {
        const batch = db.productionBatches.find(b => b.id === view.dataset.id);
        if (!batch) return;

        els.batchDetailView.innerHTML = `
      <div class="item-main">
        <div class="item-title">
          ${escapeHtml(batch.title || batch.name || batch.productName || '製造バッチ')}
        </div>

        <div class="record-sub">
          日付: ${escapeHtml(batch.eventDate || batch.date || '-')}
        </div>

        <div class="record-sub">
          数量: ${round2(batch.quantity || 0)}${escapeHtml(batch.unit || '')}
        </div>

        <div class="record-sub">
          状態: ${escapeHtml(batch.status || '-')}
        </div>

        ${batch.note ? `
          <div class="sub-card">
            ${escapeHtml(batch.note)}
          </div>
        ` : ''}

        ${(batch.sourceOrders || []).length ? `
          <div class="sub-card">
            <div class="item-title">注文情報</div>
            ${batch.sourceOrders.map(o => `
              <div class="record-sub">
                ${escapeHtml(o.customer || '')}
                ${o.productName ? ' / ' + escapeHtml(o.productName) : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${(batch.recipeItems || []).length ? `
          <div class="sub-card">
            <div class="item-title">必要レシピ</div>
            ${batch.recipeItems.map(recipe => `
              <div class="record-sub">
                ${escapeHtml(recipe.recipeName || 'レシピ未設定')}
                / 数量: ${round2(recipe.quantity || 0)}
                ${recipe.unit ? escapeHtml(recipe.unit) : ''}
                / サイズ倍率: ${round2(recipe.sizeScale || 1)}
                / 最終倍率: ${round2(recipe.scale || 1)}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${(batch.taskItems || []).length ? `
          <div class="sub-card">
            <div class="item-title">必要作業</div>
            ${batch.taskItems.map(task => `
              <div class="record-sub">
                ${escapeHtml(task.taskName || '作業未設定')}
                / ${round2(task.durationMinutes || 0)}分
                ${task.equipment ? ' / 設備: ' + escapeHtml(task.equipment) : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
      }

      const use = e.target.closest('.use-batch-btn');
      const del = e.target.closest('.delete-batch-btn');

      if (open) {
        showBatchDetail(open.dataset.id);
      }

      if (use) {
        appState.currentBatchId = use.dataset.id;
        activateTab('schedule');
        loadScheduleCandidates();
      }

      if (del) {
        if (!confirm('このバッチを削除しますか？')) return;
        db.productionBatches = db.productionBatches.filter(x => x.id !== del.dataset.id);
        if (appState.currentBatchId === del.dataset.id) {
          els.batchDetailView.innerHTML = 'バッチを選ぶと詳細がここに出ます。';
        }
        refreshAll();
      }
    }
