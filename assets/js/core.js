

    window.els = {};
var els = window.els;
    [
      'storageStatus', 'currentEditingLabel', 'matName', 'matBaseAmount', 'matBaseUnit', 'matBasePrice', 'matCategory', 'matSupplier', 'matNote', 'materialsMasterList', 'materialsMasterCountBadge',
      'recipeName', 'recipeType', 'recipeDate', 'recipeOwner', 'recipeYieldQuantity', 'recipeYieldUnit', 'recipeYieldCustomField', 'recipeYieldCustomUnit', 'recipeMemo', 'recipeCostLabel', 'recipeMaterialsList', 'recipeMaterialsEmpty', 'recipeMaterialFormCard', 'recipeMaterialFilterCategory', 'recipeMaterialSelect', 'recipeMaterialAmountValue', 'recipeMaterialAmountUnit', 'recipeMaterialNote', 'flowList', 'flowEmpty', 'flowFormCard', 'flowTitle', 'flowDescription', 'flowDurationMinutes', 'flowType', 'flowCanParallel', 'flowEquipment', 'flowChecks', 'recipeMasterList', 'recipeCountBadge', 'recipeBaseDiameter', 'recipeBaseHeight',
      'recipeBaseShape', 'recipeBaseWidth', 'recipeBaseDepth', 'recipeRoundSizeRow', 'recipeRectangleSizeRow', 'productConponent', 'productConponentShape', 'productConponentWidth', 'productConponentDepth', 'productConponentRoundSizeRow', 'productConponentRectangleSizeRow', 'targetDiameter', 'targetHeight', 'scaleRecipeBtn',
      'productName', 'productCategory', 'productUnitLabel', 'productNote', 'productComponentsList', 'productComponentsEmpty', 'productComponentFormCard', 'productComponentSourceType', 'productComponentRefSelect', 'productComponentQuantity', 'productComponentUnit', 'productList', 'productCountBadge', 'productComponentDiameter', 'productComponentHeight',
      'orderDate', 'orderProductSelect', 'orderQuantity', 'orderUnit', 'orderCustomer', 'orderMemo', 'orderList', 'orderCountBadge',
      'aggregateRecipeList', 'aggregateTaskList', 'aggregateRecipeCountBadge', 'aggregateTaskCountBadge', 'batchList', 'batchCountBadge', 'batchDetailView',
      'scheduleCandidateList', 'scheduleCandidateEmpty', 'planName', 'planMemo', 'planStepList', 'planStepEmpty', 'planList', 'planCountBadge',
      'plannerMode', 'plannerStartDate', 'plannerGrid', 'planItemCountBadge', 'buildPrintViewBtn', 'printPlannerBtn', 'printPlannerView',
      'importJsonInput', 'jsonPasteArea', 'planAssignModal', 'assignMode', 'assignDaysField', 'assignDaysBefore', 'assignDateField', 'assignFixedDate', 'reservationJsonArea',
      'reservationList',
      'reservationCountBadge', 'importReservationBtn',
      'productComponentShape',
      'productComponentWidth',
      'productComponentDepth',
      'productComponentRectangleSizeRow',
      'productComponentSizeRow','productComponentCategoryFilter',
'productComponentSubCategoryFilter',
      'mergeReservationBtn',
      'replaceReservationBtn',
      'clearReservationBtn', 'reservationFilter', 'reservationCategoryFilter',
      'reservationFromDate',
      'reservationToDate',
      'clearReservationDateFilterBtn', 'productKind',
      'productUseReservationSize',
      'productAliases', 'productSalePrice',
      'calcProductCostBtn','matSubCategory','toggleRecipeCalcBtn',
'recipeCalcPanel',
'recipeCalcTargetShape',
'recipeCalcRoundRow',
'recipeCalcRectangleRow',
'recipeCalcTargetDiameter',
'recipeCalcTargetHeight',
'recipeCalcTargetRectHeight',
'recipeCalcTargetWidth',
'recipeCalcTargetDepth',
'recipeCalcQuantity',
'runRecipeCalcBtn',
'recipeCalcResult',
    ].forEach(id => els[id] = document.getElementById(id));
