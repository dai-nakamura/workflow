function importReservationData(payload, mode = 'merge') {
      const orders = payload.orders || [];
      const orderItems = payload.orderItems || [];

      if (mode === 'replace') {
        db.reservationOrders = orders;
        db.reservationOrderItems = orderItems;
      } else {
        db.reservationOrders = mergeById(db.reservationOrders, orders, 'resord');
        db.reservationOrderItems = mergeById(db.reservationOrderItems, orderItems, 'resitem');
      }

      refreshAll();
      renderReservations();

      alert(mode === 'replace'
        ? '予約データを上書きしました。'
        : '予約データを追加読込しました。'
      );
    }

function clearReservationData() {
      if (!confirm('予約データをすべて初期化しますか？')) return;

      db.reservationOrders = [];
      db.reservationOrderItems = [];

      refreshAll();
      renderReservations();

      alert('予約データを初期化しました。');
    }

function handleImportReservationJson(mode = 'merge') {
      const text = els.reservationJsonArea.value.trim();

      if (!text) {
        alert('予約JSONを貼り付けてください。');
        return;
      }

      try {
        const parsed = JSON.parse(text);

        let payload;

        if (Array.isArray(parsed)) {
          payload = convertReservationAppOrdersToPayload(parsed);
        } else if (Array.isArray(parsed.orders) && Array.isArray(parsed.orderItems)) {
          payload = parsed;
        } else if (Array.isArray(parsed.orders)) {
          payload = convertReservationAppOrdersToPayload(parsed.orders);
        } else {
          alert('予約JSONの形式を判定できません。');
          return;
        }

        importReservationData(payload, mode);
      } catch (e) {
        console.error(e);
        alert('JSONエラー: ' + e.message);
      }
    }

function findProductIdByReservationItem(item) {
      const name = String(item.name || item.productName || '').trim();
      const type = String(item.type || item.category || '').trim();

      if (!name && !type) return '';

      const byAlias = db.productMasters.find(product =>
        (product.aliases || []).some(alias => {
          const keyword = String(alias || '').trim();
          if (!keyword) return false;
          return name.includes(keyword) || keyword.includes(name) || type.includes(keyword);
        })
      );

      if (byAlias) return byAlias.id;

      const exact = db.productMasters.find(product =>
        String(product.name || '').trim() === name
      );

      if (exact) return exact.id;

      const loose = db.productMasters.find(product => {
        const productName = String(product.name || '').trim();
        if (!productName) return false;
        return name.includes(productName) || productName.includes(name);
      });

      return loose ? loose.id : '';
    }

function parseSquareSize(text) {
      const raw = String(text || '').trim();
      if (!raw) return null;

      const nums = raw.match(/\d+(\.\d+)?/g);
      if (!nums || nums.length < 2) return null;

      return {
        label: raw,
        shape: 'rectangle',
        width: Number(nums[0]) * 10,
        depth: Number(nums[1]) * 10,
        height: 45
      };
    }

