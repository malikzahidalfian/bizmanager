// ========================================
// ROAS CALCULATOR MODULE
// ========================================

const RoasCalculator = (() => {
    const STORAGE_KEY = 'bizmanager_roas';
    let entries = [];
    let editingId = null;
    let viewMode = 'product'; // 'product' or 'period'
    let filterDateFrom = '';
    let filterDateTo = '';
    let currentShopId = null;

    // ---- SHOP SELECTION ----
    function renderShopSelection() {
        const selView = document.getElementById('roasShopSelectionView');
        const histView = document.getElementById('roasHistoryView');
        if (selView) selView.classList.remove('hidden');
        if (histView) histView.classList.add('hidden');

        const listContainer = document.getElementById('roasShopList');
        if (!listContainer) return;

        const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];

        if (shops.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:20px;text-align:center;">Belum ada toko terdaftar. Silakan tambah toko di menu Pengaturan Toko.</div>';
            return;
        }

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:16px;">';
        shops.forEach(s => {
            const logo = typeof ShopManager !== 'undefined' ? ShopManager.getPlatformLogo(s.platform, 48) : `<div style="width:48px;height:48px;border-radius:12px;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;">${s.initials}</div>`;
            // encodeURIComponent does NOT escape single quotes by default, so we must replace them manually
            const encodedName = encodeURIComponent(s.name).replace(/'/g, '%27');
            html += `
                <div class="card" style="cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; padding:16px; border:1px solid var(--border-color);"
                     onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)'"
                     onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='none'"
                     onclick="RoasCalculator.selectShop('${s.id}', '${encodedName}')">
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${logo}
                        <div>
                            <div style="font-weight:700;color:var(--text);font-size:16px;">${escapeHtml(s.name)}</div>
                            <div style="font-size:12px;color:var(--text-muted);text-transform:capitalize;">${s.platform}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listContainer.innerHTML = html;
    }

    function selectShop(id, encodedName) {
        currentShopId = id;
        const name = encodedName ? decodeURIComponent(encodedName) : 'Toko Tidak Dikenal';
        const selView = document.getElementById('roasShopSelectionView');
        const histView = document.getElementById('roasHistoryView');
        const titleEl = document.getElementById('roasHistoryTitle');

        if (selView) selView.classList.add('hidden');
        if (histView) histView.classList.remove('hidden');
        if (titleEl) titleEl.innerHTML = `Performa Iklan <span style="font-size:14px; color:var(--text-muted); font-weight:normal;">— ${escapeHtml(name)}</span>`;

        renderDashboard();
    }

    function backToShopSelection() {
        currentShopId = null;
        renderShopSelection();
    }

    // ---- STORAGE ----
    async function load() {
        try {
            const data = await StorageManager.getItem(STORAGE_KEY);
            entries = data ? JSON.parse(data) : [];
        } catch { entries = []; }
    }

    async function save() {
        await StorageManager.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    // ---- CRUD ----
    function addEntry(e) {
        e.id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        e.createdAt = new Date().toISOString();
        if(!e.shopId && currentShopId) e.shopId = currentShopId;
        entries.unshift(e);
        save();
        return e;
    }

    function updateEntry(id, data) {
        const idx = entries.findIndex(e => e.id === id);
        if (idx !== -1) {
            entries[idx] = { ...entries[idx], ...data };
            save();
        }
    }

    function deleteEntry(id) {
        entries = entries.filter(e => e.id !== id);
        save();
    }

    // ---- CALCULATIONS ----
    function calcROAS(revenue, adSpend) {
        if (!adSpend || adSpend === 0) return 0;
        return revenue / adSpend;
    }

    function calcNetROAS(revenue, modal, biayaAdmin, biayaLayanan, biayaLain, adSpend) {
        if (!adSpend || adSpend === 0) return 0;
        const netProfit = revenue - modal - Math.abs(biayaAdmin) - Math.abs(biayaLayanan) - Math.abs(biayaLain);
        return netProfit / adSpend;
    }

    function calcMetrics(entry) {
        const roas = calcROAS(entry.revenue, entry.adSpend);
        const totalBiaya = Math.abs(entry.biayaAdmin || 0) + Math.abs(entry.biayaLayanan || 0) + Math.abs(entry.biayaLain || 0);
        const netProfit = entry.revenue - (entry.modal || 0) - totalBiaya;
        const netRoas = calcNetROAS(entry.revenue, entry.modal || 0, entry.biayaAdmin || 0, entry.biayaLayanan || 0, entry.biayaLain || 0, entry.adSpend);
        const acos = entry.revenue > 0 ? (entry.adSpend / entry.revenue * 100) : 0; // Ad Cost of Sales

        return { roas, netRoas, netProfit, totalBiaya, acos };
    }

    // ---- FILTERING ----
    function getFilteredEntries() {
        let filtered = entries.filter(e => e.shopId === currentShopId);

        if (filterDateFrom) {
            filtered = filtered.filter(e => e.tanggal >= filterDateFrom);
        }
        if (filterDateTo) {
            filtered = filtered.filter(e => e.tanggal <= filterDateTo);
        }

        return filtered;
    }

    // ---- FORMAT ----
    function formatRp(num) {
        return ProfitCalculator.formatRupiah(num);
    }

    function formatROAS(val) {
        if (val === 0 || isNaN(val)) return '0.00x';
        return val.toFixed(2) + 'x';
    }

    function roasColor(val) {
        if (val >= 3) return 'roas-excellent';
        if (val >= 2) return 'roas-good';
        if (val >= 1) return 'roas-ok';
        return 'roas-bad';
    }

    // escapeHtml — using global from index.html

    // ---- RENDER ----
    function renderDashboard() {
        const filtered = getFilteredEntries();
        const container = document.getElementById('roasContent');

        // Aggregate summary
        const totals = filtered.reduce((acc, e) => {
            acc.revenue += e.revenue || 0;
            acc.adSpend += e.adSpend || 0;
            acc.modal += e.modal || 0;
            acc.biayaAdmin += Math.abs(e.biayaAdmin || 0);
            acc.biayaLayanan += Math.abs(e.biayaLayanan || 0);
            acc.biayaLain += Math.abs(e.biayaLain || 0);
            acc.impressions += e.impressions || 0;
            acc.clicks += e.clicks || 0;
            acc.orders += e.orders || 0;
            return acc;
        }, { revenue: 0, adSpend: 0, modal: 0, biayaAdmin: 0, biayaLayanan: 0, biayaLain: 0, impressions: 0, clicks: 0, orders: 0 });

        const totalBiaya = totals.biayaAdmin + totals.biayaLayanan + totals.biayaLain;
        const netProfit = totals.revenue - totals.modal - totalBiaya;
        const overallROAS = calcROAS(totals.revenue, totals.adSpend);
        const overallNetROAS = totals.adSpend > 0 ? (netProfit / totals.adSpend) : 0;
        const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
        const convRate = totals.clicks > 0 ? (totals.orders / totals.clicks * 100) : 0;

        let html = '';

        // Summary cards
        html += `
            <div class="roas-summary-grid">
                <div class="roas-summary-card">
                    <span class="roas-summary-label">Total Ad Spend</span>
                    <span class="roas-summary-value">${formatRp(totals.adSpend)}</span>
                </div>
                <div class="roas-summary-card">
                    <span class="roas-summary-label">Revenue dari Iklan</span>
                    <span class="roas-summary-value">${formatRp(totals.revenue)}</span>
                </div>
                <div class="roas-summary-card roas-highlight">
                    <span class="roas-summary-label">ROAS Standard</span>
                    <span class="roas-summary-value roas-big ${roasColor(overallROAS)}">${formatROAS(overallROAS)}</span>
                    <span class="roas-desc">Revenue ÷ Ad Spend</span>
                </div>
                <div class="roas-summary-card roas-highlight-net">
                    <span class="roas-summary-label">Net ROAS</span>
                    <span class="roas-summary-value roas-big ${roasColor(overallNetROAS)}">${formatROAS(overallNetROAS)}</span>
                    <span class="roas-desc">Profit Bersih ÷ Ad Spend</span>
                </div>
            </div>

            <div class="roas-metrics-row">
                <div class="roas-metric-pill">
                    <span>Net Profit</span>
                    <span class="${netProfit >= 0 ? 'positive' : 'negative'}">${formatRp(netProfit)}</span>
                </div>
                <div class="roas-metric-pill">
                    <span>Total Modal</span>
                    <span>${formatRp(totals.modal)}</span>
                </div>
                <div class="roas-metric-pill">
                    <span>Total Biaya</span>
                    <span class="negative">${formatRp(-totalBiaya)}</span>
                </div>
                <div class="roas-metric-pill">
                    <span>ACoS</span>
                    <span>${(totals.revenue > 0 ? (totals.adSpend / totals.revenue * 100) : 0).toFixed(1)}%</span>
                </div>
            </div>
            
            <div class="roas-metrics-row" style="margin-top:12px;">
                <div class="roas-metric-pill">
                    <span>Dilihat</span>
                    <span>${totals.impressions.toLocaleString('id-ID')}</span>
                </div>
                <div class="roas-metric-pill">
                    <span>Diklik</span>
                    <span>${totals.clicks.toLocaleString('id-ID')}</span>
                </div>
                <div class="roas-metric-pill">
                    <span>Konversi</span>
                    <span>${totals.orders.toLocaleString('id-ID')}</span>
                </div>
                <div class="roas-metric-pill">
                    <span>CTR</span>
                    <span>${ctr.toFixed(2)}%</span>
                </div>
                <div class="roas-metric-pill">
                    <span>Biaya/Konv</span>
                    <span>${formatRp(totals.orders > 0 ? totals.adSpend / totals.orders : 0)}</span>
                </div>
            </div>
        `;

        // View toggle
        html += `
            <div class="roas-view-toggle">
                <button class="roas-view-btn ${viewMode === 'product' ? 'active' : ''}" data-view="product">📦 Per Produk</button>
                <button class="roas-view-btn ${viewMode === 'period' ? 'active' : ''}" data-view="period">📅 Per Periode</button>
            </div>
        `;

        if (viewMode === 'product') {
            html += renderProductView(filtered);
        } else {
            html += renderPeriodView(filtered);
        }

        container.innerHTML = html;

        // Bind view toggles
        container.querySelectorAll('.roas-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                viewMode = btn.dataset.view;
                renderDashboard();
            });
        });
    }

    function renderProductView(data) {
        // Group by product
        const grouped = {};
        data.forEach(e => {
            const key = e.product || 'Tanpa Nama';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(e);
        });

        if (Object.keys(grouped).length === 0) {
            return '<div class="roas-empty">Belum ada data iklan. Klik "+ Tambah Data Iklan" atau import dari Shopee Ads.</div>';
        }

        let html = '<div class="roas-product-list">';
        const allProducts = typeof ProductList !== 'undefined' ? ProductList.getProducts() : [];

        Object.entries(grouped).forEach(([product, items]) => {
            const rev = items.reduce((s, e) => s + (e.revenue || 0), 0);
            const spend = items.reduce((s, e) => s + (e.adSpend || 0), 0);
            const modal = items.reduce((s, e) => s + (e.modal || 0), 0);
            const biaya = items.reduce((s, e) => s + Math.abs(e.biayaAdmin || 0) + Math.abs(e.biayaLayanan || 0) + Math.abs(e.biayaLain || 0), 0);
            const impressions = items.reduce((s, e) => s + (e.impressions || 0), 0);
            const clicks = items.reduce((s, e) => s + (e.clicks || 0), 0);
            const orders = items.reduce((s, e) => s + (e.orders || 0), 0);
            
            const net = rev - modal - biaya;
            const roas = calcROAS(rev, spend);
            const netRoas = spend > 0 ? net / spend : 0;
            const ctr = impressions > 0 ? (clicks / impressions * 100) : 0;
            const cpa = orders > 0 ? (spend / orders) : 0;
            
            const searchName = String(product).toLowerCase().trim();
            // 1. Precise match
            let matchedObj = allProducts.find(p => String(p.name).toLowerCase().trim() === searchName || (p.variations && p.variations.some(v => String(v.name).toLowerCase().trim() === searchName)));
            
            // 2. Partial match fallback (helpful if Shopee Ads name is longer/shorter than internal catalog)
            if (!matchedObj) {
                matchedObj = allProducts.find(p => {
                    const pn = String(p.name).toLowerCase().trim();
                    return pn && searchName.includes(pn);
                });
            }
            
            // Use base64 to guarantee complete cross-browser rendering without parsing errors
            const svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="#e2e8f0"><rect width="100" height="100" fill="#f8fafc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12px" font-weight="bold" fill="#94a3b8">Ads</text></svg>';
            const encodedSvg = typeof btoa !== "undefined" ? btoa(svgStr) : "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgZmlsbD0iI2UyZThmMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmOGZhZmMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTJweCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiM5NGEzYjgiPkFkczwvdGV4dD48L3N2Zz4=";
            const imgUrl = matchedObj && matchedObj.image ? matchedObj.image : 'data:image/svg+xml;base64,' + encodedSvg;

            html += `
                <div class="roas-product-card">
                    <div class="roas-product-header" style="display:flex; align-items:flex-start; gap:12px;">
                        <img src="${imgUrl}" alt="Ads Product" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0;">
                        <div style="flex:1;">
                            <h4 style="margin:0;">${escapeHtml(product)}</h4>
                            <span class="roas-entry-count" style="display:inline-block; margin-top:2px;">${items.length} entry</span>
                        </div>
                    </div>
                    <div class="roas-product-metrics">
                        <div class="roas-pm">
                            <span>Ad Spend</span>
                            <span>${formatRp(spend)}</span>
                        </div>
                        <div class="roas-pm">
                            <span>Revenue</span>
                            <span>${formatRp(rev)}</span>
                        </div>
                        <div class="roas-pm">
                            <span>ROAS</span>
                            <span class="${roasColor(roas)}">${formatROAS(roas)}</span>
                        </div>
                        <div class="roas-pm">
                            <span>Net ROAS</span>
                            <span class="${roasColor(netRoas)}">${formatROAS(netRoas)}</span>
                        </div>
                        <div class="roas-pm">
                            <span>Dilihat / Klik</span>
                            <span>${impressions.toLocaleString('id-ID')} / ${clicks.toLocaleString('id-ID')}</span>
                        </div>
                        <div class="roas-pm">
                            <span>Konversi</span>
                            <span>${orders.toLocaleString('id-ID')} (CTR: ${ctr.toFixed(1)}%)</span>
                        </div>
                        <div class="roas-pm" style="width:100%;">
                            <span>Biaya/Konversi</span>
                            <span>${formatRp(cpa)}</span>
                        </div>
                    </div>
                    <div class="roas-product-entries">
                        ${items.map(e => {
                            const m = calcMetrics(e);
                            return `
                                <div class="roas-entry-row">
                                    <span class="roas-entry-date">${e.tanggal || '-'}</span>
                                    <span>Spend ${formatRp(e.adSpend)}</span>
                                    <span>Rev ${formatRp(e.revenue)}</span>
                                    <span class="${roasColor(m.roas)}">${formatROAS(m.roas)}</span>
                                    <button class="roas-entry-edit" onclick="RoasCalculator.openEditModal('${e.id}')">✏️</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    function renderPeriodView(data) {
        // Group by month
        const grouped = {};
        data.forEach(e => {
            const key = e.tanggal ? e.tanggal.substring(0, 7) : 'Unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(e);
        });

        const sortedKeys = Object.keys(grouped).sort().reverse();

        if (sortedKeys.length === 0) {
            return '<div class="roas-empty">Belum ada data iklan.</div>';
        }

        let html = '<div class="roas-period-list">';

        sortedKeys.forEach(period => {
            const items = grouped[period];
            const rev = items.reduce((s, e) => s + (e.revenue || 0), 0);
            const spend = items.reduce((s, e) => s + (e.adSpend || 0), 0);
            const modal = items.reduce((s, e) => s + (e.modal || 0), 0);
            const biaya = items.reduce((s, e) => s + Math.abs(e.biayaAdmin || 0) + Math.abs(e.biayaLayanan || 0) + Math.abs(e.biayaLain || 0), 0);
            const impressions = items.reduce((s, e) => s + (e.impressions || 0), 0);
            const clicks = items.reduce((s, e) => s + (e.clicks || 0), 0);
            const orders = items.reduce((s, e) => s + (e.orders || 0), 0);
            
            const net = rev - modal - biaya;
            const roas = calcROAS(rev, spend);
            const netRoas = spend > 0 ? net / spend : 0;
            const ctr = impressions > 0 ? (clicks / impressions * 100) : 0;
            const cpa = orders > 0 ? (spend / orders) : 0;

            // Format period label
            const [year, month] = period.split('-');
            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const label = month ? `${monthNames[parseInt(month)]} ${year}` : period;

            html += `
                <div class="roas-period-card">
                    <div class="roas-period-header">
                        <h4>📅 ${label}</h4>
                        <div class="roas-period-roas">
                            <span class="roas-mini-label">ROAS</span>
                            <span class="${roasColor(roas)}">${formatROAS(roas)}</span>
                            <span class="roas-mini-label" style="margin-left:12px">Net</span>
                            <span class="${roasColor(netRoas)}">${formatROAS(netRoas)}</span>
                        </div>
                    </div>
                    <div class="roas-period-stats">
                        <div><span>Ad Spend</span><span>${formatRp(spend)}</span></div>
                        <div><span>Revenue</span><span>${formatRp(rev)}</span></div>
                        <div><span>Modal</span><span>${formatRp(modal)}</span></div>
                        <div><span>Net Profit</span><span class="${net >= 0 ? 'positive' : 'negative'}">${formatRp(net)}</span></div>
                    </div>
                    <div class="roas-period-stats" style="margin-top:8px; border-top:1px dashed var(--border-color); padding-top:8px;">
                        <div><span>Dilihat</span><span>${impressions.toLocaleString('id-ID')}</span></div>
                        <div><span>Diklik</span><span>${clicks.toLocaleString('id-ID')}</span></div>
                        <div><span>Konversi</span><span>${orders.toLocaleString('id-ID')}</span></div>
                        <div><span>CTR</span><span>${ctr.toFixed(2)}%</span></div>
                        <div><span>Biaya/Konv</span><span>${formatRp(cpa)}</span></div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // ---- MODAL ----
    function openAddModal() {
        editingId = null;
        document.getElementById('roasModalTitle').textContent = 'Tambah Data Iklan';
        document.getElementById('roasProduct').value = '';
        document.getElementById('roasTanggal').value = new Date().toISOString().split('T')[0];
        document.getElementById('roasCampaign').value = '';
        document.getElementById('roasAdSpend').value = '';
        document.getElementById('roasRevenue').value = '';
        document.getElementById('roasModal').value = '';
        document.getElementById('roasBiayaAdmin').value = '';
        document.getElementById('roasBiayaLayanan').value = '';
        document.getElementById('roasBiayaLain').value = '';
        document.getElementById('roasImpressions').value = '';
        document.getElementById('roasClicks').value = '';
        document.getElementById('roasOrders').value = '';
        document.getElementById('roasDeleteBtn').classList.add('hidden');
        document.getElementById('roasModalOverlay').classList.remove('hidden');
    }

    function openEditModal(id) {
        const e = entries.find(x => x.id === id);
        if (!e) return;

        editingId = id;
        document.getElementById('roasModalTitle').textContent = 'Edit Data Iklan';
        document.getElementById('roasProduct').value = e.product || '';
        document.getElementById('roasTanggal').value = e.tanggal || '';
        document.getElementById('roasCampaign').value = e.campaign || '';
        document.getElementById('roasAdSpend').value = e.adSpend ? e.adSpend.toLocaleString('id-ID') : '';
        document.getElementById('roasRevenue').value = e.revenue ? e.revenue.toLocaleString('id-ID') : '';
        document.getElementById('roasModal').value = e.modal ? e.modal.toLocaleString('id-ID') : '';
        document.getElementById('roasBiayaAdmin').value = e.biayaAdmin ? Math.abs(e.biayaAdmin).toLocaleString('id-ID') : '';
        document.getElementById('roasBiayaLayanan').value = e.biayaLayanan ? Math.abs(e.biayaLayanan).toLocaleString('id-ID') : '';
        document.getElementById('roasBiayaLain').value = e.biayaLain ? Math.abs(e.biayaLain).toLocaleString('id-ID') : '';
        document.getElementById('roasImpressions').value = e.impressions || '';
        document.getElementById('roasClicks').value = e.clicks || '';
        document.getElementById('roasOrders').value = e.orders || '';
        document.getElementById('roasDeleteBtn').classList.remove('hidden');
        document.getElementById('roasModalOverlay').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('roasModalOverlay').classList.add('hidden');
        editingId = null;
    }

    function saveModal() {
        const product = document.getElementById('roasProduct').value.trim();
        if (!product) { showToast('Nama produk harus diisi', 'warning'); return; }

        const parseRp = ProfitCalculator.parseRupiah;

        const data = {
            product,
            tanggal: document.getElementById('roasTanggal').value,
            campaign: document.getElementById('roasCampaign').value.trim(),
            adSpend: parseRp(document.getElementById('roasAdSpend').value),
            revenue: parseRp(document.getElementById('roasRevenue').value),
            modal: parseRp(document.getElementById('roasModal').value),
            biayaAdmin: parseRp(document.getElementById('roasBiayaAdmin').value),
            biayaLayanan: parseRp(document.getElementById('roasBiayaLayanan').value),
            biayaLain: parseRp(document.getElementById('roasBiayaLain').value),
            impressions: parseInt(document.getElementById('roasImpressions').value) || 0,
            clicks: parseInt(document.getElementById('roasClicks').value) || 0,
            orders: parseInt(document.getElementById('roasOrders').value) || 0
        };

        if (editingId) {
            updateEntry(editingId, data);
            showToast('Data iklan diupdate!', 'success');
        } else {
            addEntry(data);
            showToast('Data iklan ditambahkan!', 'success');
        }

        closeModal();
        renderDashboard();
    }

    async function deleteFromModal() {
        if (!editingId) return;
        const ok = await AppModal.confirm('Hapus data iklan ini?', 'Hapus Data Iklan', 'danger');
        if (!ok) return;
        deleteEntry(editingId);
        closeModal();
        renderDashboard();
        showToast('Data dihapus', 'success');
    }

    // ---- SHOPEE INCOME REPORT IMPORT ----
    function importFromFile() {
        const input = document.getElementById('roasAdsFileInput');
        if (!input) {
            showToast('Sistem gagal memuat input file', 'error');
            return;
        }
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) importShopeeIncome(file);
            input.value = ''; // Reset value to allow selecting same file again
        };
        input.click();
    }

    function importShopeeIncome(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Try to find "Income" sheet or similar, fallback to first sheet
                let sheetName = workbook.SheetNames.find(n => {
                    const low = n.toLowerCase();
                    return low.includes('income') || low.includes('order processing') || low.includes('biaya proses');
                });
                if (!sheetName) sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

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

                const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (allRows.length < 5) {
                    showToast('File kosong / terlalu pendek', 'warning');
                    return;
                }

                // Find header row: look for "No. Pesanan" or "Harga Asli Produk"
                let headerIdx = -1;
                for (let r = 0; r < Math.min(15, allRows.length); r++) {
                    const rowStr = (allRows[r] || []).map(c => String(c).toLowerCase()).join('|');
                    if (rowStr.includes('no. pesanan') || rowStr.includes('harga asli produk')) {
                        headerIdx = r;
                        break;
                    }
                }

                // If not Shopee Income format, try Shopee Ads format
                if (headerIdx === -1) {
                    importShopeeAds(file);
                    return;
                }

                const headers = allRows[headerIdx].map(h => String(h || '').toLowerCase().trim());

                // Column mapping for Shopee Laporan Penghasilan
                const findCol = (...names) => {
                    for (const name of names) {
                        const idx = headers.findIndex(h => h.includes(name));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const col = {
                    orderNo:     findCol('no. pesanan'),
                    date:        findCol('waktu pesanan', 'tanggal dana'),
                    relDate:     findCol('tanggal dana dilepas'),
                    price:       findCol('harga asli produk'),
                    discount:    findCol('total diskon produk'),
                    ams:         findCol('biaya komisi ams'),
                    admin:       findCol('biaya administrasi'),
                    service:     findCol('biaya layanan'),
                    processing:  findCol('biaya proses pesanan'),
                    shipping:    findCol('biaya program hemat'),
                    transaction: findCol('biaya transaksi'),
                    campaign:    findCol('biaya kampanye'),
                    total:       findCol('total penghasilan'),
                    voucher:     findCol('voucher dispons'),
                    buyer:       findCol('username (pembeli)'),
                    payment:     findCol('metode pembayaran'),
                    courier:     findCol('jasa kirim'),
                };

                // Parse orders
                const orders = [];
                for (let r = headerIdx + 1; r < allRows.length; r++) {
                    const row = allRows[r];
                    if (!row || row.length < 3) continue;

                    const orderNo = col.orderNo !== -1 ? String(row[col.orderNo] || '').trim() : '';
                    if (!orderNo || !/^[A-Z0-9]+$/i.test(orderNo)) continue; // skip non-order rows

                    const revenue = parseNum(col.price !== -1 ? row[col.price] : 0);
                    const amsCost = Math.abs(parseNum(col.ams !== -1 ? row[col.ams] : 0));
                    const adminFee = Math.abs(parseNum(col.admin !== -1 ? row[col.admin] : 0));
                    const serviceFee = Math.abs(parseNum(col.service !== -1 ? row[col.service] : 0));
                    const processingFee = Math.abs(parseNum(col.processing !== -1 ? row[col.processing] : 0));
                    const shippingFee = Math.abs(parseNum(col.shipping !== -1 ? row[col.shipping] : 0));
                    const transactionFee = Math.abs(parseNum(col.transaction !== -1 ? row[col.transaction] : 0));
                    const campaignFee = Math.abs(parseNum(col.campaign !== -1 ? row[col.campaign] : 0));
                    const totalEarnings = parseNum(col.total !== -1 ? row[col.total] : 0);
                    const discount = Math.abs(parseNum(col.discount !== -1 ? row[col.discount] : 0));

                    const dateRaw = col.date !== -1 ? row[col.date] : (col.relDate !== -1 ? row[col.relDate] : '');
                    const tanggal = formatDate(dateRaw);

                    orders.push({
                        orderNo,
                        tanggal,
                        revenue,
                        discount,
                        amsCost,     // This is the ad spend
                        adminFee,
                        serviceFee,
                        processingFee,
                        shippingFee,
                        transactionFee,
                        campaignFee,
                        totalEarnings,
                    });
                }

                if (orders.length === 0) {
                    showToast('Tidak ada data pesanan yang ditemukan', 'warning');
                    return;
                }

                showIncomePreview(orders, file.name);

            } catch (err) {
                showToast('Error membaca file: ' + err.message, 'error');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function showIncomePreview(orders, fileName) {
        // Calculate totals
        const totals = orders.reduce((acc, o) => {
            acc.revenue += o.revenue;
            acc.amsCost += o.amsCost;
            acc.adminFee += o.adminFee;
            acc.serviceFee += o.serviceFee;
            acc.processingFee += o.processingFee;
            acc.totalEarnings += o.totalEarnings;
            return acc;
        }, { revenue: 0, amsCost: 0, adminFee: 0, serviceFee: 0, processingFee: 0, totalEarnings: 0 });

        const netProfit = totals.totalEarnings;
        const totalFees = totals.adminFee + totals.serviceFee + totals.processingFee;
        const overallROAS = totals.amsCost > 0 ? (totals.revenue / totals.amsCost) : 0;

        let html = `
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                📁 <strong>${escapeHtml(fileName)}</strong> — ${orders.length} pesanan ditemukan
            </p>
            <div class="roas-summary-grid" style="margin-bottom:16px;">
                <div class="roas-summary-card">
                    <span class="roas-summary-label">Total Revenue</span>
                    <span class="roas-summary-value">${formatRp(totals.revenue)}</span>
                </div>
                <div class="roas-summary-card">
                    <span class="roas-summary-label">Biaya Iklan (AMS)</span>
                    <span class="roas-summary-value">${formatRp(totals.amsCost)}</span>
                </div>
                <div class="roas-summary-card">
                    <span class="roas-summary-label">Total Biaya</span>
                    <span class="roas-summary-value">${formatRp(totalFees)}</span>
                </div>
                <div class="roas-summary-card roas-highlight">
                    <span class="roas-summary-label">ROAS</span>
                    <span class="roas-summary-value roas-big ${roasColor(overallROAS)}">${formatROAS(overallROAS)}</span>
                </div>
            </div>
            <div style="max-height:300px;overflow-y:auto;">
                <table class="scrape-table">
                    <thead><tr>
                        <th>#</th><th>No. Pesanan</th><th>Tanggal</th><th>Revenue</th><th>Iklan (AMS)</th><th>Admin</th><th>Total</th>
                    </tr></thead><tbody>`;

        orders.slice(0, 30).forEach((o, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td style="font-size:11px;">${escapeHtml(o.orderNo)}</td>
                <td>${o.tanggal}</td>
                <td class="scrape-price">${formatRp(o.revenue)}</td>
                <td>${o.amsCost > 0 ? formatRp(o.amsCost) : '-'}</td>
                <td>${formatRp(o.adminFee)}</td>
                <td>${formatRp(o.totalEarnings)}</td>
            </tr>`;
        });

        if (orders.length > 30) html += `<tr><td colspan="7" style="text-align:center;">... dan ${orders.length - 30} pesanan lainnya</td></tr>`;
        html += '</tbody></table></div>';

        html += `
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color);">
                <p style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Pilih cara import:</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-add-task" id="btnImportGrouped">📅 Per Bulan (Direkomendasikan)</button>
                    <button class="btn-filter" id="btnImportPerOrder">📦 Per Pesanan (${orders.length} entry)</button>
                    <button class="btn-modal-cancel" id="btnCancelIncomeImport">Batal</button>
                </div>
                <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">
                    ⚠️ Harga modal belum termasuk — bisa diupdate manual nanti per produk.
                </p>
            </div>`;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal" style="max-width:750px;">
            <div class="modal-header"><h3>📊 Import Laporan Penghasilan Shopee</h3><button class="modal-close" id="incomePreviewClose">✕</button></div>
            <div class="modal-body">${html}</div></div>`;
        document.body.appendChild(overlay);

        const closeOverlay = () => overlay.remove();
        overlay.querySelector('#incomePreviewClose').addEventListener('click', closeOverlay);
        overlay.querySelector('#btnCancelIncomeImport').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

        // Import grouped by month
        overlay.querySelector('#btnImportGrouped').addEventListener('click', () => {
            const monthly = {};
            orders.forEach(o => {
                const month = o.tanggal.substring(0, 7);
                if (!monthly[month]) monthly[month] = { revenue: 0, amsCost: 0, adminFee: 0, serviceFee: 0, processingFee: 0, orders: 0 };
                monthly[month].revenue += o.revenue;
                monthly[month].amsCost += o.amsCost;
                monthly[month].adminFee += o.adminFee;
                monthly[month].serviceFee += o.serviceFee;
                monthly[month].processingFee += o.processingFee;
                monthly[month].orders++;
            });

            let count = 0;
            Object.entries(monthly).forEach(([month, data]) => {
                addEntry({
                    product: 'Shopee Income',
                    tanggal: month + '-01',
                    campaign: `Import ${month}`,
                    adSpend: data.amsCost,
                    revenue: data.revenue,
                    modal: 0,
                    biayaAdmin: data.adminFee,
                    biayaLayanan: data.serviceFee,
                    biayaLain: data.processingFee,
                    impressions: 0,
                    clicks: 0,
                    orders: data.orders,
                    source: 'shopee-income-import'
                });
                count++;
            });

            closeOverlay();
            renderDashboard();
            showToast(`${count} entry bulanan berhasil diimport!`, 'success');
        });

        // Import per order
        overlay.querySelector('#btnImportPerOrder').addEventListener('click', () => {
            let count = 0;
            orders.forEach(o => {
                addEntry({
                    product: 'Shopee Order',
                    tanggal: o.tanggal,
                    campaign: o.orderNo,
                    adSpend: o.amsCost,
                    revenue: o.revenue,
                    modal: 0,
                    biayaAdmin: o.adminFee,
                    biayaLayanan: o.serviceFee,
                    biayaLain: o.processingFee,
                    impressions: 0,
                    clicks: 0,
                    orders: 1,
                    source: 'shopee-income-import'
                });
                count++;
            });

            closeOverlay();
            renderDashboard();
            showToast(`${count} pesanan berhasil diimport!`, 'success');
        });
    }

    // ---- SHOPEE ADS IMPORT ----
    function importShopeeAds(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

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

                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (rows.length < 2) {
                    showToast('File kosong atau format tidak dikenali', 'error');
                    return;
                }

                // Find header row AND extract metadata
                let headerIdx = -1;
                let metaProduct = 'Shopee Ads';
                let metaDate = new Date().toISOString().split('T')[0];

                const headerSearch = ['biaya', 'cost', 'pengeluaran', 'omzet penjualan', 'dilihat', 'jumlah klik'];
                for (let r = 0; r < Math.min(20, rows.length); r++) {
                    const rowStrs = rows[r].map(c => String(c).toLowerCase().trim());
                    const rowStrJoined = rowStrs.join('|');

                    if (headerSearch.some(h => rowStrs.includes(h))) {
                        headerIdx = r;
                        break;
                    }

                    // Extract metadata
                    const label = rowStrs[0] || '';
                    if (label.includes('nama iklan') || label.includes('nama produk')) {
                        metaProduct = String(rows[r][1] || '').trim();
                    } else if (label.includes('periode') || label.includes('waktu laporan')) {
                        const dl = String(rows[r][1] || '').trim();
                        if (dl) metaDate = formatDate(dl);
                    }
                }

                if (headerIdx === -1) headerIdx = 0;

                const headers = rows[headerIdx].map(h => String(h).toLowerCase().trim());

                // Use exact match first to prevent false positives like "biaya per konversi" matching "biaya"
                function findCol(exactMatches, partialMatches) {
                    for (const name of exactMatches) {
                        const idx = headers.findIndex(h => h === name);
                        if (idx !== -1) return idx;
                    }
                    if (partialMatches) {
                        for (const name of partialMatches) {
                            const idx = headers.findIndex(h => h.includes(name));
                            if (idx !== -1) return idx;
                        }
                    }
                    return -1;
                }

                const colCampaign = findCol(['nama kampanye', 'campaign'], ['kampanye']);
                const colProduct = findCol(['nama produk', 'nama iklan', 'informasi produk', 'product'], ['produk', 'iklan']);
                const colDate = findCol(['tanggal', 'periode', 'date'], ['waktu']);
                const colImpressions = findCol(['dilihat', 'tayangan', 'impressions'], []);
                const colClicks = findCol(['jumlah klik', 'klik', 'clicks'], []);
                const colOrders = findCol(['konversi', 'pesanan', 'produk terjual', 'orders'], []);
                const colGMV = findCol(['omzet penjualan', 'pendapatan', 'gmv', 'revenue', 'omzet'], []);
                const colExpense = findCol(['biaya', 'pengeluaran', 'expense', 'cost', 'spend'], []);

                let imported = 0;
                for (let r = headerIdx + 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;

                    const expense = parseNum(colExpense !== -1 ? row[colExpense] : 0);
                    if (expense === 0 && (colGMV === -1 || parseNum(row[colGMV]) === 0)) continue;

                    let productName = metaProduct;
                    if (colProduct !== -1 && row[colProduct]) {
                        productName = String(row[colProduct]).trim();
                    }

                    const entry = {
                        product: productName,
                        campaign: colCampaign !== -1 ? String(row[colCampaign] || '').trim() : '',
                        tanggal: (colDate !== -1 && row[colDate]) ? formatDate(row[colDate]) : metaDate,
                        adSpend: expense,
                        revenue: colGMV !== -1 ? parseNum(row[colGMV]) : 0,
                        modal: 0,
                        biayaAdmin: 0,
                        biayaLayanan: 0,
                        biayaLain: 0,
                        impressions: colImpressions !== -1 ? parseInt(parseNum(row[colImpressions])) || 0 : 0,
                        clicks: colClicks !== -1 ? parseInt(parseNum(row[colClicks])) || 0 : 0,
                        orders: colOrders !== -1 ? parseInt(parseNum(row[colOrders])) || 0 : 0,
                        source: 'shopee-ads-import'
                    };

                    addEntry(entry);
                    imported++;
                }

                renderDashboard();
                showToast(`${imported} data iklan berhasil diimport dari Shopee Ads!`, 'success');
            } catch (err) {
                showToast('Gagal membaca file: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function parseNum(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;
        return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
    }

    function formatDate(val) {
        if (!val) return new Date().toISOString().split('T')[0];
        const s = String(val).trim();
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        // DD/MM/YYYY
        const parts = s.split(/[\/\-\.]/);
        if (parts.length === 3 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return new Date().toISOString().split('T')[0];
    }

    // ---- INIT ----
    async function init() {
        await load();

        // Data Migration: Assign existing legacy ads to the first available shop
        const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
        if (shops.length > 0 && entries.some(e => !e.shopId)) {
            const defaultShopId = shops[0].id;
            let migrated = false;
            entries.forEach(e => {
                if (!e.shopId) {
                    e.shopId = defaultShopId;
                    migrated = true;
                }
            });
            if (migrated) {
                save();
            }
        }

        const addBtn = document.getElementById('btnAddRoas');
        if (addBtn) addBtn.addEventListener('click', openAddModal);

        // Modal controls
        const overlay = document.getElementById('roasModalOverlay');
        if (overlay) {
            document.getElementById('roasModalClose').addEventListener('click', closeModal);
            document.getElementById('roasCancelBtn').addEventListener('click', closeModal);
            document.getElementById('roasSaveBtn').addEventListener('click', saveModal);
            document.getElementById('roasDeleteBtn').addEventListener('click', deleteFromModal);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        }

        // Rupiah formatting for currency fields
        ['roasAdSpend', 'roasRevenue', 'roasModal', 'roasBiayaAdmin', 'roasBiayaLayanan', 'roasBiayaLain'].forEach(id => {
            const el = document.getElementById(id);
            if (el) ProfitCalculator.setupRupiahInput(el);
        });

        // Import button — auto-detect Shopee Income vs Ads format
        const importBtn = document.getElementById('btnImportAds');
        if (importBtn) {
            importBtn.addEventListener('click', importFromFile);
        }

        // Date filters
        const fromInput = document.getElementById('roasFilterFrom');
        const toInput = document.getElementById('roasFilterTo');
        if (fromInput) fromInput.addEventListener('change', (e) => { filterDateFrom = e.target.value; renderDashboard(); });
        if (toInput) toInput.addEventListener('change', (e) => { filterDateTo = e.target.value; renderDashboard(); });

        renderShopSelection();
    }
    async function deleteAllAds() {
        const filteredLength = getFilteredEntries().length;
        if (filteredLength === 0) {
            showToast('Tidak ada data untuk dihapus di toko ini', 'info');
            return;
        }
        const ok = await AppModal.confirm(`Yakin ingin menghapus semua ${filteredLength} data iklan di toko ini?\nData yang dihapus tidak bisa dikembalikan.`, 'Hapus Semua Iklan', 'danger');
        if (ok) {
            entries = entries.filter(e => e.shopId !== currentShopId);
            save();
            renderDashboard();
            showToast('Semua data iklan berhasil dihapus', 'success');
        }
    }

    return { init, renderDashboard, renderShopSelection, selectShop, backToShopSelection, openEditModal, openAddModal, importFromFile, deleteAllAds };
})();
