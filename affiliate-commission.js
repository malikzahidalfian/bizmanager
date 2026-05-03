// ========================================
// AFFILIATE COMMISSION MANAGER
// ========================================

const AffiliateCommission = (() => {
    const STORAGE_KEY = 'bizmanager_affiliates';
    const ACCOUNTS_STORAGE_KEY = 'bizmanager_affiliate_accounts';
    let data = [];
    let accounts = [];
    let currentPlatform = 'shopee';
    let currentAccount = null;

    // Utilities
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' })[s];
        });
    }

    function formatRp(num) {
        if (!num || isNaN(num)) return 'Rp 0';
        return 'Rp ' + Math.round(num).toLocaleString('id-ID');
    }

    function parseNum(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;

        let s = String(str).trim();
        // Cek format ribuan Indonesia
        if (s.includes('.') && s.indexOf(',') === -1) {
            // Hanya ada titik, kemungkinkan besar separator ribuan.
            // Walau jika ada '.' di excel yang murni desimal akan kena,
            // laporan Tiktok menggunakan '.' untuk ribuan utuh.
            s = s.replace(/\./g, '');
        } else if (s.includes(',') && !s.includes('.')) {
            s = s.replace(/,/g, '.');
        } else if (s.includes('.') && s.includes(',')) {
            s = s.replace(/\./g, '').replace(/,/g, '.');
        }

        return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
    }

    function formatDate(val) {
        if (!val) return '-';
        if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${y}-${m}-${d}`; // Standardizing to YYYY-MM-DD
        }

        const str = String(val).trim();
        // Coba parsing format "DD/MM/YYYY" atau "DD-MM-YYYY"
        const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) {
            const d = match[1].padStart(2, '0');
            const m = match[2].padStart(2, '0');
            const y = match[3];
            return `${y}-${m}-${d}`;
        }

        // Coba parsing date native valid
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toISOString().substring(0, 10);
        }

        return str; // return raw if parsing fails
    }

    async function init() {
        if (typeof StorageManager !== 'undefined') {
            try {
                const storedAcc = await StorageManager.getItem(ACCOUNTS_STORAGE_KEY);
                if (storedAcc) accounts = JSON.parse(storedAcc);
            } catch (e) { accounts = []; }

            try {
                const stored = await StorageManager.getItem(STORAGE_KEY);
                if (stored) data = JSON.parse(stored);
            } catch (e) {
                data = [];
            }

            // Migration for legacy data: assign missing accountId
            let dataChanged = false;
            let accountsChanged = false;
            let defaultShopee = accounts.find(a => a.platform === 'shopee' && a.id === 'default_shopee')?.id;
            let defaultTiktok = accounts.find(a => a.platform === 'tiktok' && a.id === 'default_tiktok')?.id;

            data.forEach(item => {
                const p = String(item.platform).toLowerCase() || 'shopee';
                if (!item.accountId) {
                    if (p === 'shopee') {
                        if (!defaultShopee) {
                            accounts.push({ id: 'default_shopee', name: 'Akun Utama', platform: 'shopee' });
                            defaultShopee = 'default_shopee';
                            accountsChanged = true;
                        }
                        item.accountId = defaultShopee;
                    } else {
                        if (!defaultTiktok) {
                            accounts.push({ id: 'default_tiktok', name: 'Akun Utama', platform: 'tiktok' });
                            defaultTiktok = 'default_tiktok';
                            accountsChanged = true;
                        }
                        item.accountId = defaultTiktok;
                    }
                    dataChanged = true;
                }
            });

            if (accountsChanged) await StorageManager.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
            if (dataChanged) await StorageManager.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        setupEvents();
    }

    function setupEvents() {
        const btnImport = document.getElementById('affBtnImport');
        const fileInput = document.getElementById('affFileInput');
        const dropZone = document.getElementById('affDropZone');

        if (btnImport && fileInput) {
            btnImport.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', handleFileSelect);
        }

        if (dropZone && fileInput) {
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    processExcel(e.dataTransfer.files[0]);
                }
            });
            dropZone.addEventListener('click', () => fileInput.click());
        }
    }

    function render() {
        if (!currentAccount) return;
        renderDashboard();
        renderTable();
    }

    function switchPlatform(platform) {
        currentPlatform = platform;
        currentAccount = null;
        document.getElementById('affAccountSelectionView').classList.remove('hidden');
        document.getElementById('affDashboardView').classList.add('hidden');
        renderAccountList();
    }

    function renderAccountList() {
        const container = document.getElementById('affAccountList');
        if (!container) return;

        const filtered = accounts.filter(a => a.platform === currentPlatform);
        if (filtered.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1;">Belum ada akun. Klik "+ Tambah Akun" untuk memulai.</div>';
            return;
        }

        let html = '';
        filtered.forEach(acc => {
            html += `
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:20px; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.02); transition: all 0.2s; display:flex; flex-direction:column; gap:12px; height: 100%;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border-color)';" onclick="AffiliateCommission.selectAccount('${acc.id}')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h3 style="font-size:18px; font-weight:700;">${escapeHtml(acc.name)}</h3>
                        <button onclick="event.stopPropagation(); AffiliateCommission.deleteAccount('${acc.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:18px;" onmouseover="this.style.color='var(--red)';" onmouseout="this.style.color='var(--text-muted)';">✕</button>
                    </div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:auto;">Klik untuk melihat performa ➔</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    async function addAccount() {
        if (typeof AppModal === 'undefined') {
            const name = prompt('Masukkan nama akun affiliate baru:');
            if (name && name.trim() !== '') {
                accounts.push({ id: 'aff_acc_' + Date.now(), name: name.trim(), platform: currentPlatform });
                if (typeof StorageManager !== 'undefined') await StorageManager.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
                renderAccountList();
            }
            return;
        }

        const name = await AppModal.prompt('Masukkan nama akun affiliate baru:', 'Tambah Akun', 'Cth: Akun Utama / Akun ke-2');
        if (!name || name.trim() === '') return;

        accounts.push({
            id: 'aff_acc_' + Date.now(),
            name: name.trim(),
            platform: currentPlatform
        });

        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        }
        if (typeof showToast !== 'undefined') showToast('Akun berhasil ditambahkan', 'success');
        renderAccountList();
    }

    async function deleteAccount(id) {
        if (typeof AppModal === 'undefined') return;
        const ok = await AppModal.confirm('Peringatan: Menghapus akun tidak otomatis menghapus riwayat komisi (data akan mengambang). Lanjutkan hapus akun?', 'Hapus Akun', 'danger');
        if (!ok) return;

        accounts = accounts.filter(a => a.id !== id);
        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        }
        if (typeof showToast !== 'undefined') showToast('Akun dihapus', 'success');
        renderAccountList();
    }

    function selectAccount(id) {
        currentAccount = accounts.find(a => a.id === id);
        if (!currentAccount) return;

        document.getElementById('affAccountSelectionView').classList.add('hidden');
        document.getElementById('affDashboardView').classList.remove('hidden');

        const titleEl = document.getElementById('affiliatePageTitle');
        if (titleEl) {
            const pltStr = currentPlatform === 'shopee' ? 'Shopee' : 'TikTok';
            titleEl.textContent = `🤝 ${pltStr} Affiliate — ${currentAccount.name}`;
            document.getElementById('affFilterPlatform').value = currentPlatform;
        }

        render();
    }

    function backToAccounts() {
        currentAccount = null;
        document.getElementById('affAccountSelectionView').classList.remove('hidden');
        document.getElementById('affDashboardView').classList.add('hidden');
        renderAccountList();
    }

    function handleDateRangeChange() {
        const range = document.getElementById('affDateRangeFilter');
        const customWrapper = document.getElementById('affCustomDateWrapper');
        const inputFrom = document.getElementById('affDateFrom');
        const inputTo = document.getElementById('affDateTo');

        if (!range) return;

        if (range.value === 'custom') {
            if (customWrapper) customWrapper.style.display = 'flex';
            return; // Tunggu user memilih tanggal
        } else {
            if (customWrapper) customWrapper.style.display = 'none';

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let from = '';
            let to = '';

            const formatDate = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            if (range.value === 'today') {
                from = formatDate(today);
                to = from;
            } else if (range.value === 'yesterday') {
                const yest = new Date(today);
                yest.setDate(yest.getDate() - 1);
                from = formatDate(yest);
                to = from;
            } else if (range.value === '7days') {
                const prev = new Date(today);
                prev.setDate(prev.getDate() - 6);
                from = formatDate(prev);
                to = formatDate(today);
            } else if (range.value === 'thismonth') {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                from = formatDate(firstDay);
                to = formatDate(lastDay);
            }

            if (inputFrom) inputFrom.value = from;
            if (inputTo) inputTo.value = to;
        }
        render();
    }

    function renderDashboard() {
        const elTotalList = document.getElementById('affDashTotal');
        const chartContainer = document.getElementById('affChartContainer');
        if (!elTotalList) return;

        const filterPlatform = document.getElementById('affFilterPlatform') ? document.getElementById('affFilterPlatform').value : 'all';
        const filterDateFrom = document.getElementById('affDateFrom') ? document.getElementById('affDateFrom').value : '';
        const filterDateTo = document.getElementById('affDateTo') ? document.getElementById('affDateTo').value : '';

        const now = new Date();
        const monthGroups = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mstr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
            monthGroups[mstr] = { label, val: 0 };
        }

        let totalFiltered = 0;
        let globalTotal = 0, globalShopee = 0, globalTiktok = 0, globalBulanIni = 0;
        const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // GLOBAL metrics
        data.forEach(item => {
            const val = parseNum(item.komisi);
            const p = String(item.platform).toLowerCase();

            globalTotal += val;
            if (p === 'shopee') globalShopee += val;
            if (p === 'tiktok') globalTiktok += val;
            if (item.tanggal && item.tanggal.substring(0, 7) === thisMonthStr) {
                globalBulanIni += val;
            }
        });

        // ACCOUNT metrics
        const accountData = data.filter(d => d.accountId === currentAccount.id);
        accountData.forEach(item => {
            const val = parseNum(item.komisi);
            const p = String(item.platform).toLowerCase();

            // Untuk chart tren 6 bulan (selalu pakai filter platform, tapi abaikan filter tanggal)
            if (filterPlatform === 'all' || p === filterPlatform) {
                if (item.tanggal) {
                    const ym = item.tanggal.substring(0, 7);
                    if (monthGroups[ym]) monthGroups[ym].val += val;
                }
            }

            // Untuk total komisi utama (harus memenuhi filter platform & filter tanggal)
            let passPlatform = (filterPlatform === 'all' || p === filterPlatform);
            let passDateFrom = (!filterDateFrom || item.tanggal >= filterDateFrom);
            let passDateTo = (!filterDateTo || item.tanggal <= filterDateTo);

            if (passPlatform && passDateFrom && passDateTo) {
                totalFiltered += val;
            }
        });

        // Update Label
        const labelEl = document.getElementById('affDashMetricLabel');
        if (labelEl) {
            let labelParts = [];
            labelParts.push(filterPlatform === 'all' ? 'SEMUA PLATFORM' : filterPlatform.toUpperCase());
            const range = document.getElementById('affDateRangeFilter');
            if (range && range.value !== 'all') {
                labelParts.push(range.options[range.selectedIndex].text.toUpperCase());
            } else if (filterDateFrom || filterDateTo) {
                labelParts.push('KUSTOM');
            } else {
                labelParts.push('KESELURUHAN WAKTU');
            }
            labelEl.textContent = 'TOTAL KOMISI CAIR | ' + labelParts.join(' - ');
        }

        // Update Affiliate Page Metric
        elTotalList.textContent = formatRp(totalFiltered);

        // Update Main Dashboard Metrics (Absolute Totals)
        if (document.getElementById('dashAffTotal')) document.getElementById('dashAffTotal').textContent = formatRp(globalTotal);
        if (document.getElementById('dashAffShopee')) document.getElementById('dashAffShopee').textContent = formatRp(globalShopee);
        if (document.getElementById('dashAffTiktok')) document.getElementById('dashAffTiktok').textContent = formatRp(globalTiktok);
        if (document.getElementById('dashAffMonth')) document.getElementById('dashAffMonth').textContent = formatRp(globalBulanIni);

        // Render CSS Chart
        if (chartContainer) {
            const vals = Object.values(monthGroups).map(m => m.val);
            const maxVal = Math.max(...vals, 1000); // minimal height scale

            let html = `<div style="display:flex; align-items:flex-end; justify-content:space-between; height:150px; padding-top:20px; gap:8px;">`;

            Object.values(monthGroups).forEach(m => {
                const heightPct = (m.val / maxVal) * 100;
                html += `
                <div style="display:flex; flex-direction:column; align-items:center; flex:1; gap:8px;">
                    <div style="font-size:10px; color:var(--text-muted); font-weight:600;">${m.val > 0 ? (m.val / 1000).toFixed(0) + 'K' : ''}</div>
                    <div style="width:100%; max-width:40px; height:${heightPct}%; min-height:4px; background:var(--accent-gradient); border-radius:4px 4px 0 0; transition:height 0.5s;"></div>
                    <div style="font-size:11px; color:var(--text-secondary); font-weight:500;">${m.label}</div>
                </div>`;
            });
            html += `</div>`;
            chartContainer.innerHTML = html;
        }
    }

    function renderTable() {
        const tbody = document.getElementById('affTableBody');
        const filterStatus = document.getElementById('affFilterStatus') ? document.getElementById('affFilterStatus').value : 'all';
        const filterPlatform = document.getElementById('affFilterPlatform') ? document.getElementById('affFilterPlatform').value : 'all';
        const filterDateFrom = document.getElementById('affDateFrom') ? document.getElementById('affDateFrom').value : '';
        const filterDateTo = document.getElementById('affDateTo') ? document.getElementById('affDateTo').value : '';

        if (!tbody || !currentAccount) return;

        let filtered = data.filter(d => d.accountId === currentAccount.id);

        if (filterStatus !== 'all') {
            filtered = filtered.filter(i => {
                const s = String(i.status).toLowerCase();
                if (filterStatus === 'selesai') return s.includes('selesai') || s.includes('dibayar') || s.includes('sukses');
                if (filterStatus === 'pending') return s.includes('pending') || s.includes('proses');
                if (filterStatus === 'batal') return s.includes('batal') || s.includes('tolak');
                return true;
            });
        }

        if (filterPlatform !== 'all') {
            filtered = filtered.filter(i => String(i.platform).toLowerCase() === filterPlatform);
        }

        if (filterDateFrom) filtered = filtered.filter(i => i.tanggal >= filterDateFrom);
        if (filterDateTo) filtered = filtered.filter(i => i.tanggal <= filterDateTo);

        filtered.sort((a, b) => {
            if (!a.tanggal) return 1;
            if (!b.tanggal) return -1;
            return b.tanggal.localeCompare(a.tanggal);
        });

        const thead = document.getElementById('affTableHeader');
        if (thead) {
            if (filterPlatform === 'shopee') {
                thead.innerHTML = `<tr>
                    <th>Tanggal</th>
                    <th>Platform</th>
                    <th>Komisi Cair</th>
                    <th style="width:50px;">Aksi</th>
                </tr>`;
            } else {
                thead.innerHTML = `<tr>
                    <th>Tanggal</th>
                    <th>Platform</th>
                    <th>No. Pesanan</th>
                    <th>Produk</th>
                    <th>Komisi</th>
                    <th>Status</th>
                    <th style="width:50px;">Aksi</th>
                </tr>`;
            }
        }

        if (filtered.length === 0) {
            const colSpan = filterPlatform === 'shopee' ? 4 : 7;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--text-muted);">Belum ada data komisi</td></tr>`;
            return;
        }

        let html = '';

        if (filterPlatform === 'shopee') {
            // Agregasi Data Shopee Harian (Komisi Cair = Status Selesai/Dibayar)
            const grouped = {};
            filtered.forEach(i => {
                const rawStatus = String(i.status).toLowerCase();
                // Hanya hitung yang berstatus cair / selesai
                if (rawStatus.includes('selesai') || rawStatus.includes('dibayar') || rawStatus.includes('sukses')) {
                    const key = i.tanggal + '|' + i.platform;
                    if (!grouped[key]) {
                        grouped[key] = { key: key, tanggal: i.tanggal, platform: i.platform, komisi: 0 };
                    }
                    grouped[key].komisi += (typeof i.komisi === 'number' ? i.komisi : parseInt(String(i.komisi).replace(/\\D/g, '') || 0));
                }
            });

            const groupedArr = Object.values(grouped);
            groupedArr.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

            if (groupedArr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Belum ada komisi cair</td></tr>`;
                return;
            }

            groupedArr.forEach(i => {
                const pltfIcon = i.platform === 'tiktok' ? '🎵 TikTok' : (i.platform === 'shopee' ? '🛒 Shopee' : '🌐 Lainnya');
                html += `<tr>
                    <td style="font-size:12px;white-space:nowrap;">${escapeHtml(i.tanggal || '-')}</td>
                    <td style="font-size:12px;">${escapeHtml(pltfIcon)}</td>
                    <td style="font-size:13px;font-weight:600;color:var(--text-primary);">${formatRp(i.komisi)}</td>
                    <td>
                        <button onclick="AffiliateCommission.deleteData('${i.key}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;" title="Hapus Total Hari Ini">🗑️</button>
                    </td>
                </tr>`;
            });
        } else {
            // Render Tampilan Mendetail (TikTok / Semua)
            let htmlInner = '';
            filtered.forEach(i => {
                const pltfIcon = i.platform === 'tiktok' ? '🎵 TikTok' : (i.platform === 'shopee' ? '🛒 Shopee' : '🌐 Lainnya');

                let statusBadge = '';
                const s = String(i.status).toLowerCase();
                if (s.includes('selesai') || s.includes('dibayar') || s.includes('sukses')) statusBadge = `<span style="background:rgba(34,197,94,0.1);color:var(--green);padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;">Selesai</span>`;
                else if (s.includes('pending') || s.includes('proses')) statusBadge = `<span style="background:rgba(234,179,8,0.1);color:#eab308;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;">Pending</span>`;
                else statusBadge = `<span style="background:rgba(239,68,68,0.1);color:var(--red);padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;">Batal</span>`;

                htmlInner += `<tr>
                    <td style="font-size:12px;white-space:nowrap;">${escapeHtml(i.tanggal || '-')}</td>
                    <td style="font-size:12px;">${escapeHtml(pltfIcon)}</td>
                    <td style="font-size:12px;" title="${escapeHtml(i.noPesanan)}">${escapeHtml(i.noPesanan || '-')}</td>
                    <td style="font-size:12px;" title="${escapeHtml(i.produk)}">${escapeHtml(i.produk ? (i.produk.length > 30 ? i.produk.substring(0, 30) + '...' : i.produk) : '-')}</td>
                    <td style="font-size:13px;font-weight:600;color:var(--text-primary);">${formatRp(i.komisi)}</td>
                    <td style="font-size:12px;">${statusBadge}</td>
                    <td>
                        <button onclick="AffiliateCommission.deleteData('${i.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;" title="Hapus">🗑️</button>
                    </td>
                </tr>`;
            });
            html = htmlInner;
        }

        tbody.innerHTML = html;
    }

    function openManualForm() {
        const modal = document.getElementById('affModal');
        if (modal) {
            document.getElementById('affFormId').value = '';
            document.getElementById('affFormTanggal').value = new Date().toISOString().substring(0, 10);
            document.getElementById('affFormPlatform').value = 'shopee';
            document.getElementById('affFormNoPesanan').value = '';
            document.getElementById('affFormProduk').value = '';
            document.getElementById('affFormKomisi').value = '';
            document.getElementById('affFormStatus').value = 'Selesai';
            const pltfDropdown = document.getElementById('affFormPlatform');
            pltfDropdown.value = document.getElementById('affFilterPlatform') ? (document.getElementById('affFilterPlatform').value === 'all' ? 'shopee' : document.getElementById('affFilterPlatform').value) : 'shopee';

            // Toggle form details visibility based on platform
            AffiliateCommission.toggleManualForm(pltfDropdown.value);

            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    }

    function toggleManualForm(platform) {
        const details = document.querySelectorAll('.aff-detail-group');
        details.forEach(el => {
            if (platform === 'shopee') {
                el.style.display = 'none';
                document.getElementById('affFormStatus').value = 'Selesai';
            } else {
                el.style.display = 'block';
            }
        });
    }

    // Bind event to platform dropdown
    document.addEventListener('DOMContentLoaded', () => {
        const plt = document.getElementById('affFormPlatform');
        if (plt) plt.addEventListener('change', (e) => AffiliateCommission.toggleManualForm(e.target.value));
    });

    function closeManualForm() {
        const modal = document.getElementById('affModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    async function saveForm() {
        const id = document.getElementById('affFormId').value || 'aff_' + Date.now();
        const item = {
            id: id,
            accountId: currentAccount ? currentAccount.id : null,
            tanggal: document.getElementById('affFormTanggal').value,
            platform: document.getElementById('affFormPlatform').value,
            noPesanan: document.getElementById('affFormNoPesanan').value,
            produk: document.getElementById('affFormProduk').value,
            komisi: parseNum(document.getElementById('affFormKomisi').value),
            status: document.getElementById('affFormStatus').value,
        };

        const existingIdx = data.findIndex(d => d.id === id);
        if (existingIdx !== -1) data[existingIdx] = item;
        else data.push(item);

        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        if (typeof showToast !== 'undefined') showToast('Data komisi disimpan', 'success');
        closeManualForm();
        render();
    }

    async function deleteData(key) {
        if (key.includes('|')) {
            const ok = await AppModal.confirm('Hapus seluruh pencatatan komisi untuk tanggal & platform ini?', 'Hapus Data', 'danger');
            if (!ok) return;

            data = data.filter(d => {
                const rawStatus = String(d.status).toLowerCase();
                let isCair = rawStatus.includes('selesai') || rawStatus.includes('dibayar') || rawStatus.includes('sukses');
                if (isCair) {
                    const dKey = d.tanggal + '|' + d.platform;
                    return dKey !== key; // remove if key matches
                }
                return true;
            });
        } else {
            const ok = await AppModal.confirm('Hapus pencatatan komisi ini?', 'Hapus Data', 'danger');
            if (!ok) return;
            data = data.filter(d => d.id !== key);
        }

        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        if (typeof showToast !== 'undefined') showToast('Data dihapus', 'success');
        render();
    }

    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            processExcel(e.target.files[0]);
        }
        e.target.value = ''; // fix bug: allow re-upload same file
    }

    function processExcel(file) {
        if (typeof XLSX === 'undefined') {
            if (typeof showToast !== 'undefined') showToast('Library XLSX belum dimuat', 'error');
            return;
        }

        if (typeof showToast !== 'undefined') showToast('Membaca file Excel...', 'info');

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const extData = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(extData, { type: 'array' });

                // Cari sheet yang memungkinkan
                let sheetName = workbook.SheetNames[0];
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
                    if (typeof showToast !== 'undefined') showToast('File kosong/terlalu pendek', 'warning');
                    return;
                }

                // Cari baris header
                let headerIdx = -1;
                for (let r = 0; r < Math.min(10, allRows.length); r++) {
                    const rowStr = (allRows[r] || []).map(c => String(c).toLowerCase()).join('|');
                    // Keyword Affiliate
                    if (rowStr.includes('komisi') || rowStr.includes('pesanan') || rowStr.includes('penghasilan estimasi') || rowStr.includes('estimated commission')) {
                        headerIdx = r;
                        break;
                    }
                }

                if (headerIdx === -1) {
                    if (typeof showToast !== 'undefined') showToast('Format kolom Affiliate tidak dikenali', 'error');
                    return;
                }

                const headers = allRows[headerIdx].map(h => String(h || '').toLowerCase().trim());
                const findCol = (...names) => {
                    for (const name of names) {
                        const idx = headers.findIndex(h => h.includes(name));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };

                // Kolom standar Shopee/TikTok affiliate
                const col = {
                    date: findCol('waktu pesanan', 'tanggal dana', 'create time', 'tanggal pesanan'),
                    orderNo: findCol('pesanan', 'order id', 'no. pesanan', 'id pesanan'),
                    product: findCol('nama produk', 'product name'),
                    totalSales: findCol('gmv', 'jumlah pembayaran', 'total pembayaran'),
                    commission: findCol('penghasilan estimasi', 'estimasi komisi', 'estimated commission', 'komisi dibayar', 'total penghasilan akhir', 'perkiraan komisi'),
                    status: findCol('status', 'payment status')
                };

                let importedCount = 0;
                let platformGuess = headers.join('|').includes('gmv') ? 'tiktok' : 'shopee';

                for (let r = headerIdx + 1; r < allRows.length; r++) {
                    const row = allRows[r];
                    if (!row || row.length < 3) continue;

                    const dateRaw = col.date !== -1 ? row[col.date] : '';
                    const orderNo = col.orderNo !== -1 ? String(row[col.orderNo]).trim() : '';

                    if (!dateRaw && !orderNo) continue;

                    const commission = parseNum(col.commission !== -1 ? row[col.commission] : 0);
                    if (commission <= 0) continue; // Abaikan 0 komisi

                    const item = {
                        id: 'aff_' + orderNo + '_' + r, // semi-unique
                        accountId: currentAccount ? currentAccount.id : null,
                        tanggal: formatDate(dateRaw) || new Date().toISOString().substring(0, 10),
                        platform: platformGuess,
                        noPesanan: orderNo,
                        produk: col.product !== -1 ? String(row[col.product] || '').trim() : '',
                        komisi: commission,
                        status: col.status !== -1 ? String(row[col.status] || '').trim() : 'Selesai'
                    };

                    // Insert or update based on orderNo
                    const exIdx = data.findIndex(d => d.noPesanan === item.noPesanan);
                    if (exIdx !== -1) {
                        data[exIdx] = item;
                    } else {
                        data.push(item);
                    }
                    importedCount++;
                }

                if (importedCount === 0) {
                    if (typeof showToast !== 'undefined') showToast('Tidak ada data komisi valid yang ditemukan di file ini.', 'warning');
                } else {
                    if (typeof StorageManager !== 'undefined') {
                        await StorageManager.setItem(STORAGE_KEY, JSON.stringify(data));
                    }
                    if (typeof showToast !== 'undefined') showToast(`Berhasil import ${importedCount} data komisi affiliate`, 'success');
                    render();
                }

                // Reset input file
                document.getElementById('affFileInput').value = '';

            } catch (err) {
                if (typeof showToast !== 'undefined') showToast('Error memproses Excel: ' + err.message, 'error');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    return {
        init,
        render,
        switchPlatform,
        renderAccountList,
        addAccount,
        deleteAccount,
        selectAccount,
        backToAccounts,
        handleDateRangeChange,
        openManualForm,
        closeManualForm,
        toggleManualForm,
        saveForm,
        deleteData,
        handleFileSelect
    };
})();
