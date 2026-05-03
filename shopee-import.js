// ========================================
// SHOPEE IMPORT MODULE
// Parses Shopee "Laporan Penghasilan" Excel
// ========================================

const ShopeeImport = (() => {
    let importedOrders = [];
    let currentShop = null;

    // Column mapping for Shopee Income Report (Sheet 2 "Income", header at row 6, 0-indexed)
    const COL = {
        NO: 0,
        NO_PESANAN: 1,
        NO_PENGAJUAN: 2,
        USERNAME_PEMBELI: 3,
        WAKTU_PESANAN: 4,
        METODE_BAYAR: 5,
        TGL_DANA_DILEPAS: 6,
        HARGA_ASLI_PRODUK: 7,
        TOTAL_DISKON_PRODUK: 8,
        PENGEMBALIAN_DANA: 9,
        DISKON_DARI_SHOPEE: 10,
        VOUCHER_SELLER: 11,
        VOUCHER_COFUND: 12,
        CASHBACK_SELLER: 13,
        CASHBACK_COFUND: 14,
        ONGKIR_DIBAYAR_PEMBELI: 15,
        DISKON_ONGKIR_JASA_KIRIM: 16,
        GRATIS_ONGKIR_SHOPEE: 17,
        ONGKIR_KE_JASA_KIRIM: 18,
        ONGKIR_RETURN: 19,
        KEMBALI_ONGKIR: 20,
        PENGEMBALIAN_ONGKIR: 21,
        BIAYA_KOMISI_AMS: 22,
        BIAYA_ADMIN: 23,
        BIAYA_LAYANAN: 24,
        BIAYA_PROSES: 25,
        PREMI: 26,
        BIAYA_HEMAT_ONGKIR: 27,
        BIAYA_TRANSAKSI: 28,
        BIAYA_KAMPANYE: 29,
        BEA_MASUK_PPN: 30,
        BIAYA_ISI_SALDO: 31,
        TOTAL_PENGHASILAN: 32,
        KODE_VOUCHER: 33,
        KOMPENSASI: 34,
        PROMO_GRATIS_ONGKIR_SELLER: 35,
        JASA_KIRIM: 36,
        NAMA_KURIR: 37
    };

    function parseNum(val) {
        if (val === null || val === undefined || val === '' || val === '-') return 0;
        if (typeof val === 'number') return val;
        return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
    }

    const STORE_KEY_PRODUCTS = 'bizmanager_products';

    async function parseExcel(workbook) {
        const sheetNames = workbook.SheetNames;
        // Find Income sheet (sheet 2, or by name)
        let incomeSheet = null;
        let productSheet = null;

        for (let i = 0; i < sheetNames.length; i++) {
            const name = sheetNames[i].toLowerCase();
            if (name.includes('income') || name.includes('penghasilan')) {
                incomeSheet = workbook.Sheets[workbook.SheetNames[i]];
            }
            if (name.includes('order processing') || name.includes('biaya proses')) {
                productSheet = workbook.Sheets[workbook.SheetNames[i]];
            }
        }

        // Fallback: try sheet index 1 (second sheet)
        if (!incomeSheet && workbook.SheetNames.length >= 2) {
            incomeSheet = workbook.Sheets[workbook.SheetNames[1]];
        }

        if (!incomeSheet) {
            throw new Error('Sheet "Income" tidak ditemukan dalam file Excel');
        }

        function fixSheetRef(sheet) {
            if (!sheet) return;
            let maxRow = 0; let maxCol = 0;
            Object.keys(sheet).forEach(k => {
                if (k[0] === '!') return;
                const coord = XLSX.utils.decode_cell(k);
                if (coord.r > maxRow) maxRow = coord.r;
                if (coord.c > maxCol) maxCol = coord.c;
            });
            sheet['!ref'] = XLSX.utils.encode_range({s: {r:0, c:0}, e: {r:maxRow, c:maxCol}});
        }

        // Parse income sheet to JSON (all rows)
        fixSheetRef(incomeSheet);
        const incomeData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1, defval: '' });

        // Find header row (look for "No. Pesanan" or "No.")
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(20, incomeData.length); r++) {
            const row = incomeData[r];
            if (row && row[0] === 'No.' && row[1] && String(row[1]).includes('Pesanan')) {
                headerRowIdx = r;
                break;
            }
        }

        if (headerRowIdx === -1) {
            throw new Error('Header "No. Pesanan" tidak ditemukan. Pastikan ini file Laporan Penghasilan Shopee.');
        }

        // Parse product details from Sheet 4 (Order Processing Fee)
        // Typical format: col[0]=type, col[1]="Sku", col[2]=orderID, col[3]=?,
        //                 col[4]=productName, col[5]=variasi, col[6]=SKU, col[7]=qty, col[8]=price
        const productMap = {};
        if (productSheet) {
            fixSheetRef(productSheet);
            const productData = XLSX.utils.sheet_to_json(productSheet, { header: 1, defval: '' });

            // Find header row to detect column positions dynamically
            let pHeaderIdx = -1;
            let pColMap = { orderId: 2, productId: -1, name: 4, variation: 5, sku: 6, qty: 7, price: 8 };

            for (let r = 0; r < Math.min(10, productData.length); r++) {
                const row = productData[r];
                if (!row) continue;
                const joined = (row || []).join(' ').toLowerCase();
                if (joined.includes('no. pesanan') || joined.includes('order')) {
                    pHeaderIdx = r;
                    // Try to find columns dynamically with strict checks
                    row.forEach((cell, idx) => {
                        const c = String(cell).toLowerCase().trim();
                        if (c === 'no. pesanan' || c === 'order id') pColMap.orderId = idx;
                        else if (c === 'id produk' || c === 'product id') pColMap.productId = idx;
                        else if (c === 'nama produk' || c === 'product name') pColMap.name = idx;
                        else if (c === 'nama variasi' || c === 'variasi' || c === 'variasi produk' || c === 'variation name' || c === 'variation') pColMap.variation = idx;
                        else if (c === 'sku' || c === 'nomor referensi sku' || c === 'sku reference') pColMap.sku = idx;
                        else if (c === 'jumlah' || c === 'quantity' || c === 'qty') pColMap.qty = idx;
                        else if (c === 'harga awal' || c === 'original price' || c === 'harga' || c === 'price') pColMap.price = idx;
                    });
                    break;
                }
            }

            for (let r = (pHeaderIdx >= 0 ? pHeaderIdx + 1 : 1); r < productData.length; r++) {
                const row = productData[r];
                if (!row) continue;

                // Support both old format (row[1]==='Sku') and dynamic header format
                const isSkuRow = row[1] === 'Sku' || (pHeaderIdx >= 0 && String(row[pColMap.orderId] || '').trim().length > 5);

                if (isSkuRow) {
                    const orderId = pHeaderIdx >= 0 
                        ? String(row[pColMap.orderId] || '').trim()
                        : String(row[2] || '').trim();
                    const productId = pColMap.productId >= 0
                        ? String(row[pColMap.productId] || '').trim()
                        : String(row[3] || '').trim();
                    const productName = pHeaderIdx >= 0
                        ? String(row[pColMap.name] || '').trim()
                        : String(row[4] || '').trim();
                    const variation = pHeaderIdx >= 0
                        ? String(row[pColMap.variation] || '').trim()
                        : String(row[5] || '').trim();
                    const sku = pHeaderIdx >= 0
                        ? String(row[pColMap.sku] || '').trim()
                        : String(row[6] || '').trim();
                    const qty = pHeaderIdx >= 0
                        ? parseInt(row[pColMap.qty]) || 1
                        : parseInt(row[7]) || 1;
                    const price = pHeaderIdx >= 0
                        ? parseNum(row[pColMap.price])
                        : parseNum(row[8]);

                    // Skip Shopee fee breakdown rows which often appear in the product sheet with negative prices
                    if (orderId && productName && productName !== '-' && price >= 0) {
                        if (!productMap[orderId]) productMap[orderId] = [];
                        productMap[orderId].push({
                            productId: productId,
                            name: productName,
                            variation: variation || '',
                            sku: sku || '',
                            qty: qty,
                            price: price
                        });
                    }
                }
            }
        }

        // Read products directly from localStorage (in-memory array sometimes loses modal values)
        let storedProducts = [];
        try {
            const rawLS = await StorageManager.getItem('bizmanager_products');
            storedProducts = rawLS ? JSON.parse(rawLS) : [];
            const withModal = storedProducts.filter(p => (p.variations||[]).some(v => (v.modal||0) > 0));
            console.log(`📋 Loaded ${storedProducts.length} products from localStorage, ${withModal.length} with modal > 0`);
        } catch(e) {
            console.error('Error reading products:', e);
        }
        function findModal(productName, hargaAsli, variationName, sku, productId) {
            // Priority 0: Exact Product ID Match (from Shopee Mass Update Kode Produk)
            if (productId) {
                const match = storedProducts.find(p => String(p.shopeeId) === productId || String(p.productId) === productId || String(p.id) === productId);
                if (match) {
                    // Try to match specific variation first
                    if (variationName && variationName !== '-') {
                        const v = (match.variations||[]).find(v => String(v.name).trim().toLowerCase() === String(variationName).trim().toLowerCase());
                        if (v) return { modal: v.modal || 0, variationName: v.name, isMapped: true };
                    }
                    
                    // Fallback to base product modal
                    let fallbackModal = match.modal || 0;
                    if (!fallbackModal && match.variations && match.variations.length > 0) {
                        const nonzero = match.variations.filter(x => (x.modal || 0) > 0);
                        fallbackModal = nonzero.length > 0 ? nonzero[0].modal : 0;
                    }
                    
                    return { modal: fallbackModal, variationName: match.name, isMapped: true };
                }
            }

            // Priority 1: Exact SKU Match
            if (sku) {
                for (const p of storedProducts) {
                    for (const v of (p.variations || [])) {
                        if (v.sku && String(v.sku).toLowerCase() === String(sku).toLowerCase()) {
                            return { modal: v.modal || 0, variationName: v.name, isMapped: true };
                        }
                    }
                }
            }

            // Priority 2: Exact Name Match
            const eName = (productName || '').toLowerCase().trim();
            const eVar = (variationName || '').toLowerCase().trim();

            for (const p of storedProducts) {
                if (p.name.toLowerCase().trim() === eName || 
                    (p.name + ' - ' + p.variations[0]?.name).toLowerCase().trim() === eName) {
                    
                    const vars = p.variations || [];
                    if (vars.length === 0) return { modal: p.modal || 0, variationName: p.name, isMapped: true };

                    if (eVar && eVar !== '-') {
                        const exactVar = vars.find(v => v.name && v.name.toLowerCase().trim() === eVar);
                        if (exactVar) return { modal: exactVar.modal || 0, variationName: exactVar.name, isMapped: true };
                    }

                    if (vars.length === 1) return { modal: vars[0].modal || 0, variationName: vars[0].name, isMapped: true };
                    return { modal: p.modal || 0, variationName: p.name, isMapped: true };
                }
            }

            // Priority 3: Alias Dictionary Match
            if (typeof AliasManager !== 'undefined') {
                const aliasMatch = AliasManager.resolveViaAlias(productName, variationName);
                if (aliasMatch) return aliasMatch;
            }

            // Unmapped
            return { modal: null, variationName: null, isMapped: false };
        }

        // Parse data rows
        const orders = [];
        for (let r = headerRowIdx + 1; r < incomeData.length; r++) {
            const row = incomeData[r];
            if (!row || !row[COL.NO] || row[COL.NO] === '') continue;
            // Skip non-numeric No. column (like totals)
            if (isNaN(parseInt(row[COL.NO]))) continue;

            const noPesanan = String(row[COL.NO_PESANAN] || '').trim();
            const hargaAsli = parseNum(row[COL.HARGA_ASLI_PRODUK]);
            const diskonProduk = parseNum(row[COL.TOTAL_DISKON_PRODUK]);
            const ongkirPembeli = parseNum(row[COL.ONGKIR_DIBAYAR_PEMBELI]);
            const gratisOngkir = parseNum(row[COL.GRATIS_ONGKIR_SHOPEE]);
            const ongkirKeJasaKirim = parseNum(row[COL.ONGKIR_KE_JASA_KIRIM]);
            const biayaAdmin = parseNum(row[COL.BIAYA_ADMIN]);
            const biayaLayanan = parseNum(row[COL.BIAYA_LAYANAN]);
            const biayaProses = parseNum(row[COL.BIAYA_PROSES]);
            const biayaHemat = parseNum(row[COL.BIAYA_HEMAT_ONGKIR]);
            const biayaTransaksi = parseNum(row[COL.BIAYA_TRANSAKSI]);
            const biayaKampanye = parseNum(row[COL.BIAYA_KAMPANYE]);
            const premi = parseNum(row[COL.PREMI]);
            const beaMasuk = parseNum(row[COL.BEA_MASUK_PPN]);
            const totalPenghasilan = parseNum(row[COL.TOTAL_PENGHASILAN]);
            const pengembalianDana = parseNum(row[COL.PENGEMBALIAN_DANA]);
            const kompensasi = parseNum(row[COL.KOMPENSASI]);
            const voucherSeller = parseNum(row[COL.VOUCHER_SELLER]);
            const voucherCofund = parseNum(row[COL.VOUCHER_COFUND]);

            // Skip refund-only rows (no revenue)
            if (hargaAsli === 0 && totalPenghasilan <= 0) continue;

            const totalPotongan = biayaAdmin + biayaLayanan + biayaProses + biayaHemat + biayaTransaksi + biayaKampanye + premi + beaMasuk;

            // Get product details from Sheet 4
            const orderProducts = productMap[noPesanan] || [];
            let productName = 'Pesanan Shopee';
            let variationDisplay = '-';
            let totalModal = 0;
            let modalMatched = false;
            let modalFuzzy = false;

            if (orderProducts.length > 0) {
                productName = orderProducts.map(p => p.name).filter((v, i, a) => a.indexOf(v) === i).join(' + ');
                if (productName.length > 80) productName = productName.substring(0, 77) + '...';

                const varParts = [];
                const perItemHarga = orderProducts.length > 1 ? Math.round(hargaAsli / orderProducts.length) : hargaAsli;
                
                let orderFullyMapped = true;
                orderProducts.forEach(op => {
                    const priceToMatch = (op.price > 0) ? op.price : perItemHarga;
                    const result = findModal(op.name, priceToMatch, op.variation, op.sku, op.productId);
                    
                    if (result.variationName) varParts.push(result.variationName);
                    else if (op.variation) varParts.push(op.variation);
                    
                    if (result.isMapped) {
                        totalModal += result.modal * op.qty;
                    } else {
                        orderFullyMapped = false;
                        op.needsMapping = true;
                    }
                });
                modalMatched = orderFullyMapped;
                variationDisplay = varParts.length > 0 ? varParts.join(', ') : '-';
            } else {
                // No Sheet 4 data — CANNOT MAP by name. We just flag it as unmapped.
                modalMatched = false;
                orderProducts.push({
                    name: "Tidak Ada Rincian (Butuh File Sheet 4)",
                    variation: "-",
                    price: hargaAsli,
                    qty: 1,
                    needsMapping: true,
                    unmappable: true // Cannot even be mapped via Alias because no name
                });
            }

            const profitBersih = modalMatched ? totalPenghasilan - totalModal : null;

            orders.push({
                no: parseInt(row[COL.NO]),
                noPesanan,
                pembeli: String(row[COL.USERNAME_PEMBELI] || '').trim(),
                tanggalPesanan: String(row[COL.WAKTU_PESANAN] || '').trim(),
                metodeBayar: String(row[COL.METODE_BAYAR] || '').trim(),
                tanggalDanaLepas: String(row[COL.TGL_DANA_DILEPAS] || '').trim(),
                product: productName,
                variation: variationDisplay,
                hargaAsli,
                diskonProduk,
                pengembalianDana,
                voucherSeller,
                voucherCofund,
                ongkirPembeli,
                gratisOngkir,
                ongkirKeJasaKirim,
                biayaAdmin,
                biayaLayanan,
                biayaProses,
                biayaHemat,
                biayaTransaksi,
                biayaKampanye,
                premi,
                beaMasuk,
                totalPotongan,
                totalPenghasilan,
                kompensasi,
                totalModal: modalMatched ? totalModal : null,
                profitBersih,
                modalMatched,
                orderProducts,
                jasaKirim: String(row[COL.JASA_KIRIM] || '').trim(),
                namaKurir: String(row[COL.NAMA_KURIR] || '').trim()
            });
        }

        return orders;
    }

    function calculateSummary(orders) {
        const totalHargaAsli = orders.reduce((s, o) => s + o.hargaAsli, 0);
        const totalPenghasilan = orders.reduce((s, o) => s + o.totalPenghasilan, 0);
        const totalPotongan = orders.reduce((s, o) => s + o.totalPotongan, 0);
        const totalBiayaAdmin = orders.reduce((s, o) => s + o.biayaAdmin, 0);
        const totalBiayaLayanan = orders.reduce((s, o) => s + o.biayaLayanan, 0);
        const totalBiayaProses = orders.reduce((s, o) => s + o.biayaProses, 0);
        const totalOngkirShopee = orders.reduce((s, o) => s + o.gratisOngkir, 0);

        // Modal & profit
        const matchedOrders = orders.filter(o => o.modalMatched);
        const totalModal = matchedOrders.reduce((s, o) => s + (o.totalModal || 0), 0);
        const totalProfitBersih = matchedOrders.reduce((s, o) => s + (o.profitBersih || 0), 0);
        const unmatchedCount = orders.length - matchedOrders.length;

        return {
            count: orders.length,
            totalHargaAsli,
            totalPenghasilan,
            totalPotongan,
            totalBiayaAdmin,
            totalBiayaLayanan,
            totalBiayaProses,
            totalOngkirShopee,
            totalModal,
            totalProfitBersih,
            matchedCount: matchedOrders.length,
            unmatchedCount,
            potonganPercent: totalHargaAsli > 0 ? (Math.abs(totalPotongan) / totalHargaAsli * 100) : 0
        };
    }

    function formatRp(num) {
        return ProfitCalculator.formatRupiah(num);
    }



    // ---- RENDER ----
    function renderImportResults(orders) {
        importedOrders = orders;
        const container = document.getElementById('shopeeImportResults');
        const summary = calculateSummary(orders);

        if (orders.length === 0) {
            container.innerHTML = '<p class="empty-state">Tidak ada data order yang valid dalam file.</p>';
            return;
        }

        // Get date range
        const dates = orders.map(o => o.tanggalPesanan).filter(d => d).sort();
        const dateFrom = dates[0] || '-';
        const dateTo = dates[dates.length - 1] || '-';

        // Check for unmapped products
        const unmappedItems = [];
        orders.forEach(o => {
            if (o.orderProducts) {
                o.orderProducts.forEach(op => {
                    if (op.needsMapping) unmappedItems.push({ name: op.name, variation: op.variation, price: op.price, unmappable: op.unmappable });
                });
            }
        });

        let html = '';

        if (unmappedItems.length > 0) {
            const mappableCount = unmappedItems.filter(i => !i.unmappable).length;
            if (mappableCount > 0) {
                html += `
                    <div style="background:rgba(255,193,7,0.1);border:1px solid var(--yellow);padding:12px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                        <div style="color:var(--yellow);font-size:13px;">
                            ⚠️ Terdapat <strong>${mappableCount} produk/variasi</strong> dari file ini yang tidak dikenali sistem.
                        </div>
                        <button onclick="ShopeeImport.openMappingDialog()" style="background:var(--yellow);color:#000;border:none;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;">🔗 Petakan Produk</button>
                    </div>
                `;
            } else {
                html += `
                    <div style="background:rgba(255,193,7,0.1);border:1px solid var(--yellow);padding:12px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                        <div style="color:var(--yellow);font-size:13px;">
                            ⚠️ ${unmappedItems.length} pesanan tidak memiliki rincian nama produk (Sheet 4 tidak ada). Modal tidak dapat dipetakan secara otomatis.
                        </div>
                    </div>
                `;
            }
        }

        // Summary cards
        html += `
            <div class="shopee-import-header" style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3 style="margin:0 0 4px;font-size:16px;">📊 Hasil Import — ${ShopManager.getShops().find(s => s.id === currentShop)?.name || 'Shopee'}</h3>
                    <span class="import-date-range">${dateFrom} s/d ${dateTo}</span>
                </div>
                <button onclick="ProfitLog.saveFromShopeeImport(ShopeeImport.getOrders(), ShopeeImport.getCurrentShopId())" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">💾 Simpan ke Profit Log</button>
            </div>
            <div class="import-summary-grid">
                <div class="import-summary-card">
                    <span class="import-summary-label">Total Pesanan</span>
                    <span class="import-summary-value">${summary.count}</span>
                </div>
                <div class="import-summary-card">
                    <span class="import-summary-label">Harga Asli Produk</span>
                    <span class="import-summary-value">${formatRp(summary.totalHargaAsli)}</span>
                </div>
                <div class="import-summary-card highlight-green">
                    <span class="import-summary-label">Total Penghasilan</span>
                    <span class="import-summary-value">${formatRp(summary.totalPenghasilan)}</span>
                </div>
                <div class="import-summary-card highlight-red">
                    <span class="import-summary-label">Total Potongan Shopee</span>
                    <span class="import-summary-value">${formatRp(summary.totalPotongan)}</span>
                    <span class="import-summary-sub">${summary.potonganPercent.toFixed(1)}% dari harga asli</span>
                </div>
            </div>

            <div class="import-summary-grid" style="margin-top:12px;">
                <div class="import-summary-card" style="border-left:3px solid var(--yellow);">
                    <span class="import-summary-label">💰 Total Modal</span>
                    <span class="import-summary-value">${summary.matchedCount > 0 ? formatRp(summary.totalModal) : '<span style="font-size:13px;color:var(--text-muted);">Belum ada data</span>'}</span>
                    ${summary.unmatchedCount > 0 ? `<span class="import-summary-sub">${summary.unmatchedCount} pesanan belum ada data modal</span>` : ''}
                </div>
                <div class="import-summary-card" style="border-left:3px solid ${summary.totalProfitBersih >= 0 ? 'var(--green)' : 'var(--red)'};">
                    <span class="import-summary-label">🎯 Profit Bersih</span>
                    <span class="import-summary-value ${summary.totalProfitBersih >= 0 ? 'profit-positive' : 'profit-negative'}">${summary.matchedCount > 0 ? formatRp(summary.totalProfitBersih) : '<span style="font-size:13px;color:var(--text-muted);">Belum ada data</span>'}</span>
                    ${summary.matchedCount > 0 ? `<span class="import-summary-sub">Penghasilan − Modal (${summary.matchedCount} pesanan)</span>` : '<span class="import-summary-sub">Import produk & set harga modal dulu</span>'}
                </div>
            </div>

            <div class="import-breakdown-grid">
                <div class="import-breakdown-item">
                    <span>Biaya Administrasi</span>
                    <span class="negative">${formatRp(summary.totalBiayaAdmin)}</span>
                </div>
                <div class="import-breakdown-item">
                    <span>Biaya Layanan (Gratis Ongkir + Promo)</span>
                    <span class="negative">${formatRp(summary.totalBiayaLayanan)}</span>
                </div>
                <div class="import-breakdown-item">
                    <span>Biaya Proses Pesanan</span>
                    <span class="negative">${formatRp(summary.totalBiayaProses)}</span>
                </div>
                <div class="import-breakdown-item">
                    <span>Gratis Ongkir dari Shopee</span>
                    <span class="positive">${formatRp(summary.totalOngkirShopee)}</span>
                </div>
            </div>
        `;

        // ---- DATE GROUPING TABS ----
        const dateMap = {};
        orders.forEach(o => {
            const d = o.tanggalPesanan ? o.tanggalPesanan.substring(0, 10) : '-';
            if (!dateMap[d]) dateMap[d] = { count: 0, harga: 0, penghasilan: 0, potongan: 0, modal: 0, profit: 0, matched: 0, fuzzy: false, orders: [] };
            dateMap[d].count++;
            dateMap[d].harga += o.hargaAsli;
            dateMap[d].penghasilan += o.totalPenghasilan;
            dateMap[d].potongan += o.totalPotongan;
            if (o.modalMatched) {
                dateMap[d].modal += o.totalModal || 0;
                dateMap[d].profit += o.profitBersih || 0;
                dateMap[d].matched++;
                if (o.modalFuzzy) dateMap[d].fuzzy = true;
            }
            dateMap[d].orders.push(o);
        });
        const dateSorted = Object.entries(dateMap).sort((a, b) => a[0].localeCompare(b[0]));

        // Monthly
        const monthMap = {};
        dateSorted.forEach(([date, d]) => {
            const m = date.substring(0, 7);
            if (!monthMap[m]) monthMap[m] = { count: 0, harga: 0, penghasilan: 0, potongan: 0, modal: 0, profit: 0, matched: 0, days: 0 };
            monthMap[m].count += d.count;
            monthMap[m].harga += d.harga;
            monthMap[m].penghasilan += d.penghasilan;
            monthMap[m].potongan += d.potongan;
            monthMap[m].modal += d.modal;
            monthMap[m].profit += d.profit;
            monthMap[m].matched += d.matched;
            monthMap[m].days++;
        });
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        // Yearly
        const yearMap = {};
        dateSorted.forEach(([date, d]) => {
            const y = date.substring(0, 4);
            if (!yearMap[y]) yearMap[y] = { count: 0, harga: 0, penghasilan: 0, potongan: 0, modal: 0, profit: 0, matched: 0, months: new Set() };
            yearMap[y].count += d.count;
            yearMap[y].harga += d.harga;
            yearMap[y].penghasilan += d.penghasilan;
            yearMap[y].potongan += d.potongan;
            yearMap[y].modal += d.modal;
            yearMap[y].profit += d.profit;
            yearMap[y].matched += d.matched;
            yearMap[y].months.add(date.substring(0, 7));
        });

        // Tab buttons
        html += `
            <div style="display:flex;gap:4px;margin-top:16px;border-bottom:1px solid rgba(0, 0, 0, 0.08);">
                <button class="si-tab-btn" data-tab="all" onclick="ShopeeImport.switchTab('all')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text);cursor:pointer;border-bottom:2px solid var(--blue);margin-bottom:-1px;">📋 Semua</button>
                <button class="si-tab-btn" data-tab="daily" onclick="ShopeeImport.switchTab('daily')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">📅 Harian</button>
                <button class="si-tab-btn" data-tab="monthly" onclick="ShopeeImport.switchTab('monthly')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">📆 Bulanan</button>
                <button class="si-tab-btn" data-tab="yearly" onclick="ShopeeImport.switchTab('yearly')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">📊 Tahunan</button>
            </div>
        `;

        // ---- TAB: Harian ----
        html += `<div id="siTab-daily" class="si-tab-content hidden">
            <div class="card table-card" style="margin-top:0;border-radius:0 0 8px 8px;"><div class="table-wrapper"><table class="order-table">
                <thead><tr><th>Tanggal</th><th>Order</th><th>Harga Asli</th><th>Potongan</th><th>Penghasilan</th><th>Modal</th><th>Profit</th></tr></thead><tbody>`;
        let gHarga = 0, gPeng = 0, gPot = 0, gMod = 0, gProf = 0;
        dateSorted.forEach(([date, d]) => {
            gHarga += d.harga; gPeng += d.penghasilan; gPot += d.potongan; gMod += d.modal; gProf += d.profit;
            const pc = d.profit >= 0 ? 'profit-positive' : 'profit-negative';
            html += `<tr onclick="ShopeeImport.toggleDateDetail('${date}')" style="cursor:pointer;" onmouseover="this.style.background='rgba(0, 0, 0, 0.04)'" onmouseout="this.style.background=''">
                <td style="white-space:nowrap;font-weight:600;">▶ ${date}</td>
                <td style="text-align:center;">${d.count}</td>
                <td>${formatRp(d.harga)}</td>
                <td class="negative">${formatRp(d.potongan)}</td>
                <td>${formatRp(d.penghasilan)}</td>
                <td>${d.matched > 0 ? formatRp(d.modal) : '-'}</td>
                <td class="${pc}">${d.matched > 0 ? formatRp(d.profit) : '-'}</td>
            </tr>`;
            // Detail rows
            html += `<tr class="si-date-detail si-d-${date.replace(/[^0-9]/g, '')}" style="display:none;"><td colspan="7" style="padding:0;">
                <div style="background:rgba(0, 0, 0, 0.02);border-left:3px solid var(--blue);padding:8px 12px;margin:4px 0;">
                <table style="width:100%;border-collapse:collapse;"><thead><tr style="font-size:11px;color:var(--text-muted);">
                    <th style="text-align:left;padding:4px 6px;">Produk</th><th style="text-align:left;padding:4px 6px;">Variasi</th>
                    <th style="text-align:right;padding:4px 6px;">Harga</th><th style="text-align:right;padding:4px 6px;">Penghasilan</th>
                    <th style="text-align:right;padding:4px 6px;">Modal</th><th style="text-align:right;padding:4px 6px;">Profit</th>
                    <th style="text-align:left;padding:4px 6px;">Pembeli</th>
                </tr></thead><tbody>`;
            d.orders.forEach(o => {
                const ppc = o.profitBersih !== null ? (o.profitBersih >= 0 ? 'profit-positive' : 'profit-negative') : '';
                html += `<tr style="font-size:12px;border-top:1px solid rgba(0, 0, 0, 0.04);">
                    <td style="padding:5px 6px;max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(o.product)}">${escapeHtml(o.product.length > 22 ? o.product.substring(0, 20) + '...' : o.product)}</td>
                    <td style="padding:5px 6px;font-size:11px;">${escapeHtml(o.variation || '-')}</td>
                    <td style="padding:5px 6px;text-align:right;">${formatRp(o.hargaAsli)}</td>
                    <td style="padding:5px 6px;text-align:right;">${formatRp(o.totalPenghasilan)}</td>
                    <td style="padding:5px 6px;text-align:right;">${o.totalModal !== null ? formatRp(o.totalModal) : '-'}</td>
                    <td style="padding:5px 6px;text-align:right;" class="${ppc}">${o.profitBersih !== null ? formatRp(o.profitBersih) : '-'}</td>
                    <td style="padding:5px 6px;font-size:11px;">${escapeHtml(o.pembeli)}</td>
                </tr>`;
            });
            // Day total
            html += `<tr style="font-size:12px;border-top:2px solid rgba(0, 0, 0, 0.12);font-weight:700;">
                <td style="padding:6px;" colspan="2">TOTAL ${date}</td>
                <td style="padding:6px;text-align:right;">${formatRp(d.harga)}</td>
                <td style="padding:6px;text-align:right;">${formatRp(d.penghasilan)}</td>
                <td style="padding:6px;text-align:right;">${formatRp(d.modal)}</td>
                <td style="padding:6px;text-align:right;" class="${d.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(d.profit)}</td>
                <td></td></tr>`;
            html += `</tbody></table></div></td></tr>`;
        });
        html += `<tr style="border-top:2px solid rgba(0, 0, 0, 0.15);font-weight:700;">
            <td>TOTAL</td><td style="text-align:center;">${orders.length}</td>
            <td>${formatRp(gHarga)}</td><td class="negative">${formatRp(gPot)}</td>
            <td>${formatRp(gPeng)}</td><td>${formatRp(gMod)}</td>
            <td class="${gProf >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(gProf)}</td>
        </tr></tbody></table></div></div></div>`;

        // ---- TAB: Bulanan ----
        html += `<div id="siTab-monthly" class="si-tab-content hidden">
            <div class="card table-card" style="margin-top:0;border-radius:0 0 8px 8px;"><div class="table-wrapper"><table class="order-table">
                <thead><tr><th>Bulan</th><th>Hari</th><th>Order</th><th>Penghasilan</th><th>Modal</th><th>Profit</th><th>Rata-rata/Hari</th></tr></thead><tbody>`;
        Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([month, d]) => {
            const [y, m] = month.split('-');
            const label = `${monthNames[parseInt(m)]} ${y}`;
            const avg = d.days > 0 ? Math.round(d.profit / d.days) : 0;
            const pc = d.profit >= 0 ? 'profit-positive' : 'profit-negative';
            html += `<tr>
                <td style="white-space:nowrap;font-weight:600;">${label}</td>
                <td style="text-align:center;">${d.days}</td>
                <td style="text-align:center;">${d.count}</td>
                <td>${formatRp(d.penghasilan)}</td>
                <td>${d.matched > 0 ? formatRp(d.modal) : '-'}</td>
                <td class="${pc}">${d.matched > 0 ? formatRp(d.profit) : '-'}</td>
                <td class="${avg >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size:11px;">${formatRp(avg)}/hari</td>
            </tr>`;
        });
        html += `</tbody></table></div></div></div>`;

        // ---- TAB: Tahunan ----
        html += `<div id="siTab-yearly" class="si-tab-content hidden">
            <div class="card table-card" style="margin-top:0;border-radius:0 0 8px 8px;"><div class="table-wrapper"><table class="order-table">
                <thead><tr><th>Tahun</th><th>Bulan</th><th>Order</th><th>Penghasilan</th><th>Modal</th><th>Profit</th><th>Rata-rata/Bulan</th></tr></thead><tbody>`;
        Object.entries(yearMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([year, d]) => {
            const avgM = d.months.size > 0 ? Math.round(d.profit / d.months.size) : 0;
            const pc = d.profit >= 0 ? 'profit-positive' : 'profit-negative';
            html += `<tr>
                <td style="font-weight:700;font-size:16px;">${year}</td>
                <td style="text-align:center;">${d.months.size}</td>
                <td style="text-align:center;">${d.count}</td>
                <td>${formatRp(d.penghasilan)}</td>
                <td>${d.matched > 0 ? formatRp(d.modal) : '-'}</td>
                <td class="${pc}" style="font-weight:700;font-size:14px;">${d.matched > 0 ? formatRp(d.profit) : '-'}</td>
                <td class="${avgM >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size:11px;">${formatRp(avgM)}/bln</td>
            </tr>`;
        });
        html += `</tbody></table></div></div></div>`;

        // ---- TAB: Semua (existing table wrapped) ----
        html += `<div id="siTab-all" class="si-tab-content">`;        
        // Order table with editable modal
        html += `
            <div class="card table-card" style="margin-top: 16px;">
                <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(0, 0, 0, 0.06);flex-wrap:wrap;">
                    <label style="font-size:13px;color:var(--text-muted);white-space:nowrap;">💰 Set Semua Modal:</label>
                    <input type="number" id="bulkModalInput" placeholder="cth: 35000" 
                        style="width:130px;padding:6px 10px;border-radius:6px;border:1px solid rgba(0, 0, 0, 0.1);background:rgba(0, 0, 0, 0.05);color:var(--text);font-size:13px;">
                    <button onclick="ShopeeImport.setBulkModal()" class="btn-filter" style="padding:6px 12px;font-size:12px;">Terapkan</button>
                    <span style="font-size:11px;color:var(--text-muted);">← Isi modal lalu klik Terapkan untuk semua baris</span>
                    <button onclick="ShopeeImport.syncModal()" class="btn-filter" style="padding:6px 12px;font-size:12px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:6px;cursor:pointer;">🔄 Sinkron Modal dari Daftar Produk</button>
                </div>
                <div style="display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid rgba(0, 0, 0, 0.04);">
                    <span style="font-size:11px;color:var(--text-muted);margin-right:4px;">Urutkan:</span>
                    <button onclick="ShopeeImport.sortTable('date')" class="btn-filter si-sort-btn" data-sort="date" style="padding:3px 10px;font-size:11px;opacity:0.6;">📅 Tanggal</button>
                    <button onclick="ShopeeImport.sortTable('product')" class="btn-filter si-sort-btn active" data-sort="product" style="padding:3px 10px;font-size:11px;">📦 Produk + Variasi</button>
                    <button onclick="ShopeeImport.sortTable('harga')" class="btn-filter si-sort-btn" data-sort="harga" style="padding:3px 10px;font-size:11px;opacity:0.6;">💰 Harga Asli</button>
                </div>
                <div class="table-wrapper">
                    <table class="order-table" id="shopeeImportTable">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Tanggal</th>
                                <th>Produk</th>
                                <th>Variasi</th>
                                <th>Harga Asli</th>
                                <th>Potongan</th>
                                <th>Penghasilan</th>
                                <th style="min-width:100px;">Modal ✏️</th>
                                <th>Profit Bersih</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // Natural sort helper for variation names like "MP3 + Memory 4GB" vs "MP3 + Memory 16GB"
        function naturalSort(a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        }

        // Sort by product name + variation by default
        const sortedOrders = [...orders].sort((a, b) => {
            const nameComp = naturalSort(a.product || '', b.product || '');
            if (nameComp !== 0) return nameComp;
            return naturalSort(a.variation || '', b.variation || '');
        });

        sortedOrders.forEach((o, idx) => {
            const modalVal = o.totalModal !== null ? o.totalModal : '';
            const profitId = `profit-${idx}`;

            html += `
                <tr>
                    <td>${o.no}</td>
                    <td style="white-space:nowrap;">${o.tanggalPesanan}</td>
                    <td class="product-name-cell" title="${escapeHtml(o.product)}">${escapeHtml(o.product.length > 40 ? o.product.substring(0, 37) + '...' : o.product)}</td>
                    <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(o.variation)}">${escapeHtml(o.variation)}</td>
                    <td>${formatRp(o.hargaAsli)}</td>
                    <td class="negative">${formatRp(o.totalPotongan)}</td>
                    <td class="${o.totalPenghasilan >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(o.totalPenghasilan)}</td>
                    <td>
                        <input type="number" class="modal-input" data-idx="${idx}" data-penghasilan="${o.totalPenghasilan}"
                            data-product="${escapeHtml(o.product)}" data-harga="${o.hargaAsli}" data-variation="${escapeHtml(o.variation)}"
                            value="${modalVal}" placeholder="modal..."
                            style="width:90px;padding:4px 6px;border-radius:4px;border:1px solid rgba(0, 0, 0, 0.15);background:rgba(0, 0, 0, 0.08);color:var(--text);font-size:12px;text-align:right;"
                            oninput="ShopeeImport.recalcProfit(this)">
                    </td>
                    <td id="${profitId}">
                        ${o.profitBersih !== null 
                            ? `<span class="${o.profitBersih >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(o.profitBersih)}</span>`
                            : '<span style="color:var(--text-muted);font-size:11px;">-</span>'}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div></div>'; // close table + card + tab div

        container.innerHTML = html;
        container.classList.remove('hidden');
    }

    // ---- EDITABLE MODAL FUNCTIONS ----
    function recalcProfit(inputEl) {
        const idx = inputEl.dataset.idx;
        const penghasilan = parseFloat(inputEl.dataset.penghasilan) || 0;
        const modal = parseFloat(inputEl.value) || 0;
        const profitCell = document.getElementById(`profit-${idx}`);

        if (inputEl.value === '' || isNaN(modal)) {
            profitCell.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">-</span>';
        } else {
            const profit = penghasilan - modal;
            profitCell.innerHTML = `<span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(profit)}</span>`;
        }

        // Update summary totals
        updateSummaryTotals();
    }

    function setBulkModal() {
        const bulkInput = document.getElementById('bulkModalInput');
        const val = bulkInput ? bulkInput.value : '';
        if (!val || isNaN(parseFloat(val))) {
            showToast('Masukkan angka modal dulu', 'error');
            return;
        }

        const inputs = document.querySelectorAll('.modal-input');
        inputs.forEach(inp => {
            inp.value = val;
            recalcProfit(inp);
        });

        showToast(`Modal Rp ${parseInt(val).toLocaleString('id-ID')} diterapkan ke ${inputs.length} pesanan`, 'success');
    }

    async function syncModal() {
        // Read products FRESH from localStorage
        let allProducts = [];
        try {
            const raw = await StorageManager.getItem('bizmanager_products');
            allProducts = raw ? JSON.parse(raw) : [];
        } catch(e) {
            showToast('Error membaca data produk', 'error');
            return;
        }

        if (allProducts.length === 0) {
            showToast('Daftar produk kosong. Import produk dulu.', 'warning');
            return;
        }

        const inputs = document.querySelectorAll('.modal-input');
        let synced = 0;
        let notFound = 0;

        inputs.forEach(inp => {
            const productName = (inp.dataset.product || '').toLowerCase().trim();
            const hargaAsli = parseFloat(inp.dataset.harga) || 0;
            const variation = (inp.dataset.variation || '').toLowerCase().trim();
            
            if (!productName) return;

            // Find matching product by name (contains both ways)
            let matchedModal = null;
            
            for (const p of allProducts) {
                const sName = p.name.toLowerCase().trim();
                if (!productName.includes(sName) && !sName.includes(productName)) continue;
                
                // Product name matched! Now find the right variation
                const vars = p.variations || [];
                if (vars.length === 0) {
                    if ((p.modal || 0) > 0) matchedModal = p.modal;
                    break;
                }

                // Strategy 1: Match by variation name
                if (variation && variation !== '-') {
                    const exactVar = vars.find(v => v.name && v.name.toLowerCase().trim() === variation);
                    if (exactVar && (exactVar.modal || 0) > 0) {
                        matchedModal = exactVar.modal;
                        break;
                    }
                    const fuzzyVar = vars.find(v => v.name && (v.name.toLowerCase().includes(variation) || variation.includes(v.name.toLowerCase())));
                    if (fuzzyVar && (fuzzyVar.modal || 0) > 0) {
                        matchedModal = fuzzyVar.modal;
                        break;
                    }
                }

                // Strategy 2: Match by harga asli = harga jual
                if (hargaAsli > 0) {
                    const priceMatch = vars.find(v => (parseFloat(v.hargaJual) || 0) === hargaAsli);
                    if (priceMatch && (priceMatch.modal || 0) > 0) {
                        matchedModal = priceMatch.modal;
                        break;
                    }
                    // Tolerance ±2000
                    const toleranceMatch = vars.find(v => Math.abs((parseFloat(v.hargaJual) || 0) - hargaAsli) <= 2000 && (v.modal || 0) > 0);
                    if (toleranceMatch) {
                        matchedModal = toleranceMatch.modal;
                        break;
                    }
                }

                // Strategy 3: Single variation
                if (vars.length === 1 && (vars[0].modal || 0) > 0) {
                    matchedModal = vars[0].modal;
                    break;
                }

                // Strategy 4: any variation with modal > 0
                const withModal = vars.find(v => (v.modal || 0) > 0);
                if (withModal) {
                    matchedModal = withModal.modal;
                    break;
                }
                break;
            }

            if (matchedModal !== null && matchedModal > 0) {
                inp.value = matchedModal;
                recalcProfit(inp);
                synced++;
            } else {
                notFound++;
            }
        });

        updateSummaryTotals();
        showToast(`✅ ${synced} pesanan berhasil disinkron!${notFound > 0 ? ` (${notFound} belum ada data modal)` : ''}`, synced > 0 ? 'success' : 'warning');
    }

    function sortTable(sortBy) {
        const table = document.getElementById('shopeeImportTable');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        function naturalSort(a, b) {
            return (a || '').localeCompare(b || '', undefined, { numeric: true, sensitivity: 'base' });
        }

        rows.sort((rowA, rowB) => {
            const cells = {
                a: rowA.querySelectorAll('td'),
                b: rowB.querySelectorAll('td')
            };
            
            if (sortBy === 'date') {
                return naturalSort(cells.a[1]?.textContent, cells.b[1]?.textContent);
            } else if (sortBy === 'product') {
                const nameComp = naturalSort(
                    cells.a[2]?.getAttribute('title') || cells.a[2]?.textContent,
                    cells.b[2]?.getAttribute('title') || cells.b[2]?.textContent
                );
                if (nameComp !== 0) return nameComp;
                return naturalSort(
                    cells.a[3]?.getAttribute('title') || cells.a[3]?.textContent,
                    cells.b[3]?.getAttribute('title') || cells.b[3]?.textContent
                );
            } else if (sortBy === 'harga') {
                const parseNum = (cell) => parseFloat((cell?.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
                return parseNum(cells.b[4]) - parseNum(cells.a[4]); // descending
            }
            return 0;
        });

        // Re-number and re-append
        rows.forEach((row, i) => {
            const firstTd = row.querySelector('td');
            if (firstTd) firstTd.textContent = i + 1;
            tbody.appendChild(row);
        });

        // Update active button
        document.querySelectorAll('.si-sort-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.opacity = '0.6';
        });
        const activeBtn = document.querySelector(`.si-sort-btn[data-sort="${sortBy}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.opacity = '1';
        }
    }

    function updateSummaryTotals() {
        const inputs = document.querySelectorAll('.modal-input');
        let totalModal = 0;
        let totalProfit = 0;
        let matchedCount = 0;

        inputs.forEach(inp => {
            const modal = parseFloat(inp.value) || 0;
            const penghasilan = parseFloat(inp.dataset.penghasilan) || 0;
            if (inp.value !== '' && !isNaN(modal)) {
                totalModal += modal;
                totalProfit += (penghasilan - modal);
                matchedCount++;
            }
        });

        // Update summary card values (find by label text)
        const cards = document.querySelectorAll('.import-summary-card');
        cards.forEach(card => {
            const label = card.querySelector('.import-summary-label');
            if (!label) return;
            const text = label.textContent;
            const valueEl = card.querySelector('.import-summary-value');
            const subEl = card.querySelector('.import-summary-sub');

            if (text.includes('Total Modal') && valueEl) {
                valueEl.innerHTML = matchedCount > 0 ? formatRp(totalModal) : '<span style="font-size:13px;color:var(--text-muted);">Belum ada data</span>';
                if (subEl && inputs.length - matchedCount > 0) {
                    subEl.textContent = `${inputs.length - matchedCount} pesanan belum ada data modal`;
                }
            }
            if (text.includes('Profit Bersih') && valueEl) {
                valueEl.innerHTML = matchedCount > 0 
                    ? `<span class="${totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(totalProfit)}</span>`
                    : '<span style="font-size:13px;color:var(--text-muted);">Belum ada data</span>';
                valueEl.className = 'import-summary-value';
                if (subEl) {
                    subEl.textContent = matchedCount > 0 ? `Penghasilan − Modal (${matchedCount} pesanan)` : 'Isi modal di tabel bawah';
                }
                // Update border color
                card.style.borderLeftColor = totalProfit >= 0 ? 'var(--green)' : 'var(--red)';
            }
        });
    }

    // ---- PUBLIC HANDLERS (called from inline HTML) ----
    function handleFile(inputEl) {
        const file = inputEl.files[0];
        if (file) processFile(file);
    }

    function handleDrop(evt) {
        const file = evt.dataTransfer.files[0];
        if (file) processFile(file);
    }

    function processFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            showToast('File harus berformat .xlsx, .xls, atau .csv', 'error');
            return;
        }

        const dropZone = document.getElementById('shopeeDropZone');
        dropZone.innerHTML = `
            <div class="drop-loading">
                <div class="spinner"></div>
                <span>Memproses ${escapeHtml(file.name)}...</span>
            </div>
        `;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const orders = await parseExcel(workbook);

                renderImportResults(orders);
                showToast(`${orders.length} pesanan berhasil diimport dari Shopee!`, 'success');

                // Reset drop zone
                dropZone.innerHTML = `
                    <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span class="drop-text">✅ ${orders.length} pesanan dari <strong>${escapeHtml(file.name)}</strong></span>
                    <span class="drop-hint">Klik atau drop file lain untuk import ulang</span>
                `;
            } catch (err) {
                showToast('Gagal membaca file: ' + err.message, 'error');
                dropZone.innerHTML = `
                    <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span class="drop-text">Drop file Excel Shopee (.xlsx) di sini</span>
                    <span class="drop-hint">atau klik untuk browse — Laporan Penghasilan dari Shopee Seller Center</span>
                `;
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function getOrders() { return importedOrders; }

    function switchTab(tab) {
        document.querySelectorAll('.si-tab-btn').forEach(b => {
            b.style.color = 'var(--text-muted)';
            b.style.borderBottomColor = 'transparent';
        });
        document.querySelectorAll('.si-tab-content').forEach(c => c.classList.add('hidden'));
        const btn = document.querySelector(`.si-tab-btn[data-tab="${tab}"]`);
        if (btn) { btn.style.color = 'var(--text)'; btn.style.borderBottomColor = 'var(--blue)'; }
        document.getElementById(`siTab-${tab}`)?.classList.remove('hidden');
    }

    function toggleDateDetail(date) {
        const cls = 'si-d-' + date.replace(/[^0-9]/g, '');
        const rows = document.querySelectorAll('.' + cls);
        rows.forEach(row => {
            const isHidden = row.style.display === 'none';
            row.style.display = isHidden ? '' : 'none';
        });
        // Toggle arrow
        const allRows = document.querySelectorAll('#siTab-daily tr[onclick]');
        allRows.forEach(tr => {
            if (tr.getAttribute('onclick').includes(date)) {
                const td = tr.querySelector('td');
                if (td) td.innerHTML = td.innerHTML.replace(td.textContent.startsWith('▼') ? '▼' : '▶', td.textContent.startsWith('▼') ? '▶' : '▼');
            }
        });
    }

    function selectShop(shopId) {
        currentShop = shopId;
        const shop = ShopManager.getShops().find(s => s.id === shopId);
        const shopName = shop ? shop.name : shopId;
        document.getElementById('shopSelectionCard').classList.add('hidden');
        document.getElementById('shopUploadCard').classList.remove('hidden');
        document.getElementById('shopUploadTitle').textContent = `📥 ${shopName} — Import Penghasilan`;

        // Reset upload area
        document.getElementById('shopeeImportResults').innerHTML = '';
        document.getElementById('shopeeImportResults').classList.add('hidden');
        const dropZone = document.getElementById('shopeeDropZone');
        const fileInput = document.getElementById('shopeeFileInput');

        // Re-create drop zone with inline handlers
        dropZone.setAttribute('onclick', "document.getElementById('shopeeFileInput').click()");
        dropZone.setAttribute('ondragover', "event.preventDefault();this.classList.add('drag-over')");
        dropZone.setAttribute('ondragleave', "this.classList.remove('drag-over')");
        dropZone.setAttribute('ondrop', "event.preventDefault();this.classList.remove('drag-over');ShopeeImport.handleDrop(event)");
        dropZone.innerHTML = `
            <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="drop-text">Drop file Excel Shopee (.xlsx) di sini</span>
            <span class="drop-hint">atau klik untuk browse — Laporan Penghasilan ${escapeHtml(shopName)}</span>
        `;
        fileInput.value = '';
    }

    function backToShopList() {
        currentShop = null;
        document.getElementById('shopUploadCard').classList.add('hidden');
        document.getElementById('shopSelectionCard').classList.remove('hidden');
        document.getElementById('shopeeImportResults').innerHTML = '';
        document.getElementById('shopeeImportResults').classList.add('hidden');
    }

    function getCurrentShop() { 
        if(!currentShop) return null;
        const shop = ShopManager.getShops().find(s => s.id === currentShop);
        return shop ? shop.name : currentShop; 
    }
    
    function getCurrentShopId() { return currentShop; }

    function openMappingDialog() {
        const unmappedItems = [];
        importedOrders.forEach(o => {
            if (o.orderProducts) {
                o.orderProducts.forEach(op => {
                    if (op.needsMapping) unmappedItems.push({ name: op.name, variation: op.variation, price: op.price, unmappable: op.unmappable });
                });
            }
        });
        if (typeof AliasManager !== 'undefined') {
            AliasManager.showMappingDialog(unmappedItems, () => {
                reprocessOrders();
            });
        }
    }

    function reprocessOrders() {
        let changed = false;
        importedOrders.forEach(o => {
            if (o.orderProducts) {
                let orderFullyMapped = true;
                let totalModal = 0;
                const perItemHarga = o.orderProducts.length > 1 ? Math.round(o.hargaAsli / o.orderProducts.length) : o.hargaAsli;
                
                o.orderProducts.forEach(op => {
                    const priceToMatch = (op.price > 0) ? op.price : perItemHarga;
                    const result = findModal(op.name, priceToMatch, op.variation, op.sku, op.productId);
                    if (result.isMapped) {
                        totalModal += result.modal * op.qty;
                        if (op.needsMapping) { op.needsMapping = false; changed = true; }
                    } else {
                        orderFullyMapped = false;
                        op.needsMapping = true;
                    }
                });
                
                if (orderFullyMapped !== o.modalMatched || o.totalModal !== totalModal) {
                    o.modalMatched = orderFullyMapped;
                    o.totalModal = orderFullyMapped ? totalModal : null;
                    o.profitBersih = orderFullyMapped ? o.totalPenghasilan - totalModal : null;
                    changed = true;
                }
            }
        });
        if (changed) renderImportResults(importedOrders);
    }

    function init() {
        if (typeof ShopManager !== 'undefined') {
            ShopManager.renderShopList('shopeeShopList', 'ShopeeImport.selectShop');
        }
    }

    return { init, parseExcel, calculateSummary, recalcProfit, setBulkModal, syncModal, sortTable, getOrders, switchTab, toggleDateDetail, selectShop, backToShopList, getCurrentShop, getCurrentShopId, handleFile, handleDrop, openMappingDialog };
})();