['rebuildReservationBtn','createUnlinkedBatchesBtn','saveMaterialMasterBtn','newMaterialMasterBtn','saveProductBtn','newProductBtn','addProductComponentBtn','saveProductComponentBtn','cancelProductComponentBtn','saveRecipeBtn','newRecipeBtn','addRecipeMaterialBtn','saveRecipeMaterialBtn','cancelRecipeMaterialBtn','addFlowBtn','saveFlowBtn','cancelFlowBtn','saveOrderBtn','newOrderBtn','runAggregateBtn','createBatchesFromAggregateBtn','loadScheduleCandidatesBtn','newPlanBtn','savePlanBtn','renderPlannerBtn','exportJsonBtn','mergeJsonBtn','replaceJsonBtn','clearJsonPasteBtn','confirmAssignBtn','cancelAssignBtn'].forEach(id => {
  if (!els[id]) els[id] = document.getElementById(id);
});

    
function getRecipeYieldPresetValues() {
      return Array.from(els.recipeYieldUnit.options).map(option => option.value);
    }

function formatDateLabel(dateStr) { const d = parseDate(dateStr); return `${d.getMonth() + 1}/${d.getDate()}`; }

function formatPrintDate(dateStr) { const d = parseDate(dateStr); const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]; return `${d.getMonth() + 1}/${d.getDate()}(${w})`; }

function findRecipe(id) { return db.recipeMasters.find(r => r.id === id); }

function findProduct(id) { return db.productMasters.find(p => p.id === id); }

function findTask(id) { return db.taskMasters.find(t => t.id === id); }

function expandProduct(productId, multiplier = 1, eventDate = '', order = null) {
      const product = findProduct(productId);
      if (!product) return [];

      return (product.components || []).map(component => ({
        productId,
        componentId: component.refId || '',
        sourceType: component.sourceType || '',
        quantity: Number(component.quantity || 0) * Number(multiplier || 1),
        unit: component.unit || '',
        eventDate,
        order
      }));
    }

function unitCostFromMaterial(mat) { const amount = Number(mat.baseAmount || 0), price = Number(mat.basePrice || 0); return amount ? price / amount : 0; }

function calculateRecipeCost(recipe) { let total = 0; (recipe.materials || []).forEach(m => { if (!m.materialId) return; const mat = db.materialsMaster.find(x => x.id === m.materialId); if (mat) total += unitCostFromMaterial(mat) * Number(m.amountValue || 0); }); return round2(total); }

function mergeById(currentList, importedList, prefix) {
      const map = new Map();
      currentList.forEach(item => { if (item && item.id) map.set(item.id, item); });
      importedList.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const cloned = deepCopy(item);
        if (!cloned.id || map.has(cloned.id)) cloned.id = createId(prefix);
        map.set(cloned.id, cloned);
      });
      return Array.from(map.values());
    }

function activateTab(tabName) { document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('is-active', p.dataset.tab === tabName)); document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tabTarget === tabName)); if (tabName === 'planner') renderPlanner(); }

function updateEditingLabel() { const name = els.recipeName.value.trim(); els.currentEditingLabel.textContent = appState.currentRecipeId ? `編集中: ${name || '名称未入力'}` : `新規レシピ作成中${name ? `: ${name}` : ''}`; }

