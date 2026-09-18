function loadScheduleCandidates() {
      const targets = appState.currentBatchId
        ? db.productionBatches.filter(b => b.id === appState.currentBatchId)
        : db.productionBatches;

      appState.currentScheduleCandidates = [];

      targets.forEach(batch => {

        // ① 既存バッチ：flows を候補化
        (batch.flows || []).forEach((flow, index) => {
          appState.currentScheduleCandidates.push({
            id: createId('candidate'),
            batchId: batch.id,
            batchName: batch.name || batch.title || batch.productName || '',
            recipeId: batch.recipeId || '',
            recipeName: batch.recipeName || '',
            order: index,

            title: flow.title || '工程',
            description: flow.description || '',
            durationMinutes: flow.durationMinutes || 0,
            taskType: flow.type || 'other',
            canParallel: !!flow.canParallel,
            equipment: flow.equipment || '',

            eventDate: batch.date || batch.eventDate || getTodayString(),
            scheduledDate: batch.date || batch.eventDate || getTodayString(),
            status: 'planned',
            note: `倍率 ${batch.scale || 1}倍`,

            materialsSnapshot: deepCopy(batch.materials || []),
            sourceOrders: deepCopy(batch.sourceOrders || []),
            scale: batch.scale || 1
          });
        });

        // ② 予約由来バッチ：recipeItems を候補化
        (batch.recipeItems || []).forEach((recipe, index) => {
          appState.currentScheduleCandidates.push({
            id: createId('candidate_recipe'),
            batchId: batch.id,
            batchName: batch.title || batch.productName || batch.name || '',
            recipeId: recipe.recipeId || '',
            recipeName: recipe.recipeName || '',
            order: index,

            title: recipe.recipeName || 'レシピ未設定',
            description: [
              batch.title || batch.productName || '',
              `最終倍率 ${round2(recipe.scale || 1)}倍`
            ].filter(Boolean).join(' / '),

            durationMinutes: 0,
            taskType: 'recipe',
            canParallel: true,
            equipment: '',

            eventDate: batch.eventDate || batch.date || getTodayString(),
            scheduledDate: batch.eventDate || batch.date || getTodayString(),
            status: 'planned',
            note: [
              '予約由来',
              `数量 ${round2(recipe.quantity || 0)}${recipe.unit || ''}`,
              `サイズ倍率 ${round2(recipe.sizeScale || 1)}`,
              `最終倍率 ${round2(recipe.scale || 1)}`
            ].join(' / '),

            materialsSnapshot: [],
            sourceOrders: deepCopy(batch.sourceOrders || []),
            scale: recipe.scale || 1
          });
        });

        // ③ 予約由来バッチ：taskItems を候補化
        (batch.taskItems || []).forEach((task, index) => {
          appState.currentScheduleCandidates.push({
            id: createId('candidate_task'),
            batchId: batch.id,
            batchName: batch.title || batch.productName || batch.name || '',
            recipeId: '',
            recipeName: '',
            order: index,

            title: task.taskName || '作業未設定',
            description: [
              batch.title || batch.productName || '',
              `${round2(task.durationMinutes || 0)}分`,
              task.equipment ? `設備: ${task.equipment}` : ''
            ].filter(Boolean).join(' / '),

            durationMinutes: Number(task.durationMinutes || 0),
            taskType: 'task',
            canParallel: task.canParallel ?? true,
            equipment: task.equipment || '',

            eventDate: batch.eventDate || batch.date || getTodayString(),
            scheduledDate: batch.eventDate || batch.date || getTodayString(),
            status: 'planned',
            note: '予約由来の作業',

            materialsSnapshot: [],
            sourceOrders: deepCopy(batch.sourceOrders || []),
            scale: 1
          });
        });

        // ④ 保険：flows / recipeItems / taskItems が全部ないバッチ
        if (
          !(batch.flows || []).length &&
          !(batch.recipeItems || []).length &&
          !(batch.taskItems || []).length
        ) {
          appState.currentScheduleCandidates.push({
            id: createId('candidate_batch'),
            batchId: batch.id,
            batchName: batch.title || batch.productName || batch.name || '',
            recipeId: '',
            recipeName: '',
            order: 0,

            title: batch.title || batch.productName || batch.name || '製造バッチ',
            description: batch.note || '',
            durationMinutes: Number(batch.durationMinutes || 0),
            taskType: 'batch',
            canParallel: true,
            equipment: batch.equipment || '',

            eventDate: batch.eventDate || batch.date || getTodayString(),
            scheduledDate: batch.eventDate || batch.date || getTodayString(),
            status: 'planned',
            note: batch.note || '',

            materialsSnapshot: deepCopy(batch.materials || []),
            sourceOrders: deepCopy(batch.sourceOrders || []),
            scale: batch.scale || 1
          });
        }
      });

      renderScheduleCandidates();
    }

