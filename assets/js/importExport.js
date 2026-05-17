function exportJson() { const payload = JSON.stringify(db, null, 2); const blob = new Blob([payload], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `production-design-final-${getTodayString()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

function importJsonFile(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { importParsedJson(JSON.parse(reader.result), 'merge'); } catch (e) { console.error(e); alert('JSONの読み込みに失敗しました。'); } finally { event.target.value = ''; } }; reader.readAsText(file, 'utf-8'); }

function importJsonFromText(mode) { const raw = els.jsonPasteArea.value.trim(); if (!raw) { alert('JSONを貼ってください。'); return; } try { importParsedJson(JSON.parse(raw), mode); if (mode === 'merge') els.jsonPasteArea.value = ''; } catch (e) { console.error(e); alert('JSON形式が正しくありません。'); } }

function normalizeImportedRecipe(data) {
      const normalizedMaterials = Array.isArray(data.materials)
        ? data.materials.map(item => ({
          materialId: item.materialId || null,
          name: item.name || '',
          amountValue: Number(item.amountValue || 0),
          amountUnit: item.amountUnit || 'g',
          note: item.note || ''
        }))
        : [];

      return {
        name: data.name || '',
        type: data.type || '試作',
        date: data.date || getTodayString(),
        owner: data.owner || '',
        memo: data.memo || '',
        yieldQuantity: Number(data.yieldQuantity || 0),
        yieldUnit: data.yieldUnit || '個',
        size: {
          diameter: Number(data.size?.diameter || 0),
          height: Number(data.size?.height || 0)
        },
        materials: attachMaterialIdsToRecipeMaterials(normalizedMaterials),
        flows: Array.isArray(data.flows)
          ? data.flows.map(flow => ({
            title: flow.title || '',
            description: flow.description || '',
            durationMinutes: Number(flow.durationMinutes || 0),
            type: flow.type || 'other',
            canParallel: !!flow.canParallel,
            equipment: flow.equipment || '',
            checks: Array.isArray(flow.checks) ? flow.checks : []
          }))
          : []
      };
    }

function importMaterialsArray(arr, mode) { const list = arr.map(item => ({ id: createId('mat'), name: item.name || '', baseAmount: Number(item.lot ?? item.baseAmount ?? 0), baseUnit: item.unit || item.baseUnit || 'g', basePrice: Number(item.price ?? item.basePrice ?? 0), category: item.subcategory || item.category || '', supplier: item.supplier || '', note: item.note || '' })); db.materialsMaster = mode === 'replace' ? list : mergeById(db.materialsMaster, list, 'mat'); refreshAll(); alert(mode === 'replace' ? '材料マスターを置換読込しました。' : '材料マスターを追加読込しました。'); activateTab('materials'); }

function importReservationJson(parsed, mode = 'merge') {
      if (!parsed || typeof parsed !== 'object') {
        alert('予約JSONではありません。');
        return;
      }

      if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.orderItems)) {
        alert('orders と orderItems が必要です。');
        return;
      }

      const normalizedOrders = parsed.orders.map(order => ({
        id: order.id || createId('ord'),
        date: order.date || getTodayString(),
        customer: order.customer || '',
        category: order.category || '',
        venue: order.venue || '',
        notes: order.notes || '',
        importedAt: new Date().toISOString()
      }));

      const orderMap = new Map(normalizedOrders.map(o => [o.id, o]));

      const normalizedItems = parsed.orderItems.map(item => {
        const parent = orderMap.get(item.orderId);

        return {
          id: item.id || createId('orditem'),
          orderId: item.orderId || '',
          productId: item.productId || '',
          productName: item.productName || '都度オリジナル商品',
          quantity: Number(item.quantity || 0),
          unit: item.unit || '点',
          category: item.category || parent?.category || '',
          size: item.size || '',
          multiSize: item.multiSize || '',
          options: Array.isArray(item.options) ? item.options : [],
          notes: item.notes || '',
          date: parent?.date || getTodayString(),
          customer: parent?.customer || '',
          venue: parent?.venue || '',
          sourceOrderId: item.orderId || '',
          sourceOrderItemId: item.id || '',
          isCustomProduct: !item.productId
        };
      });

      if (mode === 'replace') {
        db.orders = normalizedOrders;
        db.orderItems = normalizedItems;
      } else {
        db.orders = mergeById(db.orders || [], normalizedOrders, 'ord');

        const existingSourceIds = new Set(
          (db.orderItems || []).map(x => x.sourceOrderItemId || x.id)
        );

        const newItems = normalizedItems.filter(item => {
          const key = item.sourceOrderItemId || item.id;
          return !existingSourceIds.has(key);
        });

        db.orderItems = mergeById(db.orderItems || [], newItems, 'orditem');
      }

      refreshAll();
      activateTab('orders');
      alert('予約JSONを取り込みました。');
    }

function importParsedJson(parsed, mode = 'merge') {
      if (!parsed || typeof parsed !== 'object') {
        alert('読み込めるJSONではありません。');
        return;
      }

      // 配列JSON：材料マスター配列 or 予約アプリ配列
      if (Array.isArray(parsed)) {
        if (
          parsed.every(item =>
            item &&
            typeof item === 'object' &&
            ('name' in item) &&
            (('price' in item) || ('lot' in item) || ('unitPrice' in item))
          )
        ) {
          importMaterialsArray(parsed, mode);
          return;
        }

        // 予約管理アプリの配列形式
        if (
          parsed.every(item =>
            item &&
            typeof item === 'object' &&
            Array.isArray(item.items) &&
            ('clientName' in item || 'category' in item || 'venue' in item)
          )
        ) {
          const payload = convertReservationAppOrdersToPayload(parsed);
          importReservationData(payload);
          return;
        }

        alert('この配列JSONは未対応です。');
        return;
      }

      // 全体バックアップJSON
      const isFullBackup =
        Array.isArray(parsed.materialsMaster) ||
        Array.isArray(parsed.recipeMasters) ||
        Array.isArray(parsed.productMasters) ||
        Array.isArray(parsed.orders) ||
        Array.isArray(parsed.orderItems) ||
        Array.isArray(parsed.productionBatches) ||
        Array.isArray(parsed.taskMasters) ||
        Array.isArray(parsed.schedulePlans) ||
        Array.isArray(parsed.planItems) ||
        Array.isArray(parsed.reservationOrders) ||
        Array.isArray(parsed.reservationOrderItems);

      if (isFullBackup) {
        if (mode === 'replace') {
          db.materialsMaster = Array.isArray(parsed.materialsMaster) ? parsed.materialsMaster : [];
          db.recipeMasters = Array.isArray(parsed.recipeMasters) ? parsed.recipeMasters : [];
          db.productMasters = Array.isArray(parsed.productMasters) ? parsed.productMasters : [];

          db.orders = Array.isArray(parsed.orders) ? parsed.orders : [];
          db.orderItems = Array.isArray(parsed.orderItems) ? parsed.orderItems : [];

          db.productionBatches = Array.isArray(parsed.productionBatches) ? parsed.productionBatches : [];
          db.taskMasters = Array.isArray(parsed.taskMasters) && parsed.taskMasters.length ? parsed.taskMasters : db.taskMasters;
          db.schedulePlans = Array.isArray(parsed.schedulePlans) ? parsed.schedulePlans : [];
          db.planItems = Array.isArray(parsed.planItems) ? parsed.planItems : [];

          db.reservationOrders = Array.isArray(parsed.reservationOrders) ? parsed.reservationOrders : [];
          db.reservationOrderItems = Array.isArray(parsed.reservationOrderItems) ? parsed.reservationOrderItems : [];
        } else {
          db.materialsMaster = mergeMaterialsByName(
            db.materialsMaster,
            Array.isArray(parsed.materialsMaster) ? parsed.materialsMaster : []
          );

          db.recipeMasters = mergeById(
            db.recipeMasters,
            Array.isArray(parsed.recipeMasters) ? parsed.recipeMasters : [],
            'recipe'
          );

          db.productMasters = mergeProductsByName(
            db.productMasters,
            Array.isArray(parsed.productMasters)
              ? parsed.productMasters
              : []
          );

          db.orders = mergeById(
            db.orders,
            Array.isArray(parsed.orders) ? parsed.orders : [],
            'order'
          );

          db.orderItems = mergeById(
            db.orderItems,
            Array.isArray(parsed.orderItems) ? parsed.orderItems : [],
            'orditem'
          );

          db.productionBatches = mergeById(
            db.productionBatches,
            Array.isArray(parsed.productionBatches) ? parsed.productionBatches : [],
            'batch'
          );

          db.schedulePlans = mergeById(
            db.schedulePlans,
            Array.isArray(parsed.schedulePlans) ? parsed.schedulePlans : [],
            'plan'
          );

          db.planItems = mergeById(
            db.planItems,
            Array.isArray(parsed.planItems) ? parsed.planItems : [],
            'planitem'
          );

          db.reservationOrders = mergeById(
            db.reservationOrders,
            Array.isArray(parsed.reservationOrders) ? parsed.reservationOrders : [],
            'resord'
          );

          db.reservationOrderItems = mergeById(
            db.reservationOrderItems,
            Array.isArray(parsed.reservationOrderItems) ? parsed.reservationOrderItems : [],
            'resitem'
          );

          if (Array.isArray(parsed.taskMasters) && parsed.taskMasters.length) {
            db.taskMasters = mergeById(db.taskMasters, parsed.taskMasters, 'task');
          }
        }

        db.recipeMasters = db.recipeMasters.map(recipe => ({
          ...recipe,
          materials: attachMaterialIdsToRecipeMaterials(recipe.materials || [])
        }));

        refreshAll();

        alert(
          mode === 'replace'
            ? '全体JSONを置換読込しました。'
            : '全体JSONを追加読込しました。'
        );

        return;
      }

      // 予約管理アプリ：{ orders: [...] } 形式
      if (Array.isArray(parsed.orders)) {
        const looksLikeReservationApp = parsed.orders.some(order =>
          Array.isArray(order.items) ||
          'clientName' in order ||
          'allergyMaster' in order
        );

        if (looksLikeReservationApp) {
          const payload = convertReservationAppOrdersToPayload(parsed.orders);
          importReservationData(payload);
          return;
        }
      }

      // 単体レシピJSON
      if (parsed.name && Array.isArray(parsed.materials)) {
        const recipe = normalizeImportedRecipe(parsed);

        appState.currentRecipeId = null;
        els.recipeName.value = recipe.name || '';
        els.recipeType.value = recipe.type || '試作';
        els.recipeDate.value = recipe.date || getTodayString();
        els.recipeOwner.value = recipe.owner || '';
        els.recipeYieldQuantity.value = recipe.yieldQuantity || 0;
        els.recipeMemo.value = recipe.memo || '';

        const presetUnits = getRecipeYieldPresetValues();

        if (presetUnits.includes(recipe.yieldUnit)) {
          els.recipeYieldUnit.value = recipe.yieldUnit || '個';
          els.recipeYieldCustomUnit.value = '';
        } else {
          els.recipeYieldUnit.value = '自由入力';
          els.recipeYieldCustomUnit.value = recipe.yieldUnit || '';
        }

        els.recipeBaseShape.value = recipe.baseShape || recipe.size?.shape || 'round';
        els.recipeBaseDiameter.value = recipe.baseDiameter || recipe.size?.diameter || '';
        els.recipeBaseHeight.value = recipe.baseHeight || recipe.size?.height || '';
        els.recipeBaseWidth.value = recipe.baseWidth || recipe.size?.width || '';
        els.recipeBaseDepth.value = recipe.baseDepth || recipe.size?.depth || '';

        els.targetDiameter.value = '';
        els.targetHeight.value = '';

        toggleRecipeYieldCustomField();
        toggleRecipeBaseSizeFields();

        appState.currentRecipeMaterials = recipe.materials || [];
        appState.currentRecipeFlows = recipe.flows || [];

        renderRecipeMaterials();
        renderFlows();
        updateEditingLabel();
        updateRecipeCostLabel();
        activateTab('recipes');

        alert('単体レシピJSONを読み込みました。');
        return;
      }

      alert('対応していないJSON形式です。');
    }