function bindEvents() {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tabTarget)));
      document.getElementById('saveMaterialMasterBtn').addEventListener('click', saveMaterialMaster);
      document.getElementById('newMaterialMasterBtn').addEventListener('click', resetMaterialMasterEditor);
      els.materialsMasterList.addEventListener('click', handleMaterialsMasterListClick);

      document.getElementById('saveRecipeBtn').addEventListener('click', saveRecipeMaster);
      document.getElementById('newRecipeBtn').addEventListener('click', resetRecipeEditor);
      document.getElementById('addRecipeMaterialBtn').addEventListener('click', openAddRecipeMaterialForm);
      document.getElementById('saveRecipeMaterialBtn').addEventListener('click', saveRecipeMaterial);
      document.getElementById('cancelRecipeMaterialBtn').addEventListener('click', closeRecipeMaterialForm);
      els.recipeMaterialsList.addEventListener('click', handleRecipeMaterialsListClick);
      els.recipeMaterialFilterCategory.addEventListener('change', renderRecipeMaterialOptions);
      document.getElementById('addFlowBtn').addEventListener('click', openAddFlowForm);
      document.getElementById('saveFlowBtn').addEventListener('click', saveFlow);
      document.getElementById('cancelFlowBtn').addEventListener('click', closeFlowForm);
      els.flowList.addEventListener('click', handleFlowListClick);
      els.recipeMasterList.addEventListener('click', handleRecipeMasterListClick);

      document.getElementById('saveProductBtn').addEventListener('click', saveProductMaster);
      document.getElementById('newProductBtn').addEventListener('click', resetProductEditor);
      document.getElementById('addProductComponentBtn').addEventListener('click', openAddProductComponentForm);
      document.getElementById('saveProductComponentBtn').addEventListener('click', saveProductComponent);
      document.getElementById('cancelProductComponentBtn').addEventListener('click', closeProductComponentForm);
      els.productComponentSourceType.addEventListener('change', refreshProductComponentRefSelect);
      els.productList.addEventListener('click', handleProductListClick);
      els.productComponentsList.addEventListener('click', handleProductComponentsListClick);

      document.getElementById('saveOrderBtn').addEventListener('click', saveOrderItem);
      document.getElementById('importReservationBtn')
        .addEventListener('click', handleImportReservationJson);
      document.getElementById('newOrderBtn').addEventListener('click', resetOrderEditor);
      els.orderProductSelect.addEventListener('change', syncOrderUnitFromProduct);
      els.orderList.addEventListener('click', handleOrderListClick);

      document.getElementById('runAggregateBtn').addEventListener('click', runAggregate);
      document.getElementById('createBatchesFromAggregateBtn').addEventListener('click', createBatchesFromAggregate);
      els.batchList.addEventListener('click', handleBatchListClick);

      document.getElementById('loadScheduleCandidatesBtn').addEventListener('click', loadScheduleCandidates);
      document.getElementById('newPlanBtn').addEventListener('click', resetPlanEditor);
      document.getElementById('savePlanBtn').addEventListener('click', saveSchedulePlan);
      els.scheduleCandidateList.addEventListener('click', handleScheduleCandidateClick);
      els.planStepList.addEventListener('click', handlePlanStepClick);
      els.planList.addEventListener('click', handlePlanListClick);

      document.getElementById('renderPlannerBtn').addEventListener('click', renderPlanner);
      els.plannerGrid.addEventListener('click', handlePlannerGridClick);
      els.buildPrintViewBtn.addEventListener('click', buildPrintPlannerView);
      els.printPlannerBtn.addEventListener('click', () => { buildPrintPlannerView(); window.print(); });

      document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
      els.importJsonInput.addEventListener('change', importJsonFile);
      document.getElementById('mergeJsonBtn').addEventListener('click', () => importJsonFromText('merge'));
      document.getElementById('replaceJsonBtn').addEventListener('click', () => importJsonFromText('replace'));
      document.getElementById('clearJsonPasteBtn').addEventListener('click', () => els.jsonPasteArea.value = '');
      els.assignMode.addEventListener('change', renderAssignMode);
      document.getElementById('confirmAssignBtn').addEventListener('click', confirmAssignToPlanner);
      document.getElementById('cancelAssignBtn').addEventListener('click', closeAssignModal);
      document.getElementById('scaleRecipeBtn').addEventListener('click', scaleRecipeBySize);
      els.recipeYieldUnit.addEventListener('change', toggleRecipeYieldCustomField);
      document.getElementById('createUnlinkBatchesFromOrderItems');
      els.recipeBaseShape.addEventListener('change', toggleRecipeBaseSizeFields);
      els.productComponentShape.addEventListener('change', toggleproductConponentSizeFields);
      els.reservationList.addEventListener('change', handleReservationProductLinkChange);
      els.mergeReservationBtn.addEventListener('click', () => handleImportReservationJson('merge'));
      els.replaceReservationBtn.addEventListener('click', () => handleImportReservationJson('replace'));
      els.clearReservationBtn.addEventListener('click', clearReservationData);
      els.reservationFilter.addEventListener('change', renderReservations);
      els.reservationCategoryFilter.addEventListener('change', renderReservations);
      els.reservationFromDate.addEventListener('change', renderReservations);
      els.reservationToDate.addEventListener('change', renderReservations);

      els.clearReservationDateFilterBtn.addEventListener('click', () => {
        els.reservationFromDate.value = '';
        els.reservationToDate.value = '';
        renderReservations();
      });
      els.rebuildReservationBtn.addEventListener(
        'click',
        rebuildReservationData
      );
      els.calcProductCostBtn.addEventListener('click', previewCurrentProductCost);
    els.productComponentCategoryFilter.addEventListener(
  'change',
  refreshProductComponentRefSelect
);

