function refreshOrderProductSelect() { els.orderProductSelect.innerHTML = ['<option value="">選択してください</option>'].concat(db.productMasters.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`)).join(''); }

function syncOrderUnitFromProduct() { const p = findProduct(els.orderProductSelect.value); els.orderUnit.value = p?.unitLabel || ''; }

function resetOrderEditor() { appState.currentOrderId = null; els.orderDate.value = getTodayString(); els.orderProductSelect.value = ''; els.orderQuantity.value = '1'; els.orderUnit.value = ''; els.orderCustomer.value = ''; els.orderMemo.value = ''; }

function saveOrderItem() { const productId = els.orderProductSelect.value, product = findProduct(productId); if (!product) { alert('商品を選択してください。'); return; } const item = { id: appState.currentOrderId || createId('order'), date: els.orderDate.value || getTodayString(), productId, productName: product.name, quantity: Number(els.orderQuantity.value || 0), unit: els.orderUnit.value.trim() || product.unitLabel || '', customer: els.orderCustomer.value.trim(), memo: els.orderMemo.value.trim() }; const idx = db.orderItems.findIndex(x => x.id === item.id); if (idx === -1) db.orderItems.unshift(item); else db.orderItems[idx] = item; appState.currentOrderId = item.id; refreshAll(); alert('受注を保存しました。'); }

function renderOrderList() {
      els.orderCountBadge.textContent = `${db.orderItems.length}件`; els.orderList.innerHTML = ''; if (!db.orderItems.length) { els.orderList.innerHTML = '<div class="empty-box">まだ受注がありません。</div>'; return; } db.orderItems.forEach(order => {
        expandProduct(
          order.productId,
          Number(order.quantity || 0),
          order.date,
          order
        );
      });
    }

function handleOrderListClick(e) { const load = e.target.closest('.load-order-btn'); const del = e.target.closest('.delete-order-btn'); if (load) { const order = db.orderItems.find(x => x.id === load.dataset.id); if (!order) return; appState.currentOrderId = order.id; els.orderDate.value = order.date || getTodayString(); els.orderProductSelect.value = order.productId || ''; els.orderQuantity.value = order.quantity ?? 1; els.orderUnit.value = order.unit || ''; els.orderCustomer.value = order.customer || ''; els.orderMemo.value = order.memo || ''; activateTab('orders'); } if (del) { if (!confirm('この受注を削除しますか？')) return; db.orderItems = db.orderItems.filter(x => x.id !== del.dataset.id); refreshAll(); } }

function findProductForOrderItem(order) {
      if (order.productId) {
        return findProduct(order.productId);
      }

      if (order.productName) {
        return db.productMasters.find(p => p.name === order.productName) || null;
      }

      return null;
    }
