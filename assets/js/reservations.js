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

      autoLinkExactReservationItems();
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

function normalizeReservationProductName(value) {
      return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[\s　]+/g, '');
    }

// 商品マスターの正式名・別名を同じ規則で索引化する。
// 同じ呼び名が複数商品に登録されている場合は自動決定しない。
function buildReservationProductNameIndex() {
      const index = new Map();
      (db?.productMasters || []).forEach(product => {
        const names = [product.name, ...(Array.isArray(product.aliases) ? product.aliases : [])];
        [...new Set(names.map(normalizeReservationProductName).filter(Boolean))].forEach(key => {
          if (!index.has(key)) index.set(key, []);
          index.get(key).push(product);
        });
      });
      return index;
    }

function findUniqueProductByReservationName(value) {
      const key = normalizeReservationProductName(value);
      if (!key) return { product: null, ambiguous: false, candidates: [] };
      const candidates = buildReservationProductNameIndex().get(key) || [];
      return {
        product: candidates.length === 1 ? candidates[0] : null,
        ambiguous: candidates.length > 1,
        candidates
      };
    }

function autoLinkExactReservationItems(productId = '') {
      if (!Array.isArray(db?.reservationOrderItems) || !Array.isArray(db?.productMasters)) return 0;
      const index = buildReservationProductNameIndex();
      let changed = 0;
      db.reservationOrderItems.forEach(item => {
        const links = Array.isArray(item.productionLinks) ? item.productionLinks : [];
        if (item.productId || item.recipeId || links.length) return;
        const key = normalizeReservationProductName(item.productName || item.name);
        if (!key) return;
        const candidates = index.get(key) || [];
        // 正式名/別名が複数商品に重複している場合は誤紐付け防止のため確認待ち。
        if (candidates.length !== 1) return;
        const product = candidates[0];
        if (productId && product.id !== productId) return;
        item.productId = product.id;
        item.recipeId = '';
        item.productionLinks = [{ type:'product', refId:product.id, quantity:1 }];
        item.unit = item.unit || product.unitLabel || '点';
        changed++;
      });
      if (changed && typeof persistDb === 'function') persistDb();
      return changed;
    }

function linkSameNameReservationItems(itemId, productId) {
      const source = db.reservationOrderItems.find(x => x.id === itemId);
      const product = db.productMasters.find(x => x.id === productId);
      if (!source || !product) return 0;
      const sourceKey = normalizeReservationProductName(source.productName || source.name);
      if (!sourceKey) return 0;
      let changed = 0;
      db.reservationOrderItems.forEach(item => {
        if (normalizeReservationProductName(item.productName || item.name) !== sourceKey) return;
        const links = Array.isArray(item.productionLinks) ? item.productionLinks : [];
        if (item.productId === productId && !item.recipeId && links.length === 1 && links[0].type === 'product' && links[0].refId === productId) return;
        // 手動で同じ予約名を商品へ紐付けた場合は、その予約名の未紐付け分にも一括適用。
        // 既に複数製造内容を設定済みの予約は上書きしない。
        if (item.productId || item.recipeId || links.length) return;
        item.productId = productId;
        item.recipeId = '';
        item.productionLinks = [{ type:'product', refId:productId, quantity:1 }];
        item.unit = item.unit || product.unitLabel || '点';
        changed++;
      });
      if (changed && typeof persistDb === 'function') persistDb();
      return changed;
    }

window.normalizeReservationProductName = normalizeReservationProductName;
window.findUniqueProductByReservationName = findUniqueProductByReservationName;
window.autoLinkExactReservationItems = autoLinkExactReservationItems;
window.linkSameNameReservationItems = linkSameNameReservationItems;


function getReservationProductionLinks(item) {
  if (!item) return [];
  if (!Array.isArray(item.productionLinks)) item.productionLinks = [];
  if (!item.productionLinks.length) {
    if (item.productId) item.productionLinks.push({ type:'product', refId:item.productId, quantity:1 });
    else if (item.recipeId) item.productionLinks.push({ type:'recipe', refId:item.recipeId, quantity:1 });
  }
  return item.productionLinks;
}

function productionLinkName(link) {
  if (link.type === 'recipe') return db.recipeMasters.find(x=>x.id===link.refId)?.name || 'レシピ参照切れ';
  return db.productMasters.find(x=>x.id===link.refId)?.name || '商品参照切れ';
}

function syncLegacyReservationLink(item) {
  const links=getReservationProductionLinks(item);
  const firstProduct=links.find(x=>x.type==='product');
  const firstRecipe=links.find(x=>x.type==='recipe');
  item.productId=firstProduct?.refId || '';
  item.recipeId=!firstProduct && firstRecipe ? firstRecipe.refId : '';
}