els.productComponentSubCategoryFilter.addEventListener(
  'change',
  refreshProductComponentRefSelect
);
els.toggleRecipeCalcBtn.addEventListener('click', () => {
  els.recipeCalcPanel.classList.toggle('is-hidden');
});

els.recipeCalcTargetShape.addEventListener('change', toggleRecipeCalcShapeRows);

els.runRecipeCalcBtn.addEventListener('click', runRecipeCalcNavigator);
    }

function initialize() { loadDb(); bindEvents(); resetMaterialMasterEditor(); resetRecipeEditor(); resetProductEditor(); resetOrderEditor(); resetPlanEditor(); els.plannerStartDate.value = getTodayString(); refreshAll(); }

function toggleRecipeYieldCustomField() {
      const isCustom = els.recipeYieldUnit.value === '自由入力';
      els.recipeYieldCustomField.classList.toggle('is-hidden', !isCustom);
      if (!isCustom) {
        els.recipeYieldCustomUnit.value = '';
      }
    }

function toggleRecipeBaseSizeFields() {
      const isRectangle = els.recipeBaseShape.value === 'rectangle';

      if (els.recipeRoundSizeRow) {
        els.recipeRoundSizeRow.classList.toggle('is-hidden', isRectangle);
      }

      if (els.recipeRectangleSizeRow) {
        els.recipeRectangleSizeRow.classList.toggle('is-hidden', !isRectangle);
      }
    }

function toggleproductConponentSizeFields() {
      const isRectangle = els.productComponentShape.value === 'rectangle';

      if (els.productComponentSizeRow) {
        // 今は全体は表示したまま
      }

      if (els.productComponentRectangleSizeRow) {
        els.productComponentRectangleSizeRow.classList.toggle('is-hidden', !isRectangle);
      }
    }

function refreshAll() { renderMaterialsMasterList(); renderRecipeMaterials(); renderFlows(); renderRecipeMasterList(); renderProductComponents(); renderProductList(); renderOrderList(); renderAggregate(); renderBatchList(); renderScheduleCandidates(); renderPlanSteps(); renderPlanList(); renderPlanner(); refreshRecipeMaterialSelect(); refreshProductComponentRefSelect(); refreshOrderProductSelect(); updateRecipeCostLabel(); updateEditingLabel(); toggleRecipeYieldCustomField(); persistDb(); }