function parseMultiSize(text) {
      const raw = String(text || '').trim();
      if (!raw) return [];

      return raw
        .split(/[+＋、,\/]/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(label => getCakeSizePreset(label))
        .filter(Boolean);
    }

function getCakeSizePreset(label) {
      const key = String(label || '').trim();

      if (!key) return null;

      return (db.cakeSizePresets || []).find(size =>
        String(size.label || '').trim() === key
      ) || null;
    }

function parseReservationSize(item) {
      const size = String(item.size || '').trim();
      const squareSize = String(item.squareSize || '').trim();
      const multiSize = String(item.multiSize || '').trim();

      if (multiSize) {
        return {
          mode: 'multi',
          sizeInfoList: parseMultiSize(multiSize)
        };
      }

      if (size === '四角') {
        return {
          mode: 'single',
          sizeInfo: parseSquareSize(squareSize)
        };
      }

      const preset = getCakeSizePreset(size);

      if (preset) {
        return {
          mode: 'single',
          sizeInfo: preset
        };
      }

      return {
        mode: 'unknown',
        sizeInfo: null,
        sizeInfoList: []
      };
    }

function convertReservationAppOrdersToPayload(reservationOrders) {
      const orders = [];
      const orderItems = [];

      reservationOrders.forEach(order => {
        const orderId = order.id || createId('resord');

        orders.push({
          id: orderId,
          date: order.date || '',
          customer: order.clientName || order.customer || '',
          category: order.category || '',
          venue: order.venue || '',
          notes: order.orderNotes || order.notes || '',
          status: order.status || '',
          productionStatus: '未送信',
          isProductionTarget: isProductionTargetReservation(order)
        });

        (order.items || []).forEach(item => {
          const parsedSize = parseReservationSize(item);

          orderItems.push({
            id: createId('resitem'),
            orderId,

            productId: findProductIdByReservationItem(item),
            productName: item.name || item.productName || '',

            quantity: Number(item.quantity || 1),
            unit: item.type === '皿盛りデザート' ? '人前' : '点',

            category: item.type || item.category || order.category || '',

            size: item.size || item.squareSize || '',
            multiSize: item.multiSize || '',

            sizeInfo: parsedSize.sizeInfo || null,
            sizeInfoList: parsedSize.sizeInfoList || [],
            sizeMode: parsedSize.mode,

            options: Array.isArray(item.options) ? item.options : [],

            notes: [
              item.notes || '',
              item.plateMessage ? `プレート: ${item.plateMessage}` : '',
              item.dessertCostNote ? `原価メモ: ${item.dessertCostNote}` : ''
            ].filter(Boolean).join(' / ')
          });
        });
      });

      return { orders, orderItems };
    }

function isProductionTargetReservation(order) {
      const status = order.status || '';

      if (status === '納品済み') return false;
      if (status === '完成') return false;

      return true;
    }

function renderReservations() {
      if (!els.reservationList) return;

      els.reservationCountBadge.textContent = `${db.reservationOrders.length}件`;

      if (!db.reservationOrders.length) {
        els.reservationList.innerHTML =
          '<div class="empty-box">予約データはまだありません。</div>';
        return;
      }

      const visibleOrders = getFilteredReservationOrders();

      visibleOrders.sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
      );
      els.reservationCountBadge.textContent =
        `${visibleOrders.length} / ${db.reservationOrders.length}件`;

      els.reservationList.innerHTML = visibleOrders.map(order => {
        const items = db.reservationOrderItems.filter(
          item => item.orderId === order.id
        );

        return `
      <article class="item-card">

        <div class="item-main">
          <div class="item-title">
            ${escapeHtml(order.customer || '名称未設定')}
          </div>

          <div class="record-sub">
            ${escapeHtml(order.date || '')}
            ${order.venue ? ' / ' + escapeHtml(order.venue) : ''}
            ${order.category ? ' / ' + escapeHtml(order.category) : ''}
          </div>

          <div class="record-sub">
            商品 ${items.length}件
          </div>
        </div>

        <div class="list">
          ${items.map(item => `
            <div class="sub-card">

              <div class="item-title">
                ${escapeHtml(item.productName || '商品名未設定')}
              </div>

              <div class="record-sub">
                ${Number(item.quantity || 1)}
                ${escapeHtml(item.unit || '点')}

                ${item.size
            ? ' / ' + escapeHtml(item.size)
            : ''}

                ${item.multiSize
            ? ' / ' + escapeHtml(item.multiSize)
            : ''}
${item.sizeMode
            ? ' / サイズ解析済'
            : ''}
  ${item.sizeInfo
            ? `
    <div class="record-sub">
      ${item.sizeInfo.shape === 'rectangle'
              ? `${item.sizeInfo.width}×${item.sizeInfo.depth}`
              : `${item.sizeInfo.diameter}φ`}
    </div>
  `
            : ''}
  ${item.sizeInfoList?.length
            ? `
    <div class="record-sub">
      ${item.sizeInfoList.map(size =>
              size.shape === 'rectangle'
                ? `${size.width}×${size.depth}`
                : `${size.diameter}φ`
            ).join(' / ')}
    </div>
  `
            : ''}
                ${item.productId
            ? ' / 紐付け済み'
            : ' / 未紐付け'}
              </div>

              <label class="field" style="margin-top:10px;">
                <span class="field-label">
                  商品マスター紐付け
                </span>

                <select
                  class="reservation-product-select"
                  data-id="${item.id}">

                  <option value="">
                    未紐付け
                  </option>

                  ${db.productMasters.map(product => `
                    <option
                      value="${product.id}"
                      ${item.productId === product.id ? 'selected' : ''}>

                      ${escapeHtml(product.name)}

                    </option>
                  `).join('')}

                </select>
              </label>

            </div>
          `).join('')}
        </div>

        <div class="item-actions">
${order.productionStatus === '製造バッチ化済み'
            ? `
    <button
      class="btn btn-secondary btn-inline"
      type="button"
      disabled>
      製造バッチ化済み
    </button>
  `
            : `
    <button
      class="btn btn-primary btn-inline"
      type="button"
      onclick="sendReservationToProduction('${order.id}')">

      製造へ送る

    </button>
  `
          }
        </div>

      </article>
    `;
      }).join('');
    }

