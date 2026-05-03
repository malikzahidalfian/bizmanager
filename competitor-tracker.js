// ========================================
// COMPETITOR TRACKER MODULE (v2)
// — Manual tracking + Bookmarklet import + Seller Center import
// ========================================

const CompetitorTracker = (() => {
    const STORAGE_KEY = 'bizmanager_competitors';
    const SCRAPE_KEY = 'bizmanager_scrape_results';
    let competitors = [];
    let scrapeResults = [];
    let editingId = null;
    let activeTab = 'manual'; // 'manual' | 'scrape' | 'import'

    // ---- STORAGE ----
    async function load() {
        try {
            const cData = await StorageManager.getItem(STORAGE_KEY);
            competitors = cData ? JSON.parse(cData) : [];
        } catch { competitors = []; }
        try {
            const sData = await StorageManager.getItem(SCRAPE_KEY);
            scrapeResults = sData ? JSON.parse(sData) : [];
        } catch { scrapeResults = []; }
    }
    function save() { StorageManager.setItem(STORAGE_KEY, JSON.stringify(competitors)); }
    function saveScrape() { StorageManager.setItem(SCRAPE_KEY, JSON.stringify(scrapeResults)); }

    // ---- UTILS ----
    function escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
    function formatRp(num) { return ProfitCalculator.formatRupiah(num || 0); }

    // ---- CRUD ----
    function addCompetitor(c) {
        c.id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        c.createdAt = new Date().toISOString();
        c.history = [{ date: new Date().toISOString().split('T')[0], harga: c.harga, posisiIklan: c.posisiIklan, estPenjualan: c.estPenjualan, catatan: 'Data awal' }];
        competitors.unshift(c);
        save();
        return c;
    }

    function updateCompetitor(id, data) {
        const idx = competitors.findIndex(c => c.id === id);
        if (idx !== -1) {
            const old = competitors[idx];
            if (data.harga !== old.harga || data.posisiIklan !== old.posisiIklan || data.estPenjualan !== old.estPenjualan) {
                if (!old.history) old.history = [];
                old.history.push({ date: new Date().toISOString().split('T')[0], harga: data.harga, posisiIklan: data.posisiIklan, estPenjualan: data.estPenjualan, catatan: data.catatan || '' });
            }
            competitors[idx] = { ...old, ...data };
            save();
        }
    }

    function deleteCompetitor(id) {
        competitors = competitors.filter(c => c.id !== id);
        save();
    }

    // ---- TAB SWITCHING ----
    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.comp-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.getElementById('compManualView').classList.toggle('hidden', tab !== 'manual');
        document.getElementById('compScrapeView').classList.toggle('hidden', tab !== 'scrape');
        document.getElementById('compImportView').classList.toggle('hidden', tab !== 'import');

        if (tab === 'manual') renderManualList();
        if (tab === 'scrape') renderScrapeView();
        if (tab === 'import') renderImportView();
    }

    // ========================================
    // TAB 1: MANUAL LIST
    // ========================================
    function renderManualList() {
        const container = document.getElementById('compManualContent');
        if (competitors.length === 0) {
            container.innerHTML = '<div class="competitor-empty">Belum ada data kompetitor. Klik "+ Tambah Kompetitor" untuk mulai tracking.</div>';
            return;
        }
        let html = '<div class="competitor-grid">';
        competitors.forEach(c => {
            const histLen = c.history ? c.history.length : 0;
            let priceTrend = '';
            if (c.history && c.history.length >= 2) {
                const prev = c.history[c.history.length - 2].harga;
                if (c.harga > prev) priceTrend = '<span class="trend-up">↑</span>';
                else if (c.harga < prev) priceTrend = '<span class="trend-down">↓</span>';
                else priceTrend = '<span class="trend-same">→</span>';
            }
            html += `
                <div class="competitor-card">
                    <div class="competitor-card-top">
                        <div>
                            <h4 class="competitor-shop">${escapeHtml(c.namaToko)}</h4>
                            <p class="competitor-product">${escapeHtml(c.produk)}</p>
                        </div>
                        <button class="product-menu-btn" onclick="CompetitorTracker.openEditModal('${c.id}')" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="competitor-metrics">
                        <div class="competitor-metric"><span class="cm-label">Harga</span><span class="cm-value">${formatRp(c.harga)} ${priceTrend}</span></div>
                        <div class="competitor-metric"><span class="cm-label">Posisi Iklan</span><span class="cm-value">${c.posisiIklan || '-'}</span></div>
                        <div class="competitor-metric"><span class="cm-label">Est. Penjualan</span><span class="cm-value">${c.estPenjualan || '-'}</span></div>
                    </div>
                    ${c.kataKunci ? `<div class="competitor-keywords">${c.kataKunci.split(',').map(k => `<span class="keyword-tag">${escapeHtml(k.trim())}</span>`).join('')}</div>` : ''}
                    <div class="competitor-footer">
                        <span class="competitor-history-label">${histLen} perubahan tercatat</span>
                        <button class="competitor-history-btn" onclick="CompetitorTracker.showHistory('${c.id}')">📊 Riwayat</button>
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ========================================
    // TAB 2: SCRAPE / BOOKMARKLET RESULTS
    // ========================================
    let scrapeSort = { field: 'position', dir: 'asc' }; // default: urutan asli

    function parseSoldNum(str) {
        if (!str) return 0;
        let s = str.replace(/[^\d.,RBJTrbjtKk+]/gi, '');
        if (/rb/i.test(s)) return parseFloat(s) * 1000;
        if (/jt/i.test(s)) return parseFloat(s) * 1000000;
        if (/k/i.test(s)) return parseFloat(s) * 1000;
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }

    function parsePriceNum(str) {
        if (!str) return 0;
        return parseInt(str.replace(/[^\d]/g, '')) || 0;
    }

    // Popularity Score: combines sold, rating, position
    function calcPopularityScore(item, totalItems) {
        const sold = parseSoldNum(item.sold);
        const rating = parseFloat(item.rating) || 0;
        const pos = item.position || totalItems;

        // Normalize sold (log scale since values vary hugely: 1 vs 10000+)
        const soldScore = sold > 0 ? Math.min(Math.log10(sold + 1) / 5, 1) : 0;
        // Normalize rating (0-5 → 0-1)
        const ratingScore = rating / 5;
        // Normalize position (top = 1, bottom = 0)
        const posScore = totalItems > 1 ? (totalItems - pos) / (totalItems - 1) : 0.5;

        // Weighted: sold 50%, rating 30%, position 20%
        const raw = (soldScore * 0.5) + (ratingScore * 0.3) + (posScore * 0.2);
        return Math.round(raw * 100);
    }

    function scoreLabel(score) {
        if (score >= 70) return { text: '🔥 Hot', cls: 'score-hot' };
        if (score >= 40) return { text: '🟡 Warm', cls: 'score-warm' };
        return { text: '⚪ Cold', cls: 'score-cold' };
    }

    function sortScrapeResults(results) {
        const sorted = [...results];
        const total = results.length;
        const { field, dir } = scrapeSort;
        const mult = dir === 'asc' ? 1 : -1;

        sorted.sort((a, b) => {
            let va, vb;
            switch (field) {
                case 'price': va = parsePriceNum(a.price); vb = parsePriceNum(b.price); break;
                case 'sold': va = parseSoldNum(a.sold); vb = parseSoldNum(b.sold); break;
                case 'rating': va = parseFloat(a.rating) || 0; vb = parseFloat(b.rating) || 0; break;
                case 'ad': va = a.isAd ? 1 : 0; vb = b.isAd ? 1 : 0; break;
                case 'score': va = calcPopularityScore(a, total); vb = calcPopularityScore(b, total); break;
                default: va = a.position || 0; vb = b.position || 0;
            }
            return (va - vb) * mult;
        });
        return sorted;
    }

    function toggleSort(field) {
        if (scrapeSort.field === field) {
            scrapeSort.dir = scrapeSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            scrapeSort.field = field;
            scrapeSort.dir = (field === 'sold' || field === 'rating' || field === 'score') ? 'desc' : 'asc';
        }
        renderScrapeView();
    }

    function sortArrow(field) {
        if (scrapeSort.field !== field) return '';
        return scrapeSort.dir === 'asc' ? ' ↑' : ' ↓';
    }

    function renderScrapeView() {
        const container = document.getElementById('compScrapeContent');
        let html = `
            <div class="scrape-instruction">
                <h4>📋 Cara Pakai Bookmarklet Shopee</h4>
                <ol>
                    <li>Drag tombol di bawah ini ke <strong>bookmark bar</strong> browser kamu</li>
                    <li>Buka <a href="https://shopee.co.id" target="_blank">shopee.co.id</a> dan cari produk dengan kata kunci</li>
                    <li>Scroll sampai semua produk di halaman pertama muncul</li>
                    <li>Klik bookmarklet di bookmark bar</li>
                    <li>Data akan otomatis di-copy ke clipboard</li>
                    <li>Kembali ke sini dan klik <strong>"Paste Data"</strong></li>
                </ol>
                <div class="bookmarklet-container">
                    <a class="bookmarklet-btn" href="${getBookmarkletCode()}" onclick="event.preventDefault(); alert('⚠️ CARA PAKAI:\\n\\nJangan diklik di sini!\\n\\nSilakan DRAG (tahan dan seret) tombol ini ke atas menuju Bookmark Bar browser Anda.\\n\\nLalu buka halaman pencarian produk di shopee.co.id, dan klik bookmark tersebut dari barisan atas browser kamu.');">🔍 Scrape Shopee</a>
                    <span class="bookmarklet-hint">← Drag ke bookmark bar</span>
                </div>
                <div class="scrape-paste-row">
                    <button class="btn-add-task" onclick="CompetitorTracker.pasteFromClipboard()">📋 Paste Data dari Clipboard</button>
                    <button class="btn-filter" onclick="CompetitorTracker.manualPastePrompt()">✏️ Paste Manual</button>
                </div>
            </div>`;

        if (scrapeResults.length > 0) {
            const sorted = sortScrapeResults(scrapeResults);
            html += `
                <div class="scrape-result-header">
                    <h4>Hasil Scrape — ${scrapeResults.length} produk (${scrapeResults[0]?.keyword || ''})</h4>
                    <div>
                        <button class="btn-filter" onclick="CompetitorTracker.saveAllScrape()">💾 Simpan Semua ke Tracker</button>
                        <button class="btn-modal-delete" onclick="CompetitorTracker.clearScrape()">🗑 Hapus</button>
                    </div>
                </div>
                <div class="scrape-table-wrap">
                    <table class="scrape-table">
                        <thead>
                            <tr>
                                <th class="sortable-th" onclick="CompetitorTracker.toggleSort('position')">#${sortArrow('position')}</th>
                                <th>Gambar</th>
                                <th>Produk</th>
                                <th class="sortable-th" onclick="CompetitorTracker.toggleSort('price')">Harga${sortArrow('price')}</th>
                                <th class="sortable-th" onclick="CompetitorTracker.toggleSort('sold')">Terjual${sortArrow('sold')}</th>
                                <th class="sortable-th" onclick="CompetitorTracker.toggleSort('rating')">Rating${sortArrow('rating')}</th>
                                <th>Lokasi</th>
                                <th class="sortable-th" onclick="CompetitorTracker.toggleSort('ad')">Iklan${sortArrow('ad')}</th>
                                <th class="sortable-th" onclick="CompetitorTracker.toggleSort('score')">Skor${sortArrow('score')}</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>`;
            sorted.forEach((p, i) => {
                const origIdx = scrapeResults.indexOf(p);
                html += `
                    <tr class="${p.isAd ? 'scrape-ad-row' : ''}">
                        <td>${p.position || i + 1}</td>
                        <td class="scrape-img-cell">${p.image ? `<img src="${p.image}" class="scrape-thumb" onerror="this.style.display='none'" loading="lazy">` : '<div class="scrape-thumb-empty">📷</div>'}</td>
                        <td class="scrape-product-cell">
                            <div class="scrape-product-title">${escapeHtml(p.title)}</div>
                            ${p.shopName ? `<div class="scrape-shop-name">🏪 ${escapeHtml(p.shopName)}</div>` : ''}
                        </td>
                        <td class="scrape-price">${p.price || '-'}</td>
                        <td>${p.sold || '-'}</td>
                        <td>${p.rating ? '⭐ ' + p.rating : '-'}</td>
                        <td>${escapeHtml(p.location || '-')}</td>
                        <td>${p.isAd ? '<span class="ad-badge">IKLAN</span>' : '-'}</td>
                        <td class="score-cell">${(() => { const sc = calcPopularityScore(p, scrapeResults.length); const lb = scoreLabel(sc); return `<div class="score-bar-wrap"><div class="score-bar ${lb.cls}" style="width:${sc}%"></div></div><span class="score-num">${sc}</span>`; })()}</td>
                        <td><button class="btn-save-single" onclick="CompetitorTracker.saveSingleScrape(${origIdx})">+ Simpan</button></td>
                    </tr>`;
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;
    }

    function getBookmarkletCode() {
        // Bookmarklet that extracts product data from Shopee search page
        const code = `
(function(){
    try {
        var items = [];
        var keyword = '';
        try {
            var params = new URLSearchParams(window.location.search);
            keyword = params.get('keyword') || '';
        } catch(e) {}

        function getLeafs(el) {
            var r = [];
            function w(n) {
                if (n.children && n.children.length > 0) {
                    for (var i = 0; i < n.children.length; i++) w(n.children[i]);
                } else {
                    var t = n.textContent.trim();
                    if (t) r.push({ text: t, el: n });
                }
            }
            w(el);
            return r;
        }

        var cards = document.querySelectorAll('[data-sqe="item"]');
        if (!cards.length) cards = document.querySelectorAll('.shopee-search-item-result__item');
        if (!cards.length) {
            var allLinks = document.querySelectorAll('a[href*="-i."]');
            var seen = new Set();
            cards = [];
            allLinks.forEach(function(a) {
                var card = a.closest('li') || a.closest('[data-sqe="item"]') || a.parentElement.parentElement;
                if (!seen.has(a.href) && card) { seen.add(a.href); cards.push(card); }
            });
        }

        cards.forEach(function(card, idx) {
            var item = { title: '', price: '', sold: '', rating: '', location: '', shopName: '', isAd: false, url: '', image: '', position: idx + 1 };

            var nameEl = card.querySelector('[data-sqe="name"]');
            if (nameEl) item.title = nameEl.textContent.trim();
            if (!item.title) {
                var allDivs = card.querySelectorAll('div');
                for (var i = 0; i < allDivs.length; i++) {
                    var t = allDivs[i].textContent.trim();
                    if (t.length > 20 && t.length < 300 && !t.includes('Rp') && !t.includes('Terjual')) {
                        item.title = t; break;
                    }
                }
            }

            var leafs = getLeafs(card);
            for (var li = 0; li < leafs.length; li++) {
                var lt = leafs[li].text;
                if (!item.price && /^Rp\\s?[\\d.,]+$/.test(lt)) item.price = lt;
                if (!item.price && lt === 'Rp' && leafs[li].el.nextElementSibling) {
                    var nt = leafs[li].el.nextElementSibling.textContent.trim();
                    if (/^[\\d.,]+$/.test(nt)) item.price = 'Rp' + nt;
                }
                if (!item.sold && lt.includes('Terjual')) item.sold = lt;
                if (!item.sold && lt === 'Terjual' && leafs[li].el.previousElementSibling) {
                    var pt = leafs[li].el.previousElementSibling.textContent.trim();
                    if (/^\\d/.test(pt)) item.sold = pt + ' Terjual';
                }
                if (!item.rating && /^\\d\\.\\d$/.test(lt)) item.rating = lt;
                if (!item.isAd && (lt === 'Iklan' || lt === 'Ad')) item.isAd = true;
                if (!item.location && lt.length < 30 && /^(Kota|Kab\\.|Jakarta|Surabaya|Bandung|Semarang|Medan|Makassar|Tangerang|Bekasi|Depok|Bogor|Yogyakarta|Malang|Solo|Palembang|Denpasar)/i.test(lt)) item.location = lt;
            }

            var allImgs = card.querySelectorAll('img');
            for (var mi = 0; mi < allImgs.length; mi++) {
                var msrc = allImgs[mi].src || allImgs[mi].getAttribute('data-src') || '';
                if (msrc && (msrc.includes('cf.shopee') || msrc.includes('down-id.img') || (allImgs[mi].width >= 80))) {
                    item.image = msrc; break;
                }
            }

            var link = card.querySelector('a[href*="-i."]');
            if (link) item.url = link.href;
            if (item.title) items.push(item);
        });

        var result = JSON.stringify({ keyword: keyword, date: new Date().toISOString().split('T')[0], count: items.length, items: items });
        navigator.clipboard.writeText(result).then(function() {
            alert('BizManager Scraper\\n\\n✅ ' + items.length + ' produk berhasil di-copy!\\nKeyword: ' + keyword + '\\n\\nBuka BizManager > Kompetitor > tab Scrape Shopee > klik Paste Data');
        }).catch(function() {
            prompt('Copy data berikut secara manual:', result);
        });
    } catch(err) {
        alert('BizManager Scraper Error: ' + err.message);
    }
})();`;
        return 'javascript:' + encodeURIComponent(code.replace(/\n\s*/g, ' ').trim());
    }

    async function pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            processPastedData(text);
        } catch {
            showToast('Tidak bisa akses clipboard. Gunakan "Paste Manual" sebagai gantinya.', 'warning');
        }
    }

    async function manualPastePrompt() {
        const text = await AppModal.prompt('Paste data JSON dari bookmarklet di sini:', '', 'Paste Manual');
        if (text) processPastedData(text);
    }

    function processPastedData(text) {
        try {
            const data = JSON.parse(text);
            if (data.items && Array.isArray(data.items)) {
                scrapeResults = data.items.map(it => ({ ...it, keyword: data.keyword || '', scrapeDate: data.date || new Date().toISOString().split('T')[0] }));
                saveScrape();
                renderScrapeView();
                showToast(`${scrapeResults.length} produk berhasil diimport dari scrape!`, 'success');
            } else {
                showToast('Format data tidak valid. Pastikan data dari bookmarklet BizManager.', 'warning');
            }
        } catch {
            showToast('JSON tidak valid. Pastikan data di-copy dari bookmarklet.', 'error');
        }
    }

    function saveSingleScrape(index) {
        const p = scrapeResults[index];
        if (!p) return;
        addCompetitor({
            namaToko: p.shopName || p.location || 'Toko Shopee',
            produk: p.title,
            harga: parseShopeePrice(p.price),
            kataKunci: p.keyword || '',
            posisiIklan: p.isAd ? `Iklan (posisi ${index + 1})` : `Organik (posisi ${index + 1})`,
            estPenjualan: p.sold || '-',
            catatan: `Scrape ${p.scrapeDate || new Date().toISOString().split('T')[0]}`
        });
        showToast(`"${p.title.substring(0, 40)}..." disimpan ke tracker!`, 'success');
    }

    function saveAllScrape() {
        let count = 0;
        scrapeResults.forEach((p, i) => {
            addCompetitor({
                namaToko: p.shopName || p.location || 'Toko Shopee',
                produk: p.title,
                harga: parseShopeePrice(p.price),
                kataKunci: p.keyword || '',
                posisiIklan: p.isAd ? `Iklan (posisi ${i + 1})` : `Organik (posisi ${i + 1})`,
                estPenjualan: p.sold || '-',
                catatan: `Scrape ${p.scrapeDate || new Date().toISOString().split('T')[0]}`
            });
            count++;
        });
        showToast(`${count} kompetitor disimpan ke tracker!`, 'success');
        switchTab('manual');
    }

    async function clearScrape() {
        const ok = await AppModal.confirm('Hapus semua hasil scrape?', 'Hapus Scrape', 'danger');
        if (!ok) return;
        scrapeResults = [];
        saveScrape();
        renderScrapeView();
        showToast('Hasil scrape dihapus', 'success');
    }

    function parseShopeePrice(priceStr) {
        if (!priceStr) return 0;
        return parseInt(priceStr.replace(/[^\d]/g, '')) || 0;
    }

    // ========================================
    // TAB 3: SELLER CENTER IMPORT
    // ========================================
    function renderImportView() {
        const container = document.getElementById('compImportContent');
        container.innerHTML = `
            <div class="scrape-instruction">
                <h4>📊 Import dari Shopee Seller Center</h4>
                <p>Fitur ini menerima data export dari <strong>Shopee Seller Center > Bisnis Saya > Analisis Pasar</strong>.</p>
                <ol>
                    <li>Login ke <a href="https://seller.shopee.co.id/" target="_blank">Shopee Seller Center</a></li>
                    <li>Buka menu <strong>Bisnis Saya → Analisis Pasar</strong> atau <strong>Analisis Kompetitor</strong></li>
                    <li>Pilih kategori produk yang kamu jual</li>
                    <li>Download / Export data sebagai Excel</li>
                    <li>Upload file Excel ke sini</li>
                </ol>
                <div class="import-drop-zone" id="compImportDropZone">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p>Drop file Excel di sini<br><small>atau klik untuk pilih file</small></p>
                    <input type="file" id="compImportFile" accept=".xlsx,.xls,.csv" class="hidden">
                </div>
                <div id="compImportResult"></div>
            </div>`;

        // Setup file input
        const dropZone = document.getElementById('compImportDropZone');
        const fileInput = document.getElementById('compImportFile');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) processSellerCenterFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) processSellerCenterFile(e.target.files[0]);
            e.target.value = ''; // fix: allow re-upload same file
        });
    }

    function processSellerCenterFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                showToast(`File "${file.name}" dibaca. ${workbook.SheetNames.length} sheet ditemukan.`, 'success');

                // Try to parse the data — Seller Center can have various formats
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);

                if (rows.length === 0) {
                    showToast('File kosong!', 'warning');
                    return;
                }

                // Detect columns — normalize column names
                const firstRow = rows[0];
                const colKeys = Object.keys(firstRow);

                // Map common Shopee Seller Center column names
                const colMap = detectColumns(colKeys);

                const resultDiv = document.getElementById('compImportResult');
                let imported = [];

                rows.forEach((row, i) => {
                    const item = {
                        namaToko: getVal(row, colMap.shop) || 'Toko Shopee',
                        produk: getVal(row, colMap.product) || `Produk ${i + 1}`,
                        harga: parseFloat(getVal(row, colMap.price)) || 0,
                        estPenjualan: getVal(row, colMap.sold) || '-',
                        kataKunci: getVal(row, colMap.keyword) || '',
                        posisiIklan: getVal(row, colMap.position) || '-',
                        catatan: `Import Seller Center ${new Date().toISOString().split('T')[0]}`
                    };
                    imported.push(item);
                });

                // Show preview
                let html = `<h4 style="margin-top:16px;">📋 Preview: ${imported.length} produk</h4>`;
                html += `<p style="font-size:12px;color:var(--text-muted);">Kolom terdeteksi: ${Object.entries(colMap).filter(([k, v]) => v).map(([k, v]) => `${k}→"${v}"`).join(', ') || 'Auto-detect'}</p>`;
                html += '<div class="scrape-table-wrap"><table class="scrape-table"><thead><tr><th>#</th><th>Toko</th><th>Produk</th><th>Harga</th><th>Terjual</th></tr></thead><tbody>';
                imported.slice(0, 20).forEach((item, i) => {
                    html += `<tr><td>${i + 1}</td><td>${escapeHtml(item.namaToko)}</td><td>${escapeHtml(item.produk)}</td><td>${formatRp(item.harga)}</td><td>${escapeHtml(item.estPenjualan)}</td></tr>`;
                });
                if (imported.length > 20) html += `<tr><td colspan="5" style="text-align:center">... dan ${imported.length - 20} produk lainnya</td></tr>`;
                html += '</tbody></table></div>';
                html += `<div style="margin-top:12px;display:flex;gap:8px;">
                    <button class="btn-add-task" id="btnImportAllSC">💾 Simpan Semua (${imported.length})</button>
                    <button class="btn-modal-cancel" id="btnCancelSC">Batal</button>
                </div>`;

                resultDiv.innerHTML = html;

                document.getElementById('btnImportAllSC').addEventListener('click', () => {
                    imported.forEach(item => addCompetitor(item));
                    showToast(`${imported.length} kompetitor berhasil diimport!`, 'success');
                    switchTab('manual');
                });
                document.getElementById('btnCancelSC').addEventListener('click', () => {
                    resultDiv.innerHTML = '';
                });

            } catch (err) {
                showToast('Error membaca file: ' + err.message, 'error');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function detectColumns(colKeys) {
        const map = { shop: null, product: null, price: null, sold: null, keyword: null, position: null };
        const lower = colKeys.map(k => ({ orig: k, low: k.toLowerCase() }));

        lower.forEach(({ orig, low }) => {
            if (!map.shop && (low.includes('toko') || low.includes('shop') || low.includes('seller'))) map.shop = orig;
            if (!map.product && (low.includes('produk') || low.includes('product') || low.includes('nama') || low.includes('judul') || low.includes('title'))) map.product = orig;
            if (!map.price && (low.includes('harga') || low.includes('price'))) map.price = orig;
            if (!map.sold && (low.includes('terjual') || low.includes('sold') || low.includes('penjualan') || low.includes('sales'))) map.sold = orig;
            if (!map.keyword && (low.includes('keyword') || low.includes('kata kunci'))) map.keyword = orig;
            if (!map.position && (low.includes('posisi') || low.includes('position') || low.includes('rank'))) map.position = orig;
        });

        // Fallback: if no product column found, use the first text-like column
        if (!map.product && colKeys.length > 0) map.product = colKeys[0];

        return map;
    }

    function getVal(row, key) {
        if (!key) return '';
        return row[key] != null ? String(row[key]).trim() : '';
    }

    // ---- HISTORY MODAL ----
    function showHistory(id) {
        const c = competitors.find(x => x.id === id);
        if (!c || !c.history || c.history.length === 0) { showToast('Belum ada riwayat perubahan', 'info'); return; }

        let html = '<div class="history-timeline">';
        c.history.slice().reverse().forEach((h, i) => {
            html += `
                <div class="history-item ${i === 0 ? 'latest' : ''}">
                    <div class="history-date">${h.date}</div>
                    <div class="history-data">
                        <span>Harga: ${formatRp(h.harga || 0)}</span>
                        <span>Posisi: ${h.posisiIklan || '-'}</span>
                        <span>Penjualan: ${h.estPenjualan || '-'}</span>
                    </div>
                    ${h.catatan ? `<div class="history-note">${escapeHtml(h.catatan)}</div>` : ''}
                </div>`;
        });
        html += '</div>';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal" style="max-width:500px;">
            <div class="modal-header"><h3>📊 Riwayat: ${escapeHtml(c.namaToko)}</h3><button class="modal-close" id="histClose">✕</button></div>
            <div class="modal-body">${html}</div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#histClose').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    // ---- MODAL ----
    function openAddModal() {
        editingId = null;
        document.getElementById('competitorModalTitle').textContent = 'Tambah Kompetitor';
        document.getElementById('competitorNamaToko').value = '';
        document.getElementById('competitorProduk').value = '';
        document.getElementById('competitorHarga').value = '';
        document.getElementById('competitorKataKunci').value = '';
        document.getElementById('competitorPosisiIklan').value = '';
        document.getElementById('competitorEstPenjualan').value = '';
        document.getElementById('competitorCatatan').value = '';
        document.getElementById('competitorDeleteBtn').classList.add('hidden');
        document.getElementById('competitorModalOverlay').classList.remove('hidden');
    }

    function openEditModal(id) {
        const c = competitors.find(x => x.id === id);
        if (!c) return;
        editingId = id;
        document.getElementById('competitorModalTitle').textContent = 'Update Kompetitor';
        document.getElementById('competitorNamaToko').value = c.namaToko || '';
        document.getElementById('competitorProduk').value = c.produk || '';
        document.getElementById('competitorHarga').value = c.harga ? c.harga.toLocaleString('id-ID') : '';
        document.getElementById('competitorKataKunci').value = c.kataKunci || '';
        document.getElementById('competitorPosisiIklan').value = c.posisiIklan || '';
        document.getElementById('competitorEstPenjualan').value = c.estPenjualan || '';
        document.getElementById('competitorCatatan').value = '';
        document.getElementById('competitorDeleteBtn').classList.remove('hidden');
        document.getElementById('competitorModalOverlay').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('competitorModalOverlay').classList.add('hidden');
        editingId = null;
    }

    function saveModal() {
        const namaToko = document.getElementById('competitorNamaToko').value.trim();
        if (!namaToko) { showToast('Nama toko harus diisi', 'warning'); return; }
        const data = {
            namaToko,
            produk: document.getElementById('competitorProduk').value.trim(),
            harga: ProfitCalculator.parseRupiah(document.getElementById('competitorHarga').value),
            kataKunci: document.getElementById('competitorKataKunci').value.trim(),
            posisiIklan: document.getElementById('competitorPosisiIklan').value.trim(),
            estPenjualan: document.getElementById('competitorEstPenjualan').value.trim(),
            catatan: document.getElementById('competitorCatatan').value.trim()
        };
        if (editingId) { updateCompetitor(editingId, data); showToast('Kompetitor diupdate!', 'success'); }
        else { addCompetitor(data); showToast('Kompetitor ditambahkan!', 'success'); }
        closeModal();
        renderManualList();
    }

    async function deleteFromModal() {
        if (!editingId) return;
        const ok = await AppModal.confirm('Hapus kompetitor ini?', 'Hapus Kompetitor', 'danger');
        if (!ok) return;
        deleteCompetitor(editingId);
        closeModal();
        renderManualList();
        showToast('Kompetitor dihapus', 'success');
    }

    // ---- RENDER MAIN ----
    function renderList() {
        if (activeTab === 'manual') renderManualList();
        else if (activeTab === 'scrape') renderScrapeView();
        else renderImportView();
    }

    // ---- INIT ----
    async function init() {
        await load();

        const addBtn = document.getElementById('btnAddCompetitor');
        if (addBtn) addBtn.addEventListener('click', openAddModal);

        // Tab buttons
        document.querySelectorAll('.comp-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Modal
        const overlay = document.getElementById('competitorModalOverlay');
        if (overlay) {
            document.getElementById('competitorModalClose').addEventListener('click', closeModal);
            document.getElementById('competitorCancelBtn').addEventListener('click', closeModal);
            document.getElementById('competitorSaveBtn').addEventListener('click', saveModal);
            document.getElementById('competitorDeleteBtn').addEventListener('click', deleteFromModal);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        }

        const hargaEl = document.getElementById('competitorHarga');
        if (hargaEl) ProfitCalculator.setupRupiahInput(hargaEl);

        renderManualList();
    }

    return { init, renderList, openEditModal, showHistory, pasteFromClipboard, manualPastePrompt, saveSingleScrape, saveAllScrape, clearScrape, toggleSort };
})();