function removeReservationProductionLink(itemId,index) {
  const item=db.reservationOrderItems.find(x=>x.id===itemId); if(!item)return;
  getReservationProductionLinks(item).splice(Number(index),1); syncLegacyReservationLink(item); persistDb(); renderReservations();
}
window.removeReservationProductionLink=removeReservationProductionLink;
function findProductIdByReservationItem(item) {
      const name = String(item.name || item.productName || '').trim();
      const result = findUniqueProductByReservationName(name);
      return result.product ? result.product.id : '';
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

/* v21: 予約の進行中/処理済み判定を全画面で共通化する。 */
function normalizeReservationStatus(value) {
      return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s　・_\-／/（）()【】\[\]]/g, '');
    }

function isCompletedReservationStatus(value) {
      const s = normalizeReservationStatus(value);
      if (!s) return false;
      return s.includes('納品済') || s.includes('納品完了') ||
        s.includes('完成済') || s === '完成' ||
        s.includes('完了済') || s === '完了' ||
        s.includes('処理済') || s.includes('対応済') ||
        s.includes('キャンセル') || s.includes('取消') || s.includes('中止') ||
        s === 'delivered' || s === 'completed' || s === 'complete' || s === 'done' || s === 'cancelled' || s === 'canceled';
    }

function isCompletedReservation(order) {
      if (!order) return false;
      if (order.isProductionTarget === false) return true;
      return [order.status, order.productionStatus, order.state, order.progressStatus, order.workflowStatus]
        .some(isCompletedReservationStatus);
    }

function isProductionTargetReservation(order) {
      return !isCompletedReservation(order);
    }

window.isCompletedReservationStatus = isCompletedReservationStatus;
window.isCompletedReservation = isCompletedReservation;
window.isProductionTargetReservation = isProductionTargetReservation;

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

              <div class="field" style="margin-top:10px;">
                <span class="field-label">製造内容の紐付け（複数可）</span>
                <div class="reservation-production-links">
                  ${getReservationProductionLinks(item).map((link,idx)=>`<span class="reservation-production-link">${escapeHtml(productionLinkName(link))}<button type="button" onclick="event.stopPropagation();removeReservationProductionLink('${item.id}',${idx})" aria-label="削除">×</button></span>`).join('') || '<span class="record-sub">未紐付け</span>'}
                </div>
                <select class="reservation-product-select" data-id="${item.id}">
                  <option value="">＋ 製造内容を追加</option>
                  <optgroup label="商品マスター">${db.productMasters.map(product => `<option value="product:${product.id}">${escapeHtml(product.name)}</option>`).join('')}</optgroup>
                  <optgroup label="レシピ">${db.recipeMasters.map(recipe => `<option value="recipe:${recipe.id}">${escapeHtml(recipe.name)}</option>`).join('')}</optgroup>
                </select>
                <div class="reservation-link-help">固定商品は商品マスター、特注・AT・ウェルカムフルーツ等は必要な商品/レシピを複数追加できます。</div>
              </div>

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
  const select=e.target.closest('.reservation-product-select'); if(!select)return;
  const item=db.reservationOrderItems.find(x=>x.id===select.dataset.id); if(!item||!select.value)return;
  const [type,refId]=select.value.split(':'); if(!refId)return;
  const links=getReservationProductionLinks(item);
  if(!links.some(x=>x.type===type&&x.refId===refId)) links.push({type,refId,quantity:1});
  syncLegacyReservationLink(item);
  // 商品を1件目として選んだ場合だけ、従来どおり同名予約へ一括紐付け。複数構成は予約固有として勝手に横展開しない。
  if(type==='product' && links.length===1) linkSameNameReservationItems(item.id,refId);
  persistDb(); renderReservations();
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
      alert('予約から製造バッチを作成しました。現在の画面に留まります。');
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
        const links=getReservationProductionLinks(item);
        if (links.length) {
          links.forEach(link=>{
            const linked={...item, quantity:Number(item.quantity||1)*Number(link.quantity||1), productId:link.type==='product'?link.refId:'', recipeId:link.type==='recipe'?link.refId:''};
            if(linked.productId) createReservationLinkedBatch(order,linked); else createReservationTemporaryBatch(order,linked);
          });
        } else createReservationTemporaryBatch(order,item);
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
        } else if (filter === 'productionTarget' && isCompletedReservation(order)) {
          return false;
        } else if (filter === 'notSent' && productionStatus !== '未送信') {
          return false;
        } else if (filter === 'batched' && productionStatus !== '製造バッチ化済み') {
          return false;
        } else if (filter === 'delivered' && !isCompletedReservation(order)) {
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