function renderScheduleCandidates() {
      els.scheduleCandidateList.innerHTML = '';

      if (!appState.currentScheduleCandidates.length) {
        els.scheduleCandidateEmpty.classList.remove('is-hidden');
        return;
      }

      els.scheduleCandidateEmpty.classList.add('is-hidden');

      appState.currentScheduleCandidates.forEach(item => {
        const card = document.createElement('article');
        card.className = 'item-card';

        card.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div class="record-sub">
          ${escapeHtml(item.batchName)} / ${item.durationMinutes}分 / ${escapeHtml(item.taskType)}
        </div>
        <div class="record-sub">
          設備: ${escapeHtml(item.equipment || '未設定')} / 
          並行: ${item.canParallel ? 'しやすい' : 'しにくい'} / 
          施工日 ${escapeHtml(item.eventDate || '-')}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-inline add-plan-step-btn" type="button" data-id="${item.id}">
          追加
        </button>
      </div>
    `;

        els.scheduleCandidateList.appendChild(card);
      });
    }

function handleScheduleCandidateClick(e) {
      const btn = e.target.closest('.add-plan-step-btn');
      if (!btn) return;

      const item = appState.currentScheduleCandidates.find(x => x.id === btn.dataset.id);
      if (!item) return;

      appState.currentPlanSteps.push({
        id: createId('planstep'),
        sourceType: 'batch',
        sourceId: item.batchId,
        title: item.title,
        recipeId: item.recipeId,
        recipeName: item.recipeName,
        batchId: item.batchId,
        batchName: item.batchName,
        scale: item.scale,
        durationMinutes: item.durationMinutes,
        taskType: item.taskType,
        equipment: item.equipment,
        canParallel: item.canParallel,
        eventDate: item.eventDate,
        scheduledDate: item.scheduledDate,
        status: 'planned',
        note: item.note,
        materialsSnapshot: deepCopy(item.materialsSnapshot || []),
        sourceOrders: deepCopy(item.sourceOrders || [])
      });

      renderPlanSteps();
    }

function resetPlanEditor() { appState.currentPlanId = null; appState.currentPlanSteps = []; els.planName.value = ''; els.planMemo.value = ''; renderPlanSteps(); }

function renderPlanSteps() { els.planStepList.innerHTML = ''; if (!appState.currentPlanSteps.length) { els.planStepEmpty.classList.remove('is-hidden'); return; } els.planStepEmpty.classList.add('is-hidden'); appState.currentPlanSteps.forEach((step, index) => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${index + 1}. ${escapeHtml(step.title)}</div><div class="record-sub">${escapeHtml(step.batchName || '')}${step.scale ? ' / ' + step.scale + '倍' : ''}</div><div class="record-sub">施工日: ${escapeHtml(step.eventDate || '-')} / ${step.durationMinutes || 0}分 / 設備: ${escapeHtml(step.equipment || '未設定')}</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline detail-plan-step-btn" type="button" data-index="${index}">詳細</button><button class="btn btn-secondary btn-inline move-up-plan-step-btn" type="button" data-index="${index}">上へ</button><button class="btn btn-secondary btn-inline move-down-plan-step-btn" type="button" data-index="${index}">下へ</button><button class="btn btn-secondary btn-inline send-to-planner-btn" type="button" data-index="${index}">計画へ</button><button class="btn btn-danger btn-inline delete-plan-step-btn" type="button" data-index="${index}">削除</button></div>`; els.planStepList.appendChild(card); }); }

function showPlanStepDetail(index) { const step = appState.currentPlanSteps[index]; if (!step) return; const materialLines = (step.materialsSnapshot || []).map(m => `${m.name} : ${round2(m.scaledAmountValue || 0)}${m.amountUnit || ''}`).join('\n') || '材料情報なし'; alert(`工程: ${step.title}\nバッチ: ${step.batchName || ''}\n施工日: ${step.eventDate || '-'}\n倍率: ${step.scale || '-'}\n時間: ${step.durationMinutes || 0}分\n設備: ${step.equipment || '-'}\nメモ: ${step.note || 'なし'}\n\n材料:\n${materialLines}`); }