function handleReservationProductLinkChange(e) {
      const select = e.target.closest('.reservation-product-select');
      if (!select) return;

      const itemId = select.dataset.id;
      const productId = select.value;

      const item = db.reservationOrderItems.find(x => x.id === itemId);
      if (!item) return;

      item.productId = productId;

      const product = db.productMasters.find(p => p.id === productId);
      if (product) {
        item.productName = item.productName || product.name || '';
        item.unit = item.unit || product.unitLabel || '点';
      }

      refreshAll();
    }

function sendReservationToProduction(orderId) {
      const order = db.reservationOrders.find(o => o.id === orderId);
      if (order.productionStatus === '製造バッチ化済み') {
        alert('この予約はすでに製造へ送信済みです。');
        return;
      }
      if (!order) {
        alert('予約が見つかりません。');
        return;
      }

      const items = db.reservationOrderItems.filter(item => item.orderId === orderId);

      if (!items.length) {
        alert('この予約には商品がありません。');
        return;
      }

      createBatchesFromReservation(order, items);
      order.productionStatus = '製造バッチ化済み';
      refreshAll();
      activateTab('production');
      alert('予約から製造バッチを作成しました。');
    }

function createBatchesFromReservation(order, items) {
      const exists = db.productionBatches.some(batch =>
        batch.sourceType === 'reservation' &&
        batch.sourceOrderId === order.id
      );

      if (exists) {
        if (!confirm('この予約はすでに製造バッチ化されています。もう一度作成しますか？')) {
          return;
        }
      }
      items.forEach(item => {
        if (item.productId) {
          createReservationLinkedBatch(order, item);
        } else {
          createReservationTemporaryBatch(order, item);
        }
      });
    }

function createReservationLinkedBatch(order, item) {
      const product = db.productMasters.find(p => p.id === item.productId);

      if (!product) {
        createReservationTemporaryBatch(order, item);
        return;
      }

      const quantity = Number(item.quantity || 1);

      const batch = {
        id: createId('batch'),
        sourceType: 'reservation',
        sourceOrderId: order.id,
        sourceOrderItemId: item.id,

        productId: product.id,
        productName: product.name || item.productName || '',
        title: product.name || item.productName || '',

        quantity,
        unit: item.unit || product.unitLabel || '点',

        eventDate: order.date || '',
        status: '未着手',
        isTemporary: false,

        recipeItems: [],
        taskItems: [],

        note: [
          '予約由来',
          order.customer ? `顧客: ${order.customer}` : '',
          order.venue ? `会場: ${order.venue}` : '',
          item.category ? `区分: ${item.category}` : '',
          item.size ? `サイズ: ${item.size}` : '',
          item.multiSize ? `複数サイズ: ${item.multiSize}` : '',
          item.options?.length ? `オプション: ${item.options.join('、')}` : '',
          item.notes || ''
        ].filter(Boolean).join(' / ')
      };

      (product.components || []).forEach(component => {
        const componentQuantity = Number(component.quantity || 1) * quantity;

        if (component.sourceType === 'recipe') {
          const recipe = db.recipeMasters.find(r => r.id === component.refId);

          const sizeScale = recipe
            ? calcReservationComponentSizeScale(recipe, component)
            : 1;

          const finalScale = componentQuantity * sizeScale;

          batch.recipeItems.push({
            recipeId: component.refId,
            recipeName: recipe?.name || component.name || 'レシピ未設定',
            quantity: componentQuantity,
            unit: component.unit || recipe?.yieldUnit || '',
            sizeScale,
            scale: finalScale
          });
        }

        if (component.sourceType === 'task') {
          const task = db.taskMasters.find(t => t.id === component.refId);

          batch.taskItems.push({
            taskId: component.refId,
            taskName: task?.name || component.name || '作業未設定',
            quantity: componentQuantity,
            durationMinutes: Number(task?.defaultDurationMinutes || 0) * componentQuantity,
            equipment: task?.equipment || '',
            canParallel: task?.canParallel ?? true
          });
        }
      });

      db.productionBatches.unshift(batch);
    }

