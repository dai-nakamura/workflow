function resetMaterialMasterEditor() { appState.currentMaterialMasterId = null; els.matName.value = ''; els.matBaseAmount.value = ''; els.matBaseUnit.value = 'g'; els.matBasePrice.value = ''; els.matCategory.value = ''; els.matSupplier.value = ''; els.matNote.value = ''; els.matSubCategory.value = '';}

function saveMaterialMaster() { const name = els.matName.value.trim(); if (!name) { alert('材料名を入力してください。'); return; } const rec = { id: appState.currentMaterialMasterId || createId('mat'), name, baseAmount: Number(els.matBaseAmount.value || 0), baseUnit: els.matBaseUnit.value, basePrice: Number(els.matBasePrice.value || 0), category: els.matCategory.value.trim(),subCategory: els.matSubCategory.value.trim(), supplier: els.matSupplier.value.trim(), note: els.matNote.value.trim() }; const idx = db.materialsMaster.findIndex(x => x.id === rec.id); if (idx === -1) db.materialsMaster.unshift(rec); else db.materialsMaster[idx] = rec; appState.currentMaterialMasterId = rec.id; refreshAll(); alert('材料を保存しました。'); }

function renderMaterialsMasterList() { els.materialsMasterCountBadge.textContent = `${db.materialsMaster.length}件`; els.materialsMasterList.innerHTML = ''; if (!db.materialsMaster.length) { els.materialsMasterList.innerHTML = '<div class="empty-box">まだ材料がありません。</div>'; return; } db.materialsMaster.forEach(mat => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(mat.name)}</div><div class="record-sub">${round2(mat.baseAmount)}${escapeHtml(mat.baseUnit)} / ¥${round2(mat.basePrice)}</div><div class="record-sub">単価: ¥${round2(unitCostFromMaterial(mat))} / ${escapeHtml(mat.baseUnit)}</div><div class="record-sub">${escapeHtml(mat.category || '')}
${mat.subCategory ? ' / ' + escapeHtml(mat.subCategory) : ''}${mat.supplier ? ' / ' + escapeHtml(mat.supplier) : ''}</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline edit-matmaster-btn" type="button" data-id="${mat.id}">開く</button><button class="btn btn-danger btn-inline delete-matmaster-btn" type="button" data-id="${mat.id}">削除</button></div>`; els.materialsMasterList.appendChild(card); }); }

function handleMaterialsMasterListClick(e) { const edit = e.target.closest('.edit-matmaster-btn'); const del = e.target.closest('.delete-matmaster-btn'); if (edit) { const mat = db.materialsMaster.find(x => x.id === edit.dataset.id); if (!mat) return; appState.currentMaterialMasterId = mat.id; els.matName.value = mat.name || ''; els.matBaseAmount.value = mat.baseAmount ?? ''; els.matBaseUnit.value = mat.baseUnit || 'g'; els.matBasePrice.value = mat.basePrice ?? ''; els.matCategory.value = mat.category || ''; els.matSubCategory.value = mat.subCategory || mat.subCategory || ''; els.matSupplier.value = mat.supplier || ''; els.matNote.value = mat.note || ''; } if (del) { if (!confirm('この材料を削除しますか？')) return; db.materialsMaster = db.materialsMaster.filter(x => x.id !== del.dataset.id); refreshAll(); } }

function mergeMaterialsByName(currentList, importedList) {
      const map = new Map();

      currentList.forEach(item => {
        const key = String(item.name || '').trim();
        if (key) map.set(key, item);
      });

      importedList.forEach(item => {
        const key = String(item.name || '').trim();
        if (!key) return;

        const existing = map.get(key);

        if (existing) {
          map.set(key, {
            ...existing,
            ...item,
            id: existing.id
          });
        } else {
          map.set(key, {
            ...item,
            id: item.id || createId('mat')
          });
        }
      });

      return Array.from(map.values());
    }

function normalizeMaterialName(name) {
      return String(name || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[　]/g, "")
        .replace(/[（）()]/g, "")
        .toLowerCase();
    }

function findMaterialMasterByName(name) {
      if (!name) return null;

      const exact = db.materialsMaster.find(
        m => (m.name || "").trim() === String(name).trim()
      );
      if (exact) return exact;

      const normalizedTarget = normalizeMaterialName(name);
      return db.materialsMaster.find(
        m => normalizeMaterialName(m.name) === normalizedTarget
      ) || null;
    }

function attachMaterialIdsToRecipeMaterials(materials) {
      return (materials || []).map(item => {
        if (item.materialId) return item;

        const matched = findMaterialMasterByName(item.name);

        return {
          ...item,
          materialId: matched ? matched.id : null,
          name: item.name || matched?.name || ""
        };
      });
    }