function handlePlanStepClick(e) {
      const up = e.target.closest('.move-up-plan-step-btn');
      const down = e.target.closest('.move-down-plan-step-btn');
      const send = e.target.closest('.send-to-planner-btn');
      const detailBtn = e.target.closest('.detail-plan-step-btn');
      const del = e.target.closest('.delete-plan-step-btn');
      if (detailBtn) { showPlanStepDetail(Number(detailBtn.dataset.index)); }
      if (up) { const i = Number(up.dataset.index); if (i > 0) [appState.currentPlanSteps[i - 1], appState.currentPlanSteps[i]] = [appState.currentPlanSteps[i], appState.currentPlanSteps[i - 1]]; renderPlanSteps(); }
      if (down) { const i = Number(down.dataset.index); if (i < appState.currentPlanSteps.length - 1) [appState.currentPlanSteps[i + 1], appState.currentPlanSteps[i]] = [appState.currentPlanSteps[i], appState.currentPlanSteps[i + 1]]; renderPlanSteps(); }
      if (send) { openAssignModal(Number(send.dataset.index)); }
      if (del) { appState.currentPlanSteps.splice(Number(del.dataset.index), 1); renderPlanSteps(); }
    }

function saveSchedulePlan() { const name = els.planName.value.trim(); if (!name) { alert('段取り名を入力してください。'); return; } if (!appState.currentPlanSteps.length) { alert('段取り項目がありません。'); return; } const plan = { id: appState.currentPlanId || createId('plan'), name, memo: els.planMemo.value.trim(), steps: deepCopy(appState.currentPlanSteps), updatedAt: new Date().toISOString() }; const idx = db.schedulePlans.findIndex(x => x.id === plan.id); if (idx === -1) db.schedulePlans.unshift(plan); else db.schedulePlans[idx] = plan; appState.currentPlanId = plan.id; refreshAll(); alert('段取りを保存しました。'); }