function calcReservationComponentSizeScale(recipe, component) {
      if (!recipe || !component) return 1;

      const baseShape = recipe.baseShape || 'round';
      const targetShape = component.shape || baseShape;

      // 四角
      if (baseShape === 'rectangle' || targetShape === 'rectangle') {
        const baseWidth = Number(recipe.baseWidth || 0);
        const baseDepth = Number(recipe.baseDepth || 0);
        const baseHeight = Number(recipe.baseHeight || 0);

        const targetWidth = Number(component.width || 0);
        const targetDepth = Number(component.depth || 0);
        const targetHeight = Number(component.height || 0);

        if (!baseWidth || !baseDepth || !baseHeight || !targetWidth || !targetDepth || !targetHeight) {
          return 1;
        }

        return round2(
          (targetWidth * targetDepth * targetHeight) /
          (baseWidth * baseDepth * baseHeight)
        );
      }

      // 丸
      const baseDiameter = Number(recipe.baseDiameter || 0);
      const baseHeight = Number(recipe.baseHeight || 0);
      const targetDiameter = Number(component.diameter || 0);
      const targetHeight = Number(component.height || 0);

      if (!baseDiameter || !baseHeight || !targetDiameter || !targetHeight) {
        return 1;
      }

      return round2(
        (targetDiameter * targetDiameter * targetHeight) /
        (baseDiameter * baseDiameter * baseHeight)
      );
    }

function createReservationTemporaryBatch(order, item) {
      db.productionBatches.unshift({
        id: createId('batch_tmp'),
        sourceType: 'reservation',
        sourceOrderId: order.id,
        sourceOrderItemId: item.id,

        productId: '',
        productName: item.productName || '未紐付け商品',
        title: item.productName || '未紐付け商品',

        quantity: Number(item.quantity || 1),
        unit: item.unit || '点',

        eventDate: order.date || '',
        status: '未紐付け',
        isTemporary: true,

        note: [
          '予約由来の未紐付け仮バッチ',
          order.customer ? `顧客: ${order.customer}` : '',
          order.venue ? `会場: ${order.venue}` : '',
          item.category ? `区分: ${item.category}` : '',
          item.size ? `サイズ: ${item.size}` : '',
          item.multiSize ? `複数サイズ: ${item.multiSize}` : '',
          item.options?.length ? `オプション: ${item.options.join('、')}` : '',
          item.notes || ''
        ].filter(Boolean).join(' / ')
      });
    }

function getFilteredReservationOrders() {
      const filter = els.reservationFilter?.value || 'productionTarget';
      const categoryFilter = els.reservationCategoryFilter?.value || 'all';
      const fromDate = els.reservationFromDate?.value || '';
      const toDate = els.reservationToDate?.value || '';

      return db.reservationOrders.filter(order => {
        const status = order.status || '';
        const productionStatus = order.productionStatus || '未送信';
        const category = order.category || '';
        const date = order.date || '';

        if (filter === 'all') {
          // OK
        } else if (filter === 'productionTarget' && order.isProductionTarget === false) {
          return false;
        } else if (filter === 'notSent' && productionStatus !== '未送信') {
          return false;
        } else if (filter === 'batched' && productionStatus !== '製造バッチ化済み') {
          return false;
        } else if (filter === 'delivered' && status !== '納品済み') {
          return false;
        }

        if (categoryFilter !== 'all' && category !== categoryFilter) {
          return false;
        }

        if (fromDate && date < fromDate) {
          return false;
        }

        if (toDate && date > toDate) {
          return false;
        }

        return true;
      });
      }

function rebuildReservationData() {
        if (!confirm('予約データを現在の解析ルールで再解析しますか？')) {
          return;
        }

        const rebuiltItems = db.reservationOrderItems.map(item => {
          const parsedSize = parseReservationSize(item);

          return {
            ...item,

            productId:
              item.productId ||
              findProductIdByReservationItem(item),

            sizeInfo: parsedSize.sizeInfo || null,
            sizeInfoList: parsedSize.sizeInfoList || [],
            sizeMode: parsedSize.mode
          };
        });

        db.reservationOrderItems = rebuiltItems;

        persistDb();
        renderReservations();

        alert('予約解析を再実行しました。');
      }
