// ========================================
// INCOME MANAGER — Import & Display Shopee Income Data
// ========================================

const IncomeManager = (() => {
    const STORAGE_KEY = 'bizmanager_incomes';
    let savedIncomes = [];
    let importedIncomes = [];
    let currentShop = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;',
                '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
            })[s];
        });
    }

    function formatRp(num) {
        if (!num || isNaN(num)) return 'Rp 0';
        return 'Rp ' + Math.round(num).toLocaleString('id-ID');
    }

    function parseNum(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        return parseFloat(String(str).replace(/[^0-9.-]/g, '')) || 0;
    }

    function formatDate(val) {
        if (!val) return '-';
        if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            return `${d}/${m}/${y} ${h}:${min}`;
        }
        return String(val).trim();
    }

    async function init() {
        if(typeof StorageManager !== 'undefined') {
            try {
                const data = await StorageManager.getItem(STORAGE_KEY);
                if (data) {
                    savedIncomes = JSON.parse(data);
                }
            } catch(e) { savedIncomes = []; }
        }

        if (typeof ShopManager !== 'undefined') {
            ShopManager.renderShopList('incShopList', 'IncomeManager.selectShop');
        }

        const btnShow = document.getElementById('btnShowIncImport');
        if(btnShow) btnShow.addEventListener('click', showImportView);
        
        const btnHide = document.getElementById('btnHideIncImport');
        if(btnHide) btnHide.addEventListener('click', hideImportView);

        const fileInput = document.getElementById('incomeFileInput');
        const dropZone = document.getElementById('incomeDropZone');
        if (fileInput && dropZone) {
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    _switchToImportUI();
                    importShopeeIncome(files[0]);
                }
                e.target.value = ''; // fix bug: allow re-upload same file
            });
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    _switchToImportUI();
                    importShopeeIncome(files[0]);
                }
            });
            dropZone.addEventListener('click', () => fileInput.click());
        }
    }

    function selectShop(shopId) {
        currentShop = shopId;
        const shop = ShopManager.getShops().find(s => s.id === shopId);
        const shopName = shop ? shop.name : shopId;
        
        document.getElementById('incShopSelectionView').classList.add('hidden');
        document.getElementById('incImportView').classList.add('hidden');
        document.getElementById('incHistoryView').classList.remove('hidden');

        const titleEl = document.getElementById('incHistoryTitle');
        if (titleEl) titleEl.textContent = `Data Penghasilan — ${shopName}`;
        
        const fromEl = document.getElementById('incFilterDateFrom');
        const toEl = document.getElementById('incFilterDateTo');
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';

        renderHistory();
    }

    function backToShopSelection() {
        currentShop = null;
        document.getElementById('incHistoryView').classList.add('hidden');
        document.getElementById('incImportView').classList.add('hidden');
        document.getElementById('incShopSelectionView').classList.remove('hidden');
    }

    function showImportView() {
        if (!currentShop) {
            showToast('Toko belum dipilih', 'error');
            return;
        }

        // Langsung panggil File Picker (Dialog OS)
        document.getElementById('incomeFileInput').click();
    }

    function _switchToImportUI() {
        const shop = ShopManager.getShops().find(s => s.id === currentShop);
        const shopName = shop ? shop.name : currentShop;

        document.getElementById('incHistoryView').classList.add('hidden');
        document.getElementById('incImportView').classList.remove('hidden');
        
        const titleEl = document.getElementById('incUploadTitle');
        if (titleEl) titleEl.textContent = `📦 Import Laporan Penghasilan — ${shopName}`;
        
        document.getElementById('incResults').innerHTML = '';
        document.getElementById('incResults').classList.add('hidden');
        document.getElementById('incFileList').innerHTML = '';
        importedIncomes = [];
    }

    function hideImportView() {
        document.getElementById('incImportView').classList.add('hidden');
        document.getElementById('incHistoryView').classList.remove('hidden');
        renderHistory();
    }

    function importShopeeIncome(file) {
        document.getElementById('incFileList').innerHTML = `<span style="font-size:12px;color:var(--text-muted);">Memproses ${escapeHtml(file.name)}...</span>`;
        if (typeof XLSX === 'undefined') {
            showToast('Library XLSX belum dimuat', 'error'); return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

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

                if (allRows.length < 2) {
                    showToast('File kosong / terlalu pendek', 'warning'); return;
                }

                let headerIdx = -1;
                for (let r = 0; r < Math.min(15, allRows.length); r++) {
                    const rowStr = (allRows[r] || []).map(c => String(c).toLowerCase()).join('|');
                    if (rowStr.includes('no. pesanan') || rowStr.includes('harga asli produk') || rowStr.includes('order/adjustment id')) {
                        headerIdx = r;
                        break;
                    }
                }

                if (headerIdx === -1) {
                    showToast('Format Penghasilan tidak dikenali (bukan format Shopee/TikTok)', 'error'); return;
                }

                const headers = allRows[headerIdx].map(h => String(h || '').toLowerCase().trim());
                const findCol = (...names) => {
                    for (const name of names) {
                        const idx = headers.findIndex(h => h.includes(name));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                const col = {
                    orderNo:     findCol('no. pesanan', 'order/adjustment id'),
                    date:        findCol('waktu pesanan', 'tanggal dana', 'order created time'),
                    relDate:     findCol('tanggal dana dilepas', 'order settled time'),
                    price:       findCol('harga asli produk', 'subtotal before discounts'),
                    discount:    findCol('total diskon produk', 'seller discounts'),
                    ams:         findCol('biaya komisi ams'),
                    admin:       findCol('biaya administrasi', 'platform commission fee'),
                    service:     findCol('biaya layanan', 'payment fee'),
                    processing:  findCol('biaya proses pesanan'),
                    shipping:    findCol('biaya program hemat', 'ongkos kirim dibayar oleh pembeli'),
                    actualShip:  findCol('ongkos kirim aktual', 'shipping costs passed on to the logistics provider'),
                    transaction: findCol('biaya transaksi'),
                    campaign:    findCol('biaya kampanye'),
                    total:       findCol('total penghasilan', 'total settlement amount'),
                    voucher:     findCol('voucher dispons'),
                    buyer:       findCol('username (pembeli)')
                };

                const orders = [];
                for (let r = headerIdx + 1; r < allRows.length; r++) {
                    const row = allRows[r];
                    if (!row || row.length < 3) continue;

                    const orderNo = col.orderNo !== -1 ? String(row[col.orderNo] || '').trim() : '';
                    if (!orderNo || !/^[A-Z0-9]+$/i.test(orderNo)) continue; 

                    const revenue = parseNum(col.price !== -1 ? row[col.price] : 0);
                    const adminFee = Math.abs(parseNum(col.admin !== -1 ? row[col.admin] : 0));
                    const totalEarnings = parseNum(col.total !== -1 ? row[col.total] : 0);
                    const actualShipping = Math.abs(parseNum(col.actualShip !== -1 ? row[col.actualShip] : 0));

                    const amsFee = Math.abs(parseNum(col.ams !== -1 ? row[col.ams] : 0));
                    const layananFee = Math.abs(parseNum(col.service !== -1 ? row[col.service] : 0));
                    const prosesFee = Math.abs(parseNum(col.processing !== -1 ? row[col.processing] : 0));
                    const hematKirimFee = Math.abs(parseNum(col.shipping !== -1 ? row[col.shipping] : 0));
                    const namaPembeli = col.buyer !== -1 ? String(row[col.buyer] || '').trim() : '-';

                    const dateRaw = col.date !== -1 ? row[col.date] : (col.relDate !== -1 ? row[col.relDate] : '');
                    const tanggal = formatDate(dateRaw);

                    orders.push({
                        noPesanan: orderNo,
                        tanggal,
                        namaPembeli,
                        revenue,
                        adminFee,
                        amsFee,
                        layananFee,
                        prosesFee,
                        hematKirimFee,
                        actualShipping,
                        totalEarnings
                    });
                }

                if (orders.length === 0) {
                    showToast('Tidak ada data pesanan yang ditemukan', 'warning');
                    return;
                }
                
                importedIncomes = orders;
                renderImportPreview();
                showToast(orders.length + ' data penghasilan siap disimpan', 'success');

            } catch (err) {
                showToast('Error membaca file: ' + err.message, 'error');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function renderImportPreview() {
        const container = document.getElementById('incResults');
        if (!container) return;

        let totalEarnings = 0;
        let totalAdmin = 0;
        importedIncomes.forEach(i => {
            totalEarnings += i.totalEarnings;
            totalAdmin += i.adminFee;
        });

        const shop = typeof ShopManager !== 'undefined' ? ShopManager.getShops().find(s => s.id === currentShop) : null;
        const isTiktok = shop && shop.platform === 'tiktok';

        let html = `
            <div class="card result-card">
                <div class="card-header">
                    <h2>📊 Preview Penghasilan</h2>
                </div>
                <div class="card-body">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 12px;">
                        <span>Data: <strong>${importedIncomes.length}</strong> pesanan</span>
                        <div style="display:flex; gap:16px;">
                            <span style="color:var(--text-muted);font-size:13px;">Total Admin: <strong style="color:var(--text);">${formatRp(totalAdmin)}</strong></span>
                            <span style="color:var(--text-muted);font-size:13px;">Total Penghasilan: <strong style="color:var(--green);">${formatRp(totalEarnings)}</strong></span>
                        </div>
                    </div>
                    <div class="table-wrapper" style="overflow-x:auto;">
                        <table class="order-table">
                            <thead>
                                <tr>
                                    <th>Tanggal Order</th>
                                    <th>No Pesanan</th>
                                    ${isTiktok ? `
                                    <th>Harga Asli</th>
                                    <th>Biaya Layanan</th>
                                    <th>Penghasilan Akhir</th>
                                    ` : `
                                    <th>Nama Pembeli</th>
                                    <th>Harga Asli</th>
                                    <th>Biaya Admin</th>
                                    <th>Biaya Komisi AMS</th>
                                    <th>Biaya Layanan</th>
                                    <th>Biaya Proses Pesanan</th>
                                    <th>Hemat Biaya Kirim</th>
                                    <th>Total Penghasilan</th>
                                    `}
                                </tr>
                            </thead>
                            <tbody>
                                ${importedIncomes.slice(0, 50).map(inc => `
                                    <tr>
                                        <td style="font-size:12px;white-space:nowrap;">${inc.tanggal}</td>
                                        <td style="font-size:12px;white-space:nowrap;">${inc.noPesanan}</td>
                                        ${isTiktok ? `
                                        <td style="font-size:12px;white-space:nowrap;">${formatRp(inc.revenue)}</td>
                                        <td style="font-size:12px;color:var(--red);white-space:nowrap;">${formatRp((inc.layananFee || 0) + (inc.adminFee || 0))}</td>
                                        <td style="font-size:12px;color:var(--green);font-weight:600;white-space:nowrap;">${formatRp(inc.totalEarnings)}</td>
                                        ` : `
                                        <td style="font-size:12px;white-space:nowrap;" title="${escapeHtml(inc.namaPembeli)}">${escapeHtml(inc.namaPembeli.length > 20 ? inc.namaPembeli.substring(0, 18) + '..' : inc.namaPembeli)}</td>
                                        <td style="font-size:12px;white-space:nowrap;">${formatRp(inc.revenue)}</td>
                                        <td style="font-size:12px;color:var(--red);white-space:nowrap;">${formatRp(inc.adminFee || 0)}</td>
                                        <td style="font-size:12px;color:var(--red);white-space:nowrap;">${formatRp(inc.amsFee || 0)}</td>
                                        <td style="font-size:12px;color:var(--red);white-space:nowrap;">${formatRp(inc.layananFee || 0)}</td>
                                        <td style="font-size:12px;color:var(--red);white-space:nowrap;">${formatRp(inc.prosesFee || 0)}</td>
                                        <td style="font-size:12px;color:var(--red);white-space:nowrap;">${formatRp(inc.hematKirimFee || 0)}</td>
                                        <td style="font-size:12px;color:var(--green);font-weight:600;white-space:nowrap;">${formatRp(inc.totalEarnings)}</td>
                                        `}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px;">Menampilkan hingga 50 data teratas</p>
                    <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:12px;">
                        <button class="btn-modal-cancel" onclick="IncomeManager.hideImportView()">Batal</button>
                        <button class="btn-calculate" onclick="IncomeManager.saveIncomes()">
                            <span class="btn-text">💾 Simpan Penghasilan</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
        container.classList.remove('hidden');
    }

    async function saveIncomes() {
        if(importedIncomes.length === 0) return;
        
        const deduped = [...savedIncomes];
        let added = 0;
        let updated = 0;
        
        importedIncomes.forEach(i => {
            i.shopId = currentShop;
            const existingIdx = deduped.findIndex(si => si.noPesanan === i.noPesanan);
            if (existingIdx !== -1) {
                deduped[existingIdx] = i;
                updated++;
            } else {
                deduped.push(i);
                added++;
            }
        });
        
        savedIncomes = deduped;
        let ordersUpdated = 0;

        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(savedIncomes));
            
            // Sync with Data Pesanan (bizmanager_orders)
            try {
                const ordersJson = await StorageManager.getItem('bizmanager_orders');
                if (ordersJson) {
                    let orders = JSON.parse(ordersJson);
                    let ordersChanged = false;
                    
                    importedIncomes.forEach(inc => {
                        orders.forEach(o => {
                            if (o.noPesanan === inc.noPesanan && o.status !== 'Selesai') {
                                o.status = 'Selesai';
                                ordersChanged = true;
                                ordersUpdated++;
                            }
                        });
                    });
                    
                    if (ordersChanged) {
                        await StorageManager.setItem('bizmanager_orders', JSON.stringify(orders));
                        // Reload OrderShipping data if module exists so UI is fresh
                        if (typeof OrderShipping !== 'undefined' && typeof OrderShipping.init === 'function') {
                            await OrderShipping.init();
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to sync order statuses:', err);
            }
        }
        
        let msg = `${added} disimpan, ${updated} diperbarui.`;
        if (ordersUpdated > 0) msg += ` (${ordersUpdated} pesanan di Data Pesanan otomatis jadi 'Selesai')`;
        
        showToast(msg, 'success');
        hideImportView();
    }

    function renderHistory() {
        const tbody = document.getElementById('incHistoryTableBody');
        if (!tbody) return;
        
        let filtered = savedIncomes;
        
        if (currentShop) {
            filtered = filtered.filter(i => i.shopId === currentShop);
        }
        
        const dateFrom = document.getElementById('incFilterDateFrom')?.value;
        const dateTo = document.getElementById('incFilterDateTo')?.value;
        
        if (dateFrom || dateTo) {
            filtered = filtered.filter(i => {
                // Normalize tanggal from "DD/MM/YYYY HH:MM" to "YYYY-MM-DD" for comparison
                const raw = i.tanggal || '';
                let comparable = raw;
                const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
                if (match) {
                    comparable = `${match[3]}-${match[2]}-${match[1]}`;
                }
                if (dateFrom && comparable < dateFrom) return false;
                if (dateTo && comparable > dateTo) return false;
                return true;
            });
        }
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--text-muted);">Belum ada data penghasilan tersimpan / sesuai filter</td></tr>';
            const selAll = document.getElementById('incSelectAll');
            if (selAll) selAll.checked = false;
            updateDeleteButton();
            return;
        }
        
        const sorted = [...filtered].sort((a,b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
        
        const shop = typeof ShopManager !== 'undefined' ? ShopManager.getShops().find(s => s.id === currentShop) : null;
        const isTiktok = shop && shop.platform === 'tiktok';

        const thead = document.getElementById('incHistoryTableHead');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th style="width:40px;text-align:center;"><input type="checkbox" id="incSelectAll" title="Pilih Semua" onchange="IncomeManager.toggleSelectAll(this)"></th>
                    <th>Tanggal Order</th>
                    <th>No Pesanan</th>
                    ${isTiktok ? `
                    <th>Harga Asli</th>
                    <th>Biaya Layanan</th>
                    <th>Penghasilan Akhir</th>
                    ` : `
                    <th>Nama Pembeli</th>
                    <th>Harga Asli</th>
                    <th>Biaya Admin</th>
                    <th>Biaya Komisi AMS</th>
                    <th>Biaya Layanan</th>
                    <th>Biaya Proses Pesanan</th>
                    <th>Hemat Biaya Kirim</th>
                    <th>Total Penghasilan</th>
                    `}
                    <th>Aksi</th>
                </tr>
            `;
        }

        let html = '';
        sorted.forEach(i => {
            const buyer = i.namaPembeli || '-';
            html += `<tr>
                <td style="text-align:center;"><input type="checkbox" class="inc-row-checkbox" value="${i.noPesanan}" onchange="IncomeManager.updateDeleteButton()"></td>
                <td style="white-space:nowrap;font-size:12px;">${i.tanggal||'-'}</td>
                <td style="font-size:11px;">${i.noPesanan||'-'}</td>
                ${isTiktok ? `
                <td style="white-space:nowrap;font-size:12px;">${formatRp(i.revenue||0)}</td>
                <td style="white-space:nowrap;font-size:12px;color:var(--red);">${formatRp((i.layananFee||0) + (i.adminFee||0))}</td>
                <td style="white-space:nowrap;font-size:12px;font-weight:600;color:var(--green);">${formatRp(i.totalEarnings||0)}</td>
                ` : `
                <td style="white-space:nowrap;font-size:12px;" title="${escapeHtml(buyer)}">${escapeHtml(buyer.length > 20 ? buyer.substring(0, 18) + '..' : buyer)}</td>
                <td style="white-space:nowrap;font-size:12px;">${formatRp(i.revenue||0)}</td>
                <td style="white-space:nowrap;font-size:12px;color:var(--red);">${formatRp(i.adminFee||0)}</td>
                <td style="white-space:nowrap;font-size:12px;color:var(--red);">${formatRp(i.amsFee||0)}</td>
                <td style="white-space:nowrap;font-size:12px;color:var(--red);">${formatRp(i.layananFee||0)}</td>
                <td style="white-space:nowrap;font-size:12px;color:var(--red);">${formatRp(i.prosesFee||0)}</td>
                <td style="white-space:nowrap;font-size:12px;color:var(--red);">${formatRp(i.hematKirimFee||0)}</td>
                <td style="white-space:nowrap;font-size:12px;font-weight:600;color:var(--green);">${formatRp(i.totalEarnings||0)}</td>
                `}
                <td><button onclick="IncomeManager.deleteIncome('${i.noPesanan}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;" title="Hapus">🗑️</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
        const selAll = document.getElementById('incSelectAll');
        if (selAll) selAll.checked = false;
        updateDeleteButton();
    }

    function toggleSelectAll(cb) {
        const checkboxes = document.querySelectorAll('.inc-row-checkbox');
        checkboxes.forEach(c => c.checked = cb.checked);
        updateDeleteButton();
    }

    function updateDeleteButton() {
        const anyChecked = document.querySelectorAll('.inc-row-checkbox:checked').length > 0;
        const btn = document.getElementById('incBtnDeleteSelected');
        if (btn) btn.style.display = anyChecked ? 'inline-block' : 'none';
        
        const allBoxes = document.querySelectorAll('.inc-row-checkbox');
        const selAll = document.getElementById('incSelectAll');
        if (selAll && allBoxes.length > 0) {
            selAll.checked = allBoxes.length === document.querySelectorAll('.inc-row-checkbox:checked').length;
        }
    }

    async function deleteSelectedIncomes() {
        const checked = document.querySelectorAll('.inc-row-checkbox:checked');
        if (checked.length === 0) return;
        
        const ok = await AppModal.confirm(`Hapus ${checked.length} data penghasilan yang dipilih?`, 'Hapus Data Masal', 'danger');
        if (!ok) return;
        
        const idsToDelete = Array.from(checked).map(cb => cb.value);
        savedIncomes = savedIncomes.filter(i => !idsToDelete.includes(i.noPesanan));
        
        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(savedIncomes));
        }
        
        showToast(`${checked.length} data berhasil dihapus`, 'success');
        renderHistory();
        
        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    }

    async function deleteIncome(noPesanan) {
        const ok = await AppModal.confirm(`Hapus data penghasilan ${noPesanan}?`, 'Hapus Data', 'danger');
        if (!ok) return;
        savedIncomes = savedIncomes.filter(i => i.noPesanan !== noPesanan);
        if(typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(savedIncomes));
        }
        showToast('Data penghasilan dihapus', 'success');
        renderHistory();
    }

    return {
        init,
        selectShop,
        backToShopSelection,
        showImportView,
        hideImportView,
        saveIncomes,
        deleteIncome,
        renderHistory,
        toggleSelectAll,
        updateDeleteButton,
        deleteSelectedIncomes,
        getSavedIncomes: () => savedIncomes
    };
})();
