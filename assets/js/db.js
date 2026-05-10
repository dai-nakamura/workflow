    const STORAGE_KEY = 'production_design_app_final_clean_v1';
    let db = {
      materialsMaster: [],
      recipeMasters: [],
      productMasters: [],
      orders: [],
      orderItems: [],
      productionBatches: [],
      taskMasters: [
        { id: 'task_box_pack', name: '箱詰め', category: '包装', defaultDurationMinutes: 20, equipment: '作業台', canParallel: true, note: '' },
        { id: 'task_finish_cake', name: 'ケーキ仕上げ', category: '仕上げ', defaultDurationMinutes: 30, equipment: '作業台', canParallel: false, note: '' },
        { id: 'task_plating', name: '盛り付け', category: 'デセール', defaultDurationMinutes: 30, equipment: '作業台', canParallel: false, note: '' }
      ],
      schedulePlans: [],
      planItems: [],
      reservationOrders: [],
      reservationOrderItems: [],
   cakeSizePresets: [
  { label: '9cm', shape: 'round', diameter: 90, height: 45 },
  { label: '5号', shape: 'round', diameter: 150, height: 45 },
  { label: '6号', shape: 'round', diameter: 180, height: 45 },
  { label: '7号', shape: 'round', diameter: 210, height: 45 },
  { label: '尺', shape: 'round', diameter: 300, height: 45 }
],
productAliases: [
  {
    id: 'alias_wedding_cake',
    keyword: 'ウェディングケーキ',
    productId: 'ここに商品マスターID'
  },
  {
    id: 'alias_plate_dessert',
    keyword: '皿盛りデザート',
    productId: 'ここに商品マスターID'
  }
]
    };

       let appState = {
      currentMaterialMasterId: null,
      currentRecipeId: null,
      currentProductId: null,
      currentOrderId: null,
      currentBatchId: null,
      editingRecipeMaterialIndex: null,
      editingFlowIndex: null,
      editingProductComponentIndex: null,
      currentRecipeMaterials: [],
      currentRecipeFlows: [],
      currentProductComponents: [],
      currentScheduleCandidates: [],
      currentPlanId: null,
      currentPlanSteps: [],
      aggregateResult: {
        recipeTotals: [],
        taskTotals: [],
        materialTotals: [],
        unmatchedItems: []
      },
      pendingPlanStepIndex: null
    };
function persistDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

    if (window.els && els.storageStatus) {
      els.storageStatus.textContent = '端末内保存中';
    }
  } catch (e) {
    console.error(e);

    if (window.els && els.storageStatus) {
      els.storageStatus.textContent = '保存失敗';
    }
  }
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);

    Object.keys(db).forEach(k => {
      if (Array.isArray(parsed[k])) {
        db[k] = parsed[k];
      }
    });
  } catch (e) {
    console.error(e);

    if (window.els && els.storageStatus) {
      els.storageStatus.textContent = '保存読込エラー';
    }
  }
}
 