function renderPlanList() { els.planCountBadge.textContent = `${db.schedulePlans.length}件`; els.planList.innerHTML = ''; if (!db.schedulePlans.length) { els.planList.innerHTML = '<div class="empty-box">まだ段取りがありません。</div>'; return; } db.schedulePlans.forEach(plan => { const card = document.createElement('article'); card.className = 'item-card'; card.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(plan.name)}</div><div class="record-sub">工程 ${plan.steps?.length || 0}件</div></div><div class="item-actions"><button class="btn btn-secondary btn-inline load-plan-btn" type="button" data-id="${plan.id}">開く</button><button class="btn btn-danger btn-inline delete-plan-btn" type="button" data-id="${plan.id}">削除</button></div>`; els.planList.appendChild(card); }); }

function handlePlanListClick(e) { const load = e.target.closest('.load-plan-btn'); const del = e.target.closest('.delete-plan-btn'); if (load) { const plan = db.schedulePlans.find(x => x.id === load.dataset.id); if (!plan) return; appState.currentPlanId = plan.id; els.planName.value = plan.name || ''; els.planMemo.value = plan.memo || ''; appState.currentPlanSteps = deepCopy(plan.steps || []); renderPlanSteps(); activateTab('schedule'); } if (del) { if (!confirm('この段取りを削除しますか？')) return; db.schedulePlans = db.schedulePlans.filter(x => x.id !== del.dataset.id); refreshAll(); } }

function openAssignModal(index) { const step = appState.currentPlanSteps[index]; if (!step) return; appState.pendingPlanStepIndex = index; els.assignMode.value = 'days_before'; els.assignDaysBefore.value = '1'; els.assignFixedDate.value = step.eventDate || getTodayString(); renderAssignMode(); els.planAssignModal.classList.add('is-open'); }

function renderAssignMode() { const fixed = els.assignMode.value === 'fixed_date'; els.assignDaysField.classList.toggle('is-hidden', fixed); els.assignDateField.classList.toggle('is-hidden', !fixed); }

function closeAssignModal() { els.planAssignModal.classList.remove('is-open'); appState.pendingPlanStepIndex = null; }

function confirmAssignToPlanner() { const idx = appState.pendingPlanStepIndex; const step = appState.currentPlanSteps[idx]; if (!step) return; let scheduledDate = step.eventDate || getTodayString(); if (els.assignMode.value === 'fixed_date') { if (!els.assignFixedDate.value) { alert('日付を指定してください。'); return; } scheduledDate = els.assignFixedDate.value; } else { const daysBefore = Number(els.assignDaysBefore.value || 0); if (Number.isNaN(daysBefore) || daysBefore < 0) { alert('何日前は0以上の数字で入れてください。'); return; } scheduledDate = addDays(step.eventDate || getTodayString(), -daysBefore); } sendPlanStepToPlanner(idx, scheduledDate); closeAssignModal(); }

function sendPlanStepToPlanner(index, forcedDate) {
      const step = appState.currentPlanSteps[index];
      if (!step) return;

      db.planItems.unshift({
        id: createId('planitem'),
        sourceType: step.sourceType || 'batch',
        sourceId: step.sourceId || null,
        title: step.title,
        recipeName: step.recipeName || '',
        batchName: step.batchName || '',
        scale: step.scale || null,
        scheduledDate: forcedDate || step.scheduledDate || getTodayString(),
        eventDate: step.eventDate || '',
        durationMinutes: step.durationMinutes || 0,
        taskType: step.taskType || 'other',
        equipment: step.equipment || '',
        canParallel: !!step.canParallel,
        materialsSnapshot: deepCopy(step.materialsSnapshot || []),
        sourceOrders: deepCopy(step.sourceOrders || []),
        note: step.note || ''
      });

      refreshAll();
      alert('計画表に追加しました。');
    }

function renderPlanner() { const mode = els.plannerMode.value, startDate = els.plannerStartDate.value || getTodayString(), days = mode === 'week' ? 7 : 31; els.planItemCountBadge.textContent = `${db.planItems.length}件`; els.plannerGrid.className = `planner-grid ${mode}`; els.plannerGrid.innerHTML = ''; for (let i = 0; i < days; i++) { const dateStr = addDays(startDate, i), items = db.planItems.filter(item => item.scheduledDate === dateStr); const dayCard = document.createElement('article'); dayCard.className = 'day-card'; dayCard.innerHTML = `<div class="day-card-header"><div><div class="item-title">${escapeHtml(dateStr)}</div><div class="meta-text">${formatDateLabel(dateStr)} / ${items.length}件</div></div><button class="btn btn-secondary btn-small add-empty-plan-item-btn" type="button" data-date="${dateStr}">追加</button></div><div class="day-card-body">${items.length ? items.map(item => `<div class="plan-mini-item"><div><strong>${escapeHtml(item.title)}</strong></div><div class="meta-text">${escapeHtml(item.batchName || item.recipeName || '')}${item.scale ? ` / ${item.scale}倍` : ''}${item.durationMinutes ? ` / ${item.durationMinutes}分` : ''}</div><div class="meta-text">施工日 ${escapeHtml(item.eventDate || '-')}</div><div class="inline-actions" style="margin-top:8px;"><button class="btn btn-secondary btn-small shift-plan-item-btn" type="button" data-id="${item.id}" data-days="-1">前日へ</button><button class="btn btn-secondary btn-small shift-plan-item-btn" type="button" data-id="${item.id}" data-days="1">翌日へ</button><button class="btn btn-danger btn-small delete-plan-item-btn" type="button" data-id="${item.id}">削除</button></div></div>`).join('') : '<p class="helper-text">予定なし</p>'}</div>`; els.plannerGrid.appendChild(dayCard); } }

function handlePlannerGridClick(e) { const add = e.target.closest('.add-empty-plan-item-btn'); const shift = e.target.closest('.shift-plan-item-btn'); const del = e.target.closest('.delete-plan-item-btn'); if (add) { const title = prompt('追加する項目名'); if (!title || !title.trim()) return; db.planItems.unshift({ id: createId('planitem'), sourceType: 'manual', sourceId: null, title: title.trim(), recipeName: '', batchName: '', scale: null, scheduledDate: add.dataset.date, eventDate: '', durationMinutes: 0, taskType: 'other', equipment: '', canParallel: true, materialsSnapshot: [], note: '' }); refreshAll(); } if (shift) { const item = db.planItems.find(x => x.id === shift.dataset.id); if (!item) return; item.scheduledDate = addDays(item.scheduledDate, Number(shift.dataset.days)); refreshAll(); } if (del) { db.planItems = db.planItems.filter(x => x.id !== del.dataset.id); refreshAll(); } }

function buildPrintPlannerView() { const startDate = els.plannerStartDate.value || getTodayString(); const rangeDates = []; for (let i = 0; i < 7; i++) rangeDates.push(addDays(startDate, i)); els.printPlannerView.innerHTML = `<div class="print-sheet"><div class="print-grid cols-7">${rangeDates.map(dateStr => { const items = db.planItems.filter(item => item.scheduledDate === dateStr); return `<div class="print-day"><div class="print-day-head">${escapeHtml(formatPrintDate(dateStr))}</div><div class="print-day-list">${items.length ? items.map(item => `<div class="print-day-item"><div class="print-item-main">${escapeHtml(item.title || '')}</div><div class="print-item-sub">${escapeHtml(item.batchName || item.recipeName || '')}${item.scale ? ` / ${escapeHtml(String(item.scale))}倍` : ''}${item.durationMinutes ? ` / ${escapeHtml(String(item.durationMinutes))}分` : ''}</div></div>`).join('') : '<div class="print-day-item">　</div>'}</div></div>`; }).join('')}</div></div>`; }
