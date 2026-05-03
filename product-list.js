// ========================================
// PRODUCT LIST MODULE
// ========================================

const ProductList = (() => {
    const STORAGE_KEY = 'bizmanager_products';
    let products = [];
    let currentShopId = null;
    let editingId = null;
    let sortField = 'name';
    let sortAsc = true;
    let filterJenis = 'all';
    let searchQuery = '';

    // ---- JENIS PRODUK ----
    const jenisOptions = [
        { value: 'fashion', label: '👕 Fashion', color: '#ec4899' },
        { value: 'elektronik', label: '📱 Elektronik', color: '#3b82f6' },
        { value: 'makanan', label: '🍜 Makanan & Minuman', color: '#f97316' },
        { value: 'kecantikan', label: '💄 Kecantikan', color: '#a855f7' },
        { value: 'rumah', label: '🏠 Rumah Tangga', color: '#22c55e' },
        { value: 'kesehatan', label: '💊 Kesehatan', color: '#06b6d4' },
        { value: 'olahraga', label: '⚽ Olahraga', color: '#eab308' },
        { value: 'otomotif', label: '🚗 Otomotif', color: '#ef4444' },
        { value: 'lainnya', label: '📦 Lainnya', color: '#64748b' }
    ];

    function getJenisLabel(value) {
        const j = jenisOptions.find(o => o.value === value);
        return j ? j.label : value;
    }

    function getJenisColor(value) {
        const j = jenisOptions.find(o => o.value === value);
        return j ? j.color : '#64748b';
    }

    // ---- STORAGE ----
    async function load() {
        try {
            const data = await StorageManager.getItem(STORAGE_KEY);
            products = data ? JSON.parse(data) : [];
            
            // Migrate legacy products that don't have shopId
            const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
            const defaultShop = shops.length > 0 ? shops[0].id : 'shop_default';
            let migrated = false;
            products.forEach(p => {
                if (!p.shopId) {
                    p.shopId = defaultShop;
                    migrated = true;
                }
            });
            if (migrated) save();

        
        } catch(e) {
            products = [];
        }
        await deduplicateProducts();

            // Rescue orphaned products (shopId doesn't match any registered shop)
            const registeredShops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
            const registeredIds = new Set(registeredShops.map(s => s.id));
            
            let orphanCount = 0;
            products.forEach(p => {
                if (p.shopId && !registeredIds.has(p.shopId)) {
                    // Try to find the best match based on the old shopId name
                    const oldId = p.shopId.toLowerCase();
                    let bestShop = null;
                    
                    // Check if old ID contains hints about which shop it belongs to
                    for (const shop of registeredShops) {
                        const shopName = shop.name.toLowerCase();
                        const shopId = shop.id.toLowerCase();
                        if (oldId.includes(shopId) || shopId.includes(oldId) || 
                            oldId.includes(shopName.split(' ')[0]) || shopName.includes(oldId)) {
                            bestShop = shop;
                            break;
                        }
                    }
                    
                    // If no match found, assign to first shop of same type or first shop overall
                    if (!bestShop && registeredShops.length > 0) {
                        bestShop = registeredShops[0];
                    }
                    
                    if (bestShop) {
                        console.log(`🔧 Rescued orphan product "${p.name.substring(0,40)}" from "${p.shopId}" → "${bestShop.id}" (${bestShop.name})`);
                        p.shopId = bestShop.id;
                        orphanCount++;
                    }
                }
            });
            
            if (orphanCount > 0) {
                console.log(`🔧 Rescued ${orphanCount} orphaned products`);
                await save();
                if (typeof showToast !== 'undefined') {
                    showToast(`🔧 ${orphanCount} produk yatim berhasil dipulihkan ke toko yang tersedia`, 'info');
                }
            }
    }

    async function deduplicateProducts() {
        const backup = JSON.stringify(products);
        try {
            const nameMap = new Map();
            const merged = [];
            let dupeCount = 0;

            products.forEach(p => {
                const shopPrefix = p.shopId || 'unknown';
                const key = shopPrefix + '_' + p.name.trim().toLowerCase();
                if (nameMap.has(key)) {
                    // Merge variations into existing product
                    const existing = nameMap.get(key);
                    const existingVars = existing.variations || [];
                    const newVars = p.variations || [];

                    // Add new variations that don't already exist (by name)
                    newVars.forEach(nv => {
                        const alreadyExists = existingVars.some(ev => 
                            ev.name && nv.name && ev.name.trim().toLowerCase() === nv.name.trim().toLowerCase()
                        );
                        if (!alreadyExists) {
                            existingVars.push(nv);
                        } else if ((nv.modal || 0) > 0) {
                            // If duplicate var exists but new one has modal, update the existing one
                            const existingVar = existingVars.find(ev => 
                                ev.name && nv.name && ev.name.trim().toLowerCase() === nv.name.trim().toLowerCase()
                            );
                            if (existingVar && (existingVar.modal || 0) === 0) {
                                existingVar.modal = nv.modal;
                                console.log(`🔄 Dedup: Updated modal for "${nv.name}" → ${nv.modal}`);
                            }
                        }
                    });
                    existing.variations = existingVars;

                    // Update legacy prices if the merged product has better data
                    if (existingVars.length > 0) {
                        const prices = existingVars.map(v => v.hargaJual || 0).filter(x => x > 0);
                        const modals = existingVars.map(v => v.modal || 0).filter(x => x > 0);
                        if (prices.length) existing.hargaJual = Math.max(...prices);
                        if (modals.length) existing.modal = modals[0];
                    }

                    dupeCount++;
                    console.log(`🔄 Dedup: Merged "${p.name.substring(0,40)}" into existing (dupeCount=${dupeCount})`);
                } else {
                    nameMap.set(key, p);
                    merged.push(p);
                }
            });

            if (dupeCount > 0) {
                console.log(`🔄 Dedup: ${dupeCount} duplicates merged. Before: ${products.length}, After: ${merged.length}`);
                products = merged;
            }

            // Sort variations alphabetically by name so identical names are grouped
            let sorted = false;
            products.forEach(p => {
                if (p.variations && p.variations.length > 1) {
                    let isAlreadySorted = true;
                    for (let i = 0; i < p.variations.length - 1; i++) {
                        if ((p.variations[i].name || '').localeCompare(p.variations[i+1].name || '') > 0) {
                            isAlreadySorted = false;
                            break;
                        }
                    }
                    if (!isAlreadySorted) {
                        p.variations.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                        sorted = true;
                    }
                }
            });

            if (dupeCount > 0 || sorted) {
                await save();
                if (dupeCount > 0) console.log(`[ProductList] Merged ${dupeCount} duplicate products`);
            }
        } catch (e) {
            console.error('❌ Deduplication failed, restoring backup:', e);
            products = JSON.parse(backup);
            throw e;
        }
    }

    async function save() {
        await StorageManager.setItem(STORAGE_KEY, JSON.stringify(products));
    }

    function getProducts() {
        return products;
    }

    // ---- CRUD ----
    function addProduct(p) {
        p.id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        p.createdAt = new Date().toISOString();
        p.updatedAt = p.createdAt;
        p.shopId = currentShopId;
        products.unshift(p);
        save();
        return p;
    }

    function updateProduct(id, data) {
        const idx = products.findIndex(p => p.id === id);
        if (idx !== -1) {
            products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
            save();
        }
    }

    function deleteProduct(id) {
        products = products.filter(p => p.id !== id);
        save();
    }

    // ---- FILTERING & SORTING ----
    function getFilteredProducts() {
        let filtered = products.filter(p => !currentShopId || p.shopId === currentShopId);

        if (filterJenis !== 'all') {
            filtered = filtered.filter(p => p.jenis === filterJenis);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
        }

        filtered.sort((a, b) => {
            let va = a[sortField], vb = b[sortField];
            if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });

        return filtered;
    }

    // ---- RENDER ----
    function renderProductGrid() {
        const filtered = getFilteredProducts();
        const container = document.getElementById('productGridBody');
        const countEl = document.getElementById('productCount');

        countEl.textContent = `${filtered.length} produk`;

        if (filtered.length === 0) {
            container.innerHTML = '<div class="product-empty">Belum ada produk. Klik "+ Produk Baru" untuk menambah.</div>';
            return;
        }

        let html = '<div class="product-list">';

        filtered.forEach((p, idx) => {
            const vars = p.variations && p.variations.length > 0 ? p.variations : [{ modal: p.modal || 0, hargaJual: p.hargaJual || 0, name: 'Default' }];
            const minModal = Math.min(...vars.map(v => v.modal || 0));
            const maxModal = Math.max(...vars.map(v => v.modal || 0));
            const minJual = Math.min(...vars.map(v => v.hargaJual || 0));
            const maxJual = Math.max(...vars.map(v => v.hargaJual || 0));

            const displayModal = minModal === maxModal ? formatRupiah(minModal) : `${formatRupiah(minModal)} - ${formatRupiah(maxModal)}`;
            const displayJual = minJual === maxJual ? formatRupiah(minJual) : `${formatRupiah(minJual)} - ${formatRupiah(maxJual)}`;

            const jenisColor = getJenisColor(p.jenis);
            const thumb = p.image
                ? `<img src="${p.image}" class="plist-thumb" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const thumbPlaceholder = `<div class="plist-thumb-ph" ${p.image ? 'style="display:none"' : ''}>📦</div>`;

            html += `
                <div class="plist-item" data-id="${p.id}">
                    <div class="plist-row" onclick="ProductList.toggleVariations('${p.id}')">
                        <div class="plist-toggle" id="plist-arrow-${p.id}">▶</div>
                        <div class="plist-img">${thumb}${thumbPlaceholder}</div>
                        <div class="plist-info">
                            <div class="plist-name">${escapeHtml(p.name)}</div>
                            <div class="plist-meta">
                                <span class="plist-badge" style="background:${jenisColor}20;color:${jenisColor};border:1px solid ${jenisColor}40;">${getJenisLabel(p.jenis)}</span>
                                <span class="plist-var-count">${vars.length} variasi</span>
                            </div>
                        </div>
                        <div class="plist-prices">
                            <div class="plist-price-col">
                                <span class="plist-price-label">Modal</span>
                                <span class="plist-price-val">${displayModal}</span>
                            </div>
                            <div class="plist-price-col">
                                <span class="plist-price-label">Jual</span>
                                <span class="plist-price-val plist-jual">${displayJual}</span>
                            </div>
                        </div>
                        <button class="plist-edit-btn" onclick="event.stopPropagation();ProductList.openEditModal('${p.id}')" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                    </div>
                    <div class="plist-vars hidden" id="plist-vars-${p.id}">
                        <table class="plist-var-table">
                            <thead><tr><th>Variasi</th><th>SKU</th><th>Modal (Rp)</th><th>Harga Jual (Rp)</th><th>Profit</th></tr></thead>
                            <tbody>
                                ${vars.map((v, vi) => {
                                    const profit = (v.hargaJual || 0) - (v.modal || 0);
                                    const profitCls = profit >= 0 ? 'profit-positive' : 'profit-negative';
                                    return `<tr>
                                        <td style="font-weight:600;font-size:12px;">${escapeHtml(v.name || 'Default')}</td>
                                        <td style="color:var(--text-muted);font-size:11px;">${escapeHtml(v.sku || '-')}</td>
                                        <td><input type="text" class="plist-inline-input" value="${v.modal || ''}" data-pid="${p.id}" data-vidx="${vi}" data-field="modal" onchange="ProductList.inlineSaveVar(this)" inputmode="numeric"></td>
                                        <td><input type="text" class="plist-inline-input" value="${v.hargaJual || ''}" data-pid="${p.id}" data-vidx="${vi}" data-field="hargaJual" onchange="ProductList.inlineSaveVar(this)" inputmode="numeric"></td>
                                        <td class="${profitCls}" style="font-size:12px;font-weight:600;">${formatRupiah(profit)}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    function toggleVariations(productId) {
        const varsEl = document.getElementById(`plist-vars-${productId}`);
        const arrowEl = document.getElementById(`plist-arrow-${productId}`);
        if (!varsEl) return;
        const isHidden = varsEl.classList.contains('hidden');
        varsEl.classList.toggle('hidden');
        if (arrowEl) arrowEl.textContent = isHidden ? '▼' : '▶';
    }

    function inlineSaveVar(inputEl) {
        const pid = inputEl.dataset.pid;
        const vidx = parseInt(inputEl.dataset.vidx);
        const field = inputEl.dataset.field;
        const value = parseInt(String(inputEl.value).replace(/[^\d]/g, '')) || 0;

        const product = products.find(p => p.id === pid);
        if (!product || !product.variations || !product.variations[vidx]) return;

        product.variations[vidx][field] = value;
        product.updatedAt = new Date().toISOString();

        // Update legacy fields
        if (product.variations.length > 0) {
            const maxJual = Math.max(...product.variations.map(v => v.hargaJual || 0));
            const withModal = product.variations.find(v => (v.modal || 0) > 0);
            product.modal = withModal ? withModal.modal : 0;
            product.hargaJual = maxJual > 0 ? maxJual : 0;
        }

        save();

        // Update the profit cell in the same row
        const row = inputEl.closest('tr');
        if (row) {
            const modal = parseInt(String(row.querySelector('[data-field="modal"]').value).replace(/[^\d]/g, '')) || 0;
            const jual = parseInt(String(row.querySelector('[data-field="hargaJual"]').value).replace(/[^\d]/g, '')) || 0;
            const profit = jual - modal;
            const profitCell = row.querySelector('td:last-child');
            profitCell.className = profit >= 0 ? 'profit-positive' : 'profit-negative';
            profitCell.textContent = formatRupiah(profit);
        }

        showToast('Harga disimpan!', 'success');
    }

    // ---- MODAL ----
    function renderVariationRow(v = { id: Date.now() + Math.random().toString(36).substr(2, 5), name: '', sku: '', modal: 0, hargaJual: 0 }) {
        const div = document.createElement('div');
        div.className = 'variation-row';
        div.style.cssText = 'background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:10px; position:relative;';
        div.innerHTML = `
            <button type="button" class="btn-remove-var" style="position:absolute; top:8px; right:8px; background:transparent; border:none; color:var(--text-muted); cursor:pointer;">✕</button>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
                <div>
                    <label style="font-size:11px; margin-bottom:4px;">Nama Variasi</label>
                    <input type="text" class="form-input var-name" placeholder="Misal: Merah / XL" value="${escapeHtml(v.name)}">
                </div>
                <div>
                    <label style="font-size:11px; margin-bottom:4px;">SKU (Opsional)</label>
                    <input type="text" class="form-input var-sku" placeholder="SKU" value="${escapeHtml(v.sku || '')}">
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                    <label style="font-size:11px; margin-bottom:4px;">Harga Modal</label>
                    <input type="text" class="form-input var-modal" placeholder="0" inputmode="numeric" value="${v.modal ? formatRupiah(v.modal) : ''}">
                </div>
                <div>
                    <label style="font-size:11px; margin-bottom:4px;">Harga Jual</label>
                    <input type="text" class="form-input var-jual" placeholder="0" inputmode="numeric" value="${v.hargaJual ? formatRupiah(v.hargaJual) : ''}">
                </div>
            </div>
        `;

        const btnRemove = div.querySelector('.btn-remove-var');
        btnRemove.addEventListener('click', () => {
            if (document.querySelectorAll('.variation-row').length > 1) div.remove();
            else showToast('Minimal harus ada 1 variasi', 'warning');
        });

        // Setup Rupiah masking
        ProfitCalculator.setupRupiahInput(div.querySelector('.var-modal'));
        ProfitCalculator.setupRupiahInput(div.querySelector('.var-jual'));

        return div;
    }

    function openAddModal() {
        editingId = null;
        document.getElementById('productModalTitle').textContent = 'Produk Baru';
        document.getElementById('productName').value = '';
        document.getElementById('productJenis').value = 'fashion';

        const varList = document.getElementById('productVariationsList');
        varList.innerHTML = '';
        varList.appendChild(renderVariationRow());

        document.getElementById('productDeleteBtn').classList.add('hidden');
        document.getElementById('productModalOverlay').classList.remove('hidden');
    }

    function openEditModal(id) {
        const p = products.find(x => x.id === id);
        if (!p) return;

        editingId = id;
        document.getElementById('productModalTitle').textContent = 'Edit Produk';
        document.getElementById('productName').value = p.name;
        document.getElementById('productJenis').value = p.jenis;

        const varList = document.getElementById('productVariationsList');
        varList.innerHTML = '';
        
        const vars = p.variations && p.variations.length > 0 ? p.variations : [{ id: 1, name: 'Default', modal: p.modal || 0, hargaJual: p.hargaJual || 0 }];
        vars.forEach(v => varList.appendChild(renderVariationRow(v)));

        document.getElementById('productDeleteBtn').classList.remove('hidden');
        document.getElementById('productModalOverlay').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('productModalOverlay').classList.add('hidden');
        editingId = null;
    }

    function saveModal() {
        const name = document.getElementById('productName').value.trim();
        if (!name) {
            showToast('Nama produk harus diisi', 'warning');
            return;
        }

        const variations = [];
        document.querySelectorAll('.variation-row').forEach(row => {
            const vName = row.querySelector('.var-name').value.trim() || 'Default';
            const vSku = row.querySelector('.var-sku').value.trim();
            const vModal = ProfitCalculator.parseRupiah(row.querySelector('.var-modal').value);
            const vJual = ProfitCalculator.parseRupiah(row.querySelector('.var-jual').value);
            variations.push({
                id: Date.now() + Math.random().toString(36).substr(2, 5),
                name: vName,
                sku: vSku,
                modal: vModal,
                hargaJual: vJual
            });
        });

        if (variations.length === 0) {
            showToast('Minimal harus ada 1 variasi', 'warning');
            return;
        }

        const data = {
            name,
            jenis: document.getElementById('productJenis').value,
            variations: variations,
            // Legacy flat fields for backward compatibility when read by other scripts
            modal: variations.find(v => (v.modal || 0) > 0)?.modal || 0,
            hargaJual: Math.max(...variations.map(v => v.hargaJual || 0))
        };

        if (editingId) {
            updateProduct(editingId, data);
            showToast('Produk berhasil diupdate!', 'success');
        } else {
            addProduct(data);
            showToast('Produk baru ditambahkan!', 'success');
        }

        closeModal();
        renderProductGrid();
        if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
    }

    async function deleteFromModal() {
        if (!editingId) return;
        const ok = await AppModal.confirm('Hapus produk ini?', 'Hapus Produk', 'danger');
        if (!ok) return;
        deleteProduct(editingId);
        closeModal();
        renderProductGrid();
        showToast('Produk dihapus', 'success');
        if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
    }

    // ---- HELPERS ----
    function formatRupiah(num) {
        return ProfitCalculator.formatRupiah(num);
    }

    // ---- IMPORT FROM SHOPEE EXCEL ----
    function importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.csv';
        input.addEventListener('change', (e) => {
            if (e.target.files[0]) processImportFile(e.target.files[0]);
        });
        input.click();
    }

    function processImportFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];

                // FIX: Some platform exports (like TikTok) have a broken !ref property 
                // that cuts off the data. Recalculate it based on actual cells.
                if (sheet) {
                    let maxRow = 0; let maxCol = 0;
                    Object.keys(sheet).forEach(k => {
                        if (k[0] === '!') return;
                        const coord = XLSX.utils.decode_cell(k);
                        if (coord.r > maxRow) maxRow = coord.r;
                        if (coord.c > maxCol) maxCol = coord.c;
                    });
                    sheet['!ref'] = XLSX.utils.encode_range({s: {r:0, c:0}, e: {r:maxRow, c:maxCol}});
                }

                const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (allRows.length < 4) {
                    showToast('File terlalu pendek / kosong', 'warning');
                    return;
                }

                let headerRowIdx = -1;
                let dataStartIdx = 1;
                let isMediaInfo = false;
                let isShopeeFormat = false;
                let isTikTokFormat = false;

                allRows.forEach((row, i) => {
                    if (headerRowIdx !== -1) return;
                    const joined = (row || []).join(' ').toLowerCase();
                    if (joined.includes('foto sampul') && joined.includes('kode produk')) {
                        headerRowIdx = i;
                        isMediaInfo = true;
                        return;
                    }
                    if (joined.includes('nama produk') && joined.includes('harga')) {
                        headerRowIdx = i;
                        isShopeeFormat = true;
                        return;
                    }
                    if ((joined.includes('product name') || joined.includes('product title') || joined.includes('nama produk'))
                        && (joined.includes('price') || joined.includes('harga') || joined.includes('sale') || joined.includes('retail'))) {
                        headerRowIdx = i;
                        isTikTokFormat = true;
                        return;
                    }
                });

                if (headerRowIdx === -1) {
                    headerRowIdx = 0;
                }

                if (isShopeeFormat || isTikTokFormat) {
                    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
                        const firstCell = String(allRows[i]?.[0] || '').trim();
                        if (/^\d{5,}$/.test(firstCell) || allRows[i].length > 5) {
                            if (firstCell.toLowerCase() === 'wajib' || firstCell.toLowerCase() === 'opsional' || String(allRows[i]?.[4]).toLowerCase() === 'wajib') {
                                continue;
                            }
                            dataStartIdx = i;
                            break;
                        }
                    }
                }

                const headers = allRows[headerRowIdx].map(h => String(h || '').trim());

                // Map columns
                const colMap = {};
                headers.forEach((h, idx) => {
                    const low = h.toLowerCase();
                    if (low.includes('nama produk') || low === 'et_title_product_name') colMap.name = idx;
                    if (low.includes('kode produk') || low === 'et_title_product_id') colMap.productId = idx;
                    if (low.includes('nama variasi') || low === 'et_title_variation_name') colMap.variation = idx;
                    if (low.includes('harga') && !low.includes('start') && !low.includes('end') || low === 'et_title_variation_price') colMap.price = idx;
                    if (low.includes('stok') || low === 'et_title_variation_stock') colMap.stock = idx;
                    if (low.includes('sku') && !low.includes('induk') && !low.includes('parent')) colMap.sku = idx;
                    if (low.includes('foto sampul') || low === 'ps_item_cover_image') colMap.coverImage = idx;
                });

                if (isMediaInfo) {
                    importMedia(allRows, colMap, dataStartIdx);
                    return;
                }

                const isTikTokProductTemplate = isTikTokFormat || detectTikTokProductTemplate(headers);
                if (isTikTokProductTemplate) {
                    parseTikTokProductFile(allRows, headers, headerRowIdx, file.name);
                    return;
                }

                if (colMap.name === undefined) {
                    showToast('Kolom "Nama Produk" tidak ditemukan', 'warning');
                    return;
                }

                // Parse rows — group by product ID to merge variations
                const productMap = new Map();
                let importCount = 0;

                for (let i = dataStartIdx; i < allRows.length; i++) {
                    const row = allRows[i];
                    if (!row || !row[colMap.name]) continue;

                    const name = String(row[colMap.name] || '').trim();
                    if (!name) continue;

                    const productId = colMap.productId !== undefined ? String(row[colMap.productId] || '').trim() : '';
                    const variation = colMap.variation !== undefined ? String(row[colMap.variation] || '').trim() : '';
                    const price = colMap.price !== undefined ? parseInt(String(row[colMap.price] || '0').replace(/[^\d]/g, '')) || 0 : 0;
                    const stock = colMap.stock !== undefined ? parseInt(String(row[colMap.stock] || '0')) || 0 : 0;
                    const sku = colMap.sku !== undefined ? String(row[colMap.sku] || '').trim() : '';

                    const key = productId || name;

                    if (productMap.has(key)) {
                        const existing = productMap.get(key);
                        // Add variation info
                        if (variation || price > 0 || stock > 0) {
                            existing.variations.push({ variation: variation || name, price, stock, sku });
                        }
                        if (price > 0) {
                            if (price < existing.minPrice) existing.minPrice = price;
                            if (price > existing.maxPrice) existing.maxPrice = price;
                        }
                        existing.totalStock += stock;
                    } else {
                        productMap.set(key, {
                            name,
                            productId,
                            variations: variation || price > 0 ? [{ variation: variation || name, price, stock, sku }] : [],
                            minPrice: price || Infinity,
                            maxPrice: price || 0,
                            totalStock: stock,
                            sku
                        });
                        importCount++;
                    }
                }

                if (importCount === 0) {
                    showToast('Tidak ada data produk yang ditemukan', 'warning');
                    return;
                }

                // Show import preview modal
                showImportPreview(productMap, file.name);

            } catch (err) {
                showToast('Error membaca file: ' + err.message, 'error');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function detectTikTokProductTemplate(headers) {
        const normalized = headers.map(h => String(h || '').trim().toLowerCase());
        const hasProductName = normalized.some(h => /product name|product title|nama produk|nama produk utama|item name|title/.test(h));
        const hasPrice = normalized.some(h => /sale price|retail price|unit price|price|harga jual|harga ritel|harga|price \(rupiah\)/.test(h));
        const hasVariation = normalized.some(h => /variation|variasi|sku name|variation name|nama variasi|variant name|nilai variasi/.test(h));
        const hasImage = normalized.some(h => /cover image|main image|image|foto sampul|foto utama|gambar utama|primary image|image url|image link/.test(h));
        return hasProductName && hasPrice && (hasVariation || hasImage);
    }

    function findHeaderIndex(headers, keywords) {
        const normalized = headers.map(h => String(h || '').trim().toLowerCase());
        for (let i = 0; i < normalized.length; i++) {
            if (keywords.some(k => normalized[i] === k.toLowerCase())) return i;
        }
        for (let i = 0; i < normalized.length; i++) {
            if (keywords.some(k => normalized[i].includes(k.toLowerCase()))) return i;
        }
        return -1;
    }

    function parseTikTokProductFile(allRows, headers, headerRowIdx, fileName) {
        const col = {
            name: findHeaderIndex(headers, ['product name', 'product title', 'product', 'nama produk', 'item name', 'title']),
            variation: findHeaderIndex(headers, ['variation', 'variation name', 'nama variasi', 'sku name', 'variasi', 'variant name', 'nilai variasi']),
            price: findHeaderIndex(headers, ['sale price', 'retail price', 'unit price', 'price', 'harga jual', 'harga ritel', 'harga', 'price (rupiah)']),
            image: findHeaderIndex(headers, ['cover image', 'main image', 'image', 'foto sampul', 'foto utama', 'gambar utama', 'primary image', 'image url', 'image link']),
            productId: findHeaderIndex(headers, ['product id', 'item id', 'seller product id', 'kode produk', 'id produk', 'sku id'])
        };

        if (col.name === -1 || col.price === -1) {
            showToast('Format Excel TikTok tidak dikenali. Pastikan file berisi kolom nama produk dan harga.', 'warning');
            return;
        }

        const productMap = new Map();
        let importCount = 0;
        let dataStartIdx = headerRowIdx + 1;

        const rowLooksLikeInstruction = (value) => {
            if (!value) return false;
            const text = String(value).trim().toLowerCase();
            return /panjang nama produk|masukkan judul produk|judul harus|wajib|opsional|harus kurang dari|karakter|contoh|masukkan|gunakan format|field/i.test(text);
        };

        // Skip any descriptive row right after header
        if (rowLooksLikeInstruction(allRows[dataStartIdx]?.[col.name]) || rowLooksLikeInstruction(allRows[dataStartIdx]?.[0])) {
            dataStartIdx++;
        }

        for (let i = dataStartIdx; i < allRows.length; i++) {
            const row = allRows[i];
            if (!row || row.length === 0) continue;

            const name = String(row[col.name] || '').trim();
            if (!name || rowLooksLikeInstruction(name)) continue;

            const variation = col.variation !== -1 ? String(row[col.variation] || '').trim() : 'Default';
            const price = col.price !== -1 ? parseInt(String(row[col.price] || '').replace(/[^0-9]/g, '')) || 0 : 0;
            const image = col.image !== -1 ? String(row[col.image] || '').trim() : '';
            const productId = col.productId !== -1 ? String(row[col.productId] || '').trim() : '';

            // Accept row if it has a valid product name (even if other fields are empty)
            // This allows for products with no price/variation/image yet
            const productKey = productId || name;

            if (productMap.has(productKey)) {
                const existing = productMap.get(productKey);
                if (variation || price > 0) {
                    existing.variations.push({ variation: variation || 'Default', price, sku: '' });
                }
                if (price > 0) {
                    existing.minPrice = Math.min(existing.minPrice, price);
                    existing.maxPrice = Math.max(existing.maxPrice, price);
                }
                if (!existing.image && image) existing.image = image;
                existing.productId = existing.productId || productId;
                existing.totalRows += 1;
            } else {
                productMap.set(productKey, {
                    name,
                    productId,
                    image: image || '',
                    variations: [{ variation: variation || 'Default', price, sku: '' }],
                    minPrice: price || Infinity,
                    maxPrice: price || 0,
                    totalRows: 1
                });
                importCount++;
            }
        }

        if (importCount === 0) {
            showToast('Tidak ada data produk TikTok yang ditemukan. Pastikan file sudah berisi baris produk, bukan hanya template instruksi.', 'warning');
            return;
        }

        showImportPreview(productMap, fileName, 'TikTok');
    }

    function showImportPreview(productMap, fileName, sourceLabel = 'Shopee') {
        const items = [...productMap.values()];
        const hasImage = items.some(item => item.image && String(item.image).trim() !== '');

        let html = `<div style="max-height:400px;overflow-y:auto;">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                📁 <strong>${escapeHtml(fileName)}</strong> — ${items.length} produk unik ditemukan dari ${escapeHtml(sourceLabel)}
            </p>
            <table class="scrape-table">
                <thead><tr>
                    <th>#</th><th>Nama Produk</th><th>Variasi</th><th>Harga</th>${hasImage ? '<th>Gambar</th>' : ''}<th>Stok</th>
                </tr></thead><tbody>`;

        items.slice(0, 30).forEach((item, i) => {
            const priceDisplay = item.minPrice === item.maxPrice || item.minPrice === Infinity
                ? formatRupiah(item.maxPrice)
                : `${formatRupiah(item.minPrice)} - ${formatRupiah(item.maxPrice)}`;
            const imageCell = hasImage ? `<td>${item.image ? `<a href="${escapeHtml(item.image)}" target="_blank">Preview</a>` : '-'}</td>` : '';
            html += `<tr>
                <td>${i + 1}</td>
                <td style="max-width:250px;"><div class="scrape-product-title">${escapeHtml(item.name)}</div></td>
                <td>${item.variations.length} variasi</td>
                <td class="scrape-price">${priceDisplay}</td>${imageCell}
                <td>${item.totalStock !== undefined ? item.totalStock : '-'}</td>
            </tr>`;
        });

        if (items.length > 30) html += `<tr><td colspan="5" style="text-align:center">... dan ${items.length - 30} produk lainnya</td></tr>`;
        html += '</tbody></table></div>';

        html += `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color);">
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                ⚠️ Harga produk akan dimasukkan sebagai <strong>Harga Jual</strong>. Harga modal dapat diupdate manual nanti.
            </p>
            <div style="display:flex;gap:8px;">
                <button class="btn-add-task" id="btnConfirmImport">💾 Import ${items.length} Produk</button>
                <button class="btn-modal-cancel" id="btnCancelImport">Batal</button>
            </div>
        </div>`;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal" style="max-width:700px;">
            <div class="modal-header"><h3>📊 Import Produk dari Shopee</h3><button class="modal-close" id="importPreviewClose">✕</button></div>
            <div class="modal-body">${html}</div></div>`;
        document.body.appendChild(overlay);

        const closeOverlay = () => overlay.remove();
        overlay.querySelector('#importPreviewClose').addEventListener('click', closeOverlay);
        overlay.querySelector('#btnCancelImport').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

        overlay.querySelector('#btnConfirmImport').addEventListener('click', () => {
            let count = 0;
            items.forEach(item => {
                // Check if product already exists by name (avoid duplicates)
                const exists = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
                if (exists) return; // skip duplicates

                addProduct({
                    name: item.name,
                    jenis: 'lainnya', // default — user can change later
                    shopeeId: item.productId,
                    image: item.image || '',
                    variations: item.variations.map((v, idx) => ({
                        id: 'var-' + idx + '-' + Math.random().toString(36).substr(2, 5),
                        name: v.variation,
                        sku: v.sku,
                        modal: 0,
                        hargaJual: v.price
                    })),
                    // Legacy properties
                    modal: 0,
                    hargaJual: item.maxPrice || 0,
                    sku: item.sku,
                    totalStock: item.totalStock || 0
                });
                count++;
            });

            closeOverlay();
            renderProductGrid();
            showToast(`${count} produk berhasil diimport! ${items.length - count > 0 ? `(${items.length - count} duplikat dilewati)` : ''}`, 'success');
            if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
        });
    }

    function importMedia(allRows, colMap, dataStartIdx) {
        if (colMap.productId === undefined || colMap.coverImage === undefined) {
            showToast('Format Media Info tidak sesuai (butuh Kode Produk & Foto Sampul)', 'error');
            return;
        }

        let updateCount = 0;
        for (let i = dataStartIdx; i < allRows.length; i++) {
            const row = allRows[i];
            if (!row || !row[colMap.productId]) continue;

            const productId = String(row[colMap.productId]).trim();
            const coverImage = String(row[colMap.coverImage] || '').trim();

            if (!productId || !coverImage) continue;

            const product = products.find(p => p.shopeeId === productId);
            if (product && coverImage && coverImage.startsWith('http')) {
                product.image = coverImage;
                updateCount++;
            }
        }

        if (updateCount > 0) {
            save();
            renderProductGrid();
            showToast(`${updateCount} gambar produk berhasil ditempelkan!`, 'success');
            if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
        } else {
            showToast('Tidak ada gambar baru ditambahkan (mungkin produk belum diimport)', 'warning');
        }
    }

    // ---- INIT ----
    async function init() {
        await load();

        // Add product button
        document.getElementById('btnAddProduct').addEventListener('click', openAddModal);

        // Import button
        const importBtn = document.getElementById('btnImportProduct');
        if (importBtn) importBtn.addEventListener('click', importFromFile);

        // Delete all button
        const btnDeleteAll = document.getElementById('btnDeleteAllProducts');
        if (btnDeleteAll) {
            btnDeleteAll.addEventListener('click', async () => {
                if (products.length === 0) return;
                const ok = await AppModal.confirm('⚠️ PERINGATAN!\n\nApakah Anda yakin ingin menghapus SEMUA daftar produk?\n\nData yang dihapus tidak dapat dikembalikan.', 'Hapus Semua Produk', 'danger');
                if (ok) {
                    products = [];
                    save();
                    renderProductGrid();
                    showToast('Semua produk berhasil dihapus', 'success');
                    if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
                }
            });
        }

        document.getElementById('productDeleteBtn').addEventListener('click', deleteFromModal);

        // Save, Cancel, Close buttons for product modal
        const saveBtn = document.getElementById('productSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveModal);

        const cancelBtn = document.getElementById('productCancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        const closeBtn = document.getElementById('productModalClose');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // Add Variation button
        const addVarBtn = document.getElementById('btnAddVariation');
        if (addVarBtn) {
            addVarBtn.addEventListener('click', () => {
                const varList = document.getElementById('productVariationsList');
                if (varList) varList.appendChild(renderVariationRow());
            });
        }

        document.getElementById('productModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('productModalOverlay')) closeModal();
        });

        // (Rupiah formatting now handled dynamically in renderVariationRow)

        // Search
        document.getElementById('productSearch').addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderProductGrid();
        });

        // Filter by jenis
        document.getElementById('productFilterJenis').addEventListener('change', (e) => {
            filterJenis = e.target.value;
            renderProductGrid();
        });

        // Sortable headers
        document.querySelectorAll('.product-sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.sort;
                if (sortField === field) {
                    sortAsc = !sortAsc;
                } else {
                    sortField = field;
                    sortAsc = true;
                }
                renderProductGrid();
            });
        });

        // (Enter key handling would go here, maybe on the last valid input element that exists)

        renderProductGrid();
    }

    // ---- RENDER SHOP SELECTOR ----
    function renderShopSelector() {
        const container = document.getElementById('shopProductsList');
        if (!container) return;
        const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
        let html = '';
        shops.forEach(s => {
            const prodCount = products.filter(p => p.shopId === s.id).length;
            html += `
                <div class="shop-card" style="position:relative; background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); cursor:pointer; transition:all 0.2s; text-align:center;"
                     onclick="ProductList.openShopProducts('${s.id}')">
                    <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:center;">
                        ${typeof ShopManager !== 'undefined' && typeof ShopManager.getPlatformLogo === 'function' ? 
                            ShopManager.getPlatformLogo(s.platform || 'shopee', 56) : 
                            `<div style="width:56px; height:56px; border-radius:16px; background:rgba(0,0,0,0.04); display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.06); font-size:32px;">${s.initials}</div>`
                        }
                    </div>
                    <div style="font-weight:700; font-size:16px; color:var(--text);">${escapeHtml(s.name)}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:8px; display:inline-block; padding:4px 12px; background:rgba(0,0,0,0.04); border-radius:12px;">${prodCount} Produk</div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        container.querySelectorAll('.shop-card').forEach(el => {
            el.addEventListener('mouseover', () => { el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; el.style.borderColor = 'var(--accent)'; });
            el.addEventListener('mouseout', () => { el.style.transform = 'none'; el.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; el.style.borderColor = 'var(--border-color)'; });
        });
    }

    function openShopProducts(shopId) {
        currentShopId = shopId;
        const shop = typeof ShopManager !== 'undefined' ? ShopManager.getShops().find(s => s.id === shopId) : null;
        
        // Hide all pages, show products page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('pageProducts').classList.add('active');
        
        const shopName = shop ? shop.name : shopId;
        document.getElementById('pageTitle').innerHTML = `
            <div style="display:flex; align-items:center;">
                <button onclick="App.navigate('shop-products')" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; margin-right:12px; font-size:20px; padding:0 8px; border-radius:8px;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'">←</button>
                Produk: ${escapeHtml(shopName)}
            </div>
        `;
        
        renderProductGrid();
    }

    return { 
        init, 
        load,
        getProducts, 
        renderProductGrid, 
        openEditModal, 
        importFromFile, 
        toggleVariations, 
        inlineSaveVar,
        renderShopSelector,
        openShopProducts
    };
})();

