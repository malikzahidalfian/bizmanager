// ========================================
// ORDER SHIPPING — Import & Display Shopee Order/Shipping Data
// ========================================

const OrderShipping = (() => {
    const STORAGE_KEY = 'bizmanager_orders';
    let savedOrders = [];
    let importedOrders = [];
    let currentShop = null;
    let osSortField = null;
    let selectedFiles = [];
    let osAdminPercent = Config.SHOPEE_ADMIN_FEE; // Default admin shopee
    let osImportFilterDateFrom = '';
    let osImportFilterDateTo = '';
    let osCurrentMode = 'import'; // 'import' | 'history'

    // Columns will be detected dynamically in parseExcel

    function parseNum(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;
        let str = String(val).trim();
        // Handle Indonesian format: dot as thousands separator (e.g., "90.000" = 90000)
        // If string has dots followed by exactly 3 digits, treat dots as thousands separators
        if (str.match(/^\d{1,3}(\.\d{3})+$/)) {
            str = str.replace(/\./g, '');
        }
        return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
    }

    function parseDate(val) {
        if (!val) return '-';
        const str = String(val).trim();
        // Format: 2026-03-19 12:11
        if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
            return str.substring(0, 10);
        }
        return str;
    }



    function formatRp(num) {
        if (typeof ProfitCalculator !== 'undefined' && ProfitCalculator.formatRupiah) {
            return ProfitCalculator.formatRupiah(num);
        }
        return 'Rp ' + Math.round(num).toLocaleString('id-ID');
    }

    // ---- AGGREGATE ORDERS ----
    /**
     * Menggabungkan orders dengan noPesanan yang sama
     * Menjumlahkan: jumlah, dibayarPembeli, totalPotongan, totalBiaya
     * Menggabungkan: namaProduk, namaVariasi (dengan separator)
     * @param {Array} orders - Array orders dari parseExcel
     * @returns {Array} - Orders yang sudah diagregasi
     */
    function aggregateOrdersByOrderNumber(orders) {
        const orderMap = new Map();

        orders.forEach(order => {
            const key = order.noPesanan;
            if (orderMap.has(key)) {
                const existing = orderMap.get(key);
                
                // Jumlahkan kolom numerik
                existing.jumlah += order.jumlah;
                existing.dibayarPembeli += order.dibayarPembeli;
                existing.totalDiskon += order.totalDiskon;
                existing.diskonPenjual += order.diskonPenjual;
                existing.diskonShopee += order.diskonShopee;
                existing.voucherPenjual += order.voucherPenjual;
                existing.voucherShopee += order.voucherShopee;
                existing.ongkirPembeli += order.ongkirPembeli;
                existing.totalPembayaran += order.totalPembayaran;
                existing.revenue += order.revenue;
                existing.biayaAdmin += order.biayaAdmin;
                existing.biayaPromoExtra += (order.biayaPromoExtra || 0);
                existing.biayaProsesPesanan += order.biayaProsesPesanan;
                existing.biayaHematKirim += (order.biayaHematKirim || 0);
                existing.totalPotongan += order.totalPotongan;
                existing.totalBiaya += order.totalBiaya;
                
                if (order.totalModal !== null && existing.totalModal !== null) {
                    existing.totalModal += order.totalModal;
                }
                
                // Gabungkan product info dengan separator
                if (order.namaVariasi && !existing.namaVariasi.includes(order.namaVariasi)) {
                    existing.namaVariasi += ` + ${order.namaVariasi}`;
                }
                
                // Gabung SKU jika berbeda
                if (order.sku && order.sku !== existing.sku && !existing.sku.includes(order.sku)) {
                    existing.sku += ` | ${order.sku}`;
                }
                
                console.log(`✅ Aggregated order ${key}: jumlah=${existing.jumlah}, dibayar=${existing.dibayarPembeli}`);
            } else {
                // Clone object untuk order baru
                orderMap.set(key, JSON.parse(JSON.stringify(order)));
            }
        });

        // Convert map ke array dan re-number
        const aggregated = Array.from(orderMap.values());
        aggregated.forEach((o, i) => {
            o.no = i + 1;
        });

        return aggregated;
    }

    // ---- PARSE EXCEL ----
    function parseExcel(workbook) {
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

        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (raw.length < 2) return [];

        const headers = raw[0].map(h => String(h || '').trim().toLowerCase());

        // Auto-detect: TikTok Shop format has "order id" + "product name"
        const isTiktok = headers.includes('order id') && headers.includes('product name');

        if (isTiktok) {
            return parseTiktokExcel(raw, headers);
        }
        return parseShopeeExcel(raw, headers);
    }

    // ---- TIKTOK SHOP PARSER ----
    let osTiktokCommission = 8.0; // Default TikTok commission 8%

    function parseDateTiktok(val) {
        if (!val) return '-';
        const str = String(val).trim();
        // Format: DD/MM/YYYY HH:MM:SS
        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) return `${match[3]}-${match[2]}-${match[1]}`;
        // Already YYYY-MM-DD
        if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10);
        return str;
    }

    function mapTiktokStatus(status) {
        const s = (status || '').trim().toLowerCase();
        if (s.includes('completed') || s.includes('selesai')) return 'Selesai';
        if (s.includes('delivered') || s.includes('terkirim')) return 'Selesai';
        if (s.includes('cancel') || s.includes('dibatalkan') || s.includes('batal')) return 'Dibatalkan';
        if (s.includes('shipped') || s.includes('dikirim') || s.includes('in transit')) return 'Dikirim';
        if (s.includes('unpaid') || s.includes('belum bayar')) return 'Belum Bayar';
        if (s.includes('return') || s.includes('refund')) return 'Retur/Refund';
        return status || '-';
    }

    function parseTiktokExcel(raw, headers) {
        const finder = (keywords) => {
            for (let i = 0; i < headers.length; i++) {
                if (keywords.some(k => headers[i] === k.toLowerCase())) return i;
            }
            // Fallback: partial match
            for (let i = 0; i < headers.length; i++) {
                if (keywords.some(k => headers[i].includes(k.toLowerCase()))) return i;
            }
            return -1;
        };

        const COL = {
            ORDER_ID:         finder(['order id']),
            STATUS:           finder(['order status']),
            PRODUCT_NAME:     finder(['product name']),
            VARIATION:        finder(['variation']),
            QUANTITY:         finder(['quantity']),
            SKU_ID:           finder(['seller sku']),
            UNIT_PRICE:       finder(['sku unit original price']),
            SUBTOTAL_BEFORE:  finder(['sku subtotal before discount']),
            PLATFORM_DISC:    finder(['sku platform discount']),
            SELLER_DISC:      finder(['sku seller discount']),
            SUBTOTAL_AFTER:   finder(['sku subtotal after discount']),
            ORDER_AMOUNT:     finder(['order amount']),
            CREATED_TIME:     finder(['created time']),
            PAID_TIME:        finder(['paid time']),
            TRACKING_ID:      finder(['tracking id']),
            SHIPPING_PROVIDER:finder(['shipping provider name']),
            DELIVERY_OPTION:  finder(['delivery option']),
            BUYER_USERNAME:   finder(['buyer username']),
            RECIPIENT:        finder(['recipient']),
            CITY:             finder(['regency and city']),
            PROVINCE:         finder(['province']),
            PAYMENT_METHOD:   finder(['payment method']),
            BUYER_MESSAGE:    finder(['buyer message']),
            BUYER_SERVICE_FEE:finder(['buyer service fee']),
            HANDLING_FEE:     finder(['handling fee']),
            SHIPPING_FEE_AFTER: finder(['shipping fee after discount']),
            CANCEL_REASON:    finder(['cancel reason']),
            PRODUCT_CATEGORY: finder(['product category']),
        };

        if (COL.ORDER_ID === -1 || COL.PRODUCT_NAME === -1) {
            if (typeof showToast !== 'undefined') showToast('Format TikTok Shop tidak dikenali.', 'error');
            return [];
        }

        const orders = [];
        // TikTok Excel: Row 0 = headers, Row 1 = descriptions, Row 2+ = data
        const startRow = raw.length > 2 && /^platform|^current|^the filed/i.test(String(raw[1][0] || '').trim()) ? 2 : 1;

        for (let i = startRow; i < raw.length; i++) {
            const row = raw[i];
            if (!row || !row[COL.ORDER_ID]) continue;

            const noPesanan = String(row[COL.ORDER_ID]).trim();
            if (!noPesanan) continue;

            const namaProduk = String(row[COL.PRODUCT_NAME] || '').trim();
            const namaVariasi = String(row[COL.VARIATION] || '').trim();
            const sku = COL.SKU_ID !== -1 ? String(row[COL.SKU_ID] || '').trim() : '';
            const hargaAwal = parseNum(row[COL.UNIT_PRICE]);
            const jumlah = parseInt(row[COL.QUANTITY]) || 1;
            const subtotalAfterDisc = parseNum(row[COL.SUBTOTAL_AFTER]);
            const hargaDiskon = jumlah > 0 ? Math.round(subtotalAfterDisc / jumlah) : subtotalAfterDisc;
            const diskonPlatform = parseNum(row[COL.PLATFORM_DISC]);
            const diskonPenjual = parseNum(row[COL.SELLER_DISC]);
            const totalPembayaran = parseNum(row[COL.ORDER_AMOUNT]);
            const buyerServiceFee = parseNum(row[COL.BUYER_SERVICE_FEE]);
            const handlingFee = parseNum(row[COL.HANDLING_FEE]);
            const shippingFeeAfter = parseNum(row[COL.SHIPPING_FEE_AFTER]);
            const rawStatus = String(row[COL.STATUS] || '').trim();
            const status = mapTiktokStatus(rawStatus);
            
            // Filter out cancelled orders
            if (status.toLowerCase().includes('batal') || rawStatus.toLowerCase().includes('cancel')) continue;
            
            const username = COL.BUYER_USERNAME !== -1 ? String(row[COL.BUYER_USERNAME] || '').trim() : '';
            const namaPenerima = COL.RECIPIENT !== -1 ? String(row[COL.RECIPIENT] || '').trim() : '';
            const kota = COL.CITY !== -1 ? String(row[COL.CITY] || '').trim() : '';
            const provinsi = COL.PROVINCE !== -1 ? String(row[COL.PROVINCE] || '').trim() : '';
            const metodeBayar = COL.PAYMENT_METHOD !== -1 ? String(row[COL.PAYMENT_METHOD] || '').trim() : '';
            const noResi = COL.TRACKING_ID !== -1 ? String(row[COL.TRACKING_ID] || '').trim() : '';
            const opsiPengiriman = COL.SHIPPING_PROVIDER !== -1 ? String(row[COL.SHIPPING_PROVIDER] || '').trim() : '';
            const catatan = COL.BUYER_MESSAGE !== -1 ? String(row[COL.BUYER_MESSAGE] || '').trim() : '';
            const tanggalOrder = parseDateTiktok(row[COL.CREATED_TIME]);
            const tanggalBayar = COL.PAID_TIME !== -1 ? parseDateTiktok(row[COL.PAID_TIME]) : '-';

            // TikTok fee structure
            const revenue = subtotalAfterDisc;
            const biayaKomisi = Math.round(revenue * (osTiktokCommission / 100));
            const biayaProsesPesanan = 1250;
            const totalPotongan = biayaKomisi + biayaProsesPesanan;

            // Find modal from product list
            const modalResult = findModal(namaProduk, hargaAwal, namaVariasi, sku);
            const modalPerUnit = modalResult.isMapped ? modalResult.modal : null;
            const totalModal = modalPerUnit !== null ? modalPerUnit * jumlah : null;
            const matchedVariation = modalResult.variationName;

            const totalBiaya = totalPotongan + diskonPenjual;
            const estProfit = totalModal !== null ? (revenue - totalModal - totalBiaya) : null;
            const needsMapping = !modalResult.isMapped;

            orders.push({
                no: i,
                noPesanan,
                tanggalOrder,
                tanggalBayar,
                namaProduk,
                namaVariasi,
                matchedVariation,
                sku,
                hargaAwal,
                hargaDiskon,
                jumlah,
                dibayarPembeli: totalPembayaran,
                totalDiskon: diskonPlatform + diskonPenjual,
                diskonPenjual,
                diskonShopee: diskonPlatform,
                voucherPenjual: 0,
                voucherShopee: 0,
                ongkirPembeli: shippingFeeAfter,
                estOngkir: 0,
                estPotonganOngkir: 0,
                totalPembayaran,
                revenue,
                biayaAdmin: biayaKomisi,
                biayaGratisOngkir: 0,
                biayaPromoExtra: 0,
                biayaProsesPesanan,
                biayaHematKirim: 0,
                totalPotongan,
                totalBiaya,
                totalModal,
                modalPerUnit,
                estProfit,
                needsMapping,
                status,
                username,
                namaPenerima,
                kota,
                provinsi,
                metodeBayar,
                noResi,
                opsiPengiriman,
                catatan,
                platform: 'tiktok'
            });
        }

        return orders;
    }

    // ---- SHOPEE PARSER ----
    function parseShopeeExcel(raw, headers) {
        const finder = (keywords) => {
            // Exact match first
            for (let i = 0; i < headers.length; i++) {
                if (keywords.some(k => headers[i] === k.toLowerCase())) return i;
            }
            // Fallback: partial match
            for (let i = 0; i < headers.length; i++) {
                if (keywords.some(k => headers[i].includes(k.toLowerCase()))) return i;
            }
            return -1;
        };

        const COL = {
            NO_PESANAN: finder(['no. pesanan']),
            STATUS: finder(['status pesanan']),
            NO_RESI: finder(['no. resi']),
            OPSI_PENGIRIMAN: finder(['opsi pengiriman']),
            WAKTU_ORDER: finder(['waktu pesanan dibuat']),
            WAKTU_BAYAR: finder(['waktu pembayaran dilakukan']),
            METODE_BAYAR: finder(['metode pembayaran']),
            NAMA_PRODUK: finder(['nama produk']),
            SKU: finder(['nomor referensi sku', 'sku']),
            NAMA_VARIASI: finder(['nama variasi']),
            HARGA_AWAL: finder(['harga awal']),
            HARGA_DISKON: finder(['harga setelah diskon']),
            JUMLAH: finder(['jumlah']),
            DIBAYAR_PEMBELI: finder(['dibayar pembeli', 'dibayar oleh pembeli', 'harga produk yang dibayar']),
            TOTAL_DISKON: finder(['total diskon', 'jumlah diskon']),
            DISKON_PENJUAL: finder(['diskon dari penjual']),
            DISKON_SHOPEE: finder(['diskon dari shopee']),
            VOUCHER_PENJUAL: finder(['voucher ditanggung penjual']),
            VOUCHER_SHOPEE: finder(['voucher ditanggung shopee']),
            ONGKIR_PEMBELI: finder(['ongkos kirim dibayar oleh pembeli']),
            EST_POTONGAN_ONGKIR: finder(['estimasi potongan biaya pengiriman', 'estimasi potongan ongkos kirim']),
            TOTAL_PEMBAYARAN: finder(['total pembayaran']),
            EST_ONGKIR: finder(['perkiraan ongkos kirim']),
            CATATAN: finder(['catatan dari pembeli']),
            USERNAME: finder(['username (pembeli)']),
            NAMA_PENERIMA: finder(['nama penerima']),
            KOTA: finder(['kota/kabupaten']),
            PROVINSI: finder(['provinsi'])
        };

        if (COL.NO_PESANAN === -1 || COL.NAMA_PRODUK === -1) {
            console.error("Format Excel tidak dikenali");
            if (typeof showToast !== 'undefined') showToast('Format kolom Excel tidak dikenali. Pastikan ini adalah laporan pesanan dari Shopee.', 'error');
            return [];
        }

        // Skip header row
        const orders = [];
        for (let i = 1; i < raw.length; i++) {
            const row = raw[i];
            if (!row || !row[COL.NO_PESANAN]) continue;

            const noPesanan = String(row[COL.NO_PESANAN]).trim();
            if (!noPesanan) continue;

            const namaProduk = String(row[COL.NAMA_PRODUK] || '').trim();
            const namaVariasi = String(row[COL.NAMA_VARIASI] || '').trim();
            const sku = String(row[COL.SKU] || '').trim();
            const hargaAwal = parseNum(row[COL.HARGA_AWAL]);
            const hargaDiskon = parseNum(row[COL.HARGA_DISKON]);
            const jumlah = parseInt(row[COL.JUMLAH]) || 1;
            const dibayarPembeli = parseNum(row[COL.DIBAYAR_PEMBELI]);
            const totalDiskon = parseNum(row[COL.TOTAL_DISKON]);
            const diskonPenjual = parseNum(row[COL.DISKON_PENJUAL]);
            const diskonShopee = parseNum(row[COL.DISKON_SHOPEE]);
            const voucherPenjual = parseNum(row[COL.VOUCHER_PENJUAL]);
            const voucherShopee = parseNum(row[COL.VOUCHER_SHOPEE]);
            const ongkirPembeli = parseNum(row[COL.ONGKIR_PEMBELI]);
            const estOngkir = parseNum(row[COL.EST_ONGKIR]);
            const estPotonganOngkir = parseNum(row[COL.EST_POTONGAN_ONGKIR]);
            const totalPembayaran = parseNum(row[COL.TOTAL_PEMBAYARAN]);
            const status = String(row[COL.STATUS] || '').trim();
            
            // Filter out cancelled orders
            if (status.toLowerCase().includes('batal') || status.toLowerCase().includes('cancel')) continue;
            
            const username = String(row[COL.USERNAME] || '').trim();
            const namaPenerima = String(row[COL.NAMA_PENERIMA] || '').trim();
            const kota = String(row[COL.KOTA] || '').trim();
            const provinsi = String(row[COL.PROVINSI] || '').trim();
            const metodeBayar = String(row[COL.METODE_BAYAR] || '').trim();
            const noResi = String(row[COL.NO_RESI] || '').trim();
            const opsiPengiriman = String(row[COL.OPSI_PENGIRIMAN] || '').trim();
            const catatan = String(row[COL.CATATAN] || '').trim();
            const tanggalOrder = parseDate(row[COL.WAKTU_ORDER]);
            const tanggalBayar = parseDate(row[COL.WAKTU_BAYAR]);

            // Shopee fee structure (exact)
            const subtotal = hargaDiskon * jumlah;
            const biayaAdmin = Math.round(subtotal * (osAdminPercent / 100)); // Default 9.5%
            const perItemGratisOngkir = Math.min(Math.round(hargaDiskon * 0.04), 10000); // 4% per item, max 10rb
            const biayaGratisOngkir = perItemGratisOngkir * jumlah;
            const biayaPromoExtra = Math.round(subtotal * 0.045);          // 4.5%
            const biayaProsesPesanan = 1250;                                // Rp 1.250/order
            const biayaHematKirim = 350;                                    // Rp 350/order
            const totalPotongan = biayaAdmin + biayaGratisOngkir + biayaPromoExtra + biayaProsesPesanan + biayaHematKirim;

            // Find modal from product list
            const modalResult = findModal(namaProduk, hargaAwal, namaVariasi, sku);
            const modalPerUnit = modalResult.isMapped ? modalResult.modal : null;
            const totalModal = modalPerUnit !== null ? modalPerUnit * jumlah : null;
            const matchedVariation = modalResult.variationName;

            // Calculate estimated profit
            // Profit = Harga Jual - Modal - Semua Biaya Shopee
            const revenue = subtotal;
            const totalBiaya = totalPotongan + diskonPenjual + voucherPenjual;
            const estProfit = totalModal !== null ? (revenue - totalModal - totalBiaya) : null;
            const needsMapping = !modalResult.isMapped;

            orders.push({
                no: i,
                noPesanan,
                tanggalOrder,
                tanggalBayar,
                namaProduk,
                namaVariasi,
                matchedVariation,
                sku,
                hargaAwal,
                hargaDiskon,
                jumlah,
                dibayarPembeli,
                totalDiskon,
                diskonPenjual,
                diskonShopee,
                voucherPenjual,
                voucherShopee,
                ongkirPembeli,
                estOngkir,
                estPotonganOngkir,
                totalPembayaran,
                revenue,
                biayaAdmin,
                biayaGratisOngkir,
                biayaPromoExtra,
                biayaProsesPesanan,
                biayaHematKirim,
                totalPotongan,
                totalBiaya,
                totalModal,
                modalPerUnit,
                estProfit,
                needsMapping,
                status,
                username,
                namaPenerima,
                kota,
                provinsi,
                metodeBayar,
                noResi,
                opsiPengiriman,
                catatan,
                platform: 'shopee'
            });
        }

        return orders;
    }

    // Modal matching — Simplified Import Order strategy
    // 1. Cocokkan judul produk (exact atau partial)
    // 2. Cocokkan variasi (exact atau partial)
    // 3. Ambil modal dari variasi tersebut
    function findModal(productName, hargaAwal, variationName, sku) {
        let storedProducts = [];
        try {
            storedProducts = (typeof ProductList !== 'undefined' && ProductList.getProducts)
                ? ProductList.getProducts()
                : [];
        } catch(e) { storedProducts = []; }

        if (storedProducts.length === 0) return { modal: null, variationName: null, isMapped: false };

        const eName = (productName || '').toLowerCase().trim();
        const eVar  = (variationName || '').toLowerCase().trim();

        // 1. CARI PRODUK (Exact atau Containment)
        let matchedProduct = null;
        let bestLen = 0;

        for (const p of storedProducts) {
            const pName = p.name.toLowerCase().trim();
            // Cek exact match atau saling mengandung
            if (pName === eName || eName.includes(pName) || pName.includes(eName)) {
                // Ambil match terpanjang agar lebih akurat jika ada produk yang mirip
                const matchLen = Math.min(pName.length, eName.length);
                if (matchLen > bestLen) {
                    bestLen = matchLen;
                    matchedProduct = p;
                }
            }
        }

        if (!matchedProduct) return { modal: null, variationName: null, isMapped: false };

        // 2. CARI VARIASI & AMBIL MODAL
        const vars = matchedProduct.variations || [];
        
        // Kasus: Produk tidak punya variasi
        if (vars.length === 0) {
            return { modal: matchedProduct.modal || 0, variationName: null, isMapped: true };
        }

        // Kasus: Excel ada nama variasi
        if (eVar && eVar !== '-') {
            let matchedVar = null;
            
            // Coba exact match dulu
            matchedVar = vars.find(v => v.name && v.name.toLowerCase().trim() === eVar);
            
            // Jika tidak exact, coba partial match (saling mengandung)
            if (!matchedVar) {
                matchedVar = vars.find(v => {
                    if (!v.name) return false;
                    const vLow = v.name.toLowerCase().trim();
                    return eVar.includes(vLow) || vLow.includes(eVar);
                });
            }

            if (matchedVar) {
                return { modal: matchedVar.modal || 0, variationName: matchedVar.name, isMapped: true };
            }
        }

        // Kasus: Excel tidak punya variasi/variasi tidak cocok, 
        // tapi produk di database cuma punya 1 variasi
        if (vars.length === 1) {
            return { modal: vars[0].modal || 0, variationName: vars[0].name, isMapped: true };
        }

        // Kasus terakhir: Fallback ke modal dasar produk jika ada, 
        // atau variasi pertama yang punya modal
        if ((matchedProduct.modal || 0) > 0) {
            return { modal: matchedProduct.modal, variationName: null, isMapped: true };
        }
        
        const withModal = vars.find(v => (v.modal || 0) > 0);
        if (withModal) {
            return { modal: withModal.modal, variationName: withModal.name, isMapped: true };
        }

        return { modal: 0, variationName: vars[0]?.name || null, isMapped: true };
    }

    // ---- RENDER ----
    function renderResults(newOrders = null, mode = 'import') {
        const isHistory = (mode === 'history');
        const container = document.getElementById(isHistory ? 'osHistoryResults' : 'orderShippingResults');
        if (!container) return;

        let orders = [];
        if (isHistory) {
            orders = newOrders || [];
        } else {
            if (newOrders !== null) {
                importedOrders = newOrders;
            }
            orders = importedOrders;

            // Terapkan filter tanggal (jika ada) khusus import
            if (osImportFilterDateFrom) orders = orders.filter(o => (o.tanggalOrder || '') >= osImportFilterDateFrom);
            if (osImportFilterDateTo) orders = orders.filter(o => (o.tanggalOrder || '') <= osImportFilterDateTo);
        }

        if (orders.length === 0) {
            container.innerHTML = '<p class="empty-state">Tidak ada data order dalam file.</p>';
            return;
        }

        // Summary
        const totalRevenue = orders.reduce((s, o) => s + o.revenue, 0);
        const totalPembayaran = orders.reduce((s, o) => s + o.totalPembayaran, 0);
        const matchedOrders = orders.filter(o => o.totalModal !== null);
        const totalModal = matchedOrders.reduce((s, o) => s + (o.totalModal || 0), 0);
        const totalProfit = matchedOrders.reduce((s, o) => s + (o.estProfit || 0), 0);
        const totalBiaya = orders.reduce((s, o) => s + o.totalBiaya, 0);

        const dates = orders.map(o => o.tanggalOrder).filter(d => d && d !== '-').sort();
        const dateFrom = dates[0] || '-';
        const dateTo = dates[dates.length - 1] || '-';

        // Status counts
        const statusMap = {};
        orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });

        // Kota counts
        const kotaMap = {};
        orders.forEach(o => { if (o.kota) kotaMap[o.kota] = (kotaMap[o.kota] || 0) + 1; });
        const topKota = Object.entries(kotaMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

        let html = '';

        // Header
        html += `
            <div class="shopee-import-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div>
                    <h3 style="margin:0 0 4px;font-size:16px;">${isHistory ? '📊 Ringkasan Performa Data Pesanan' : `📦 Hasil Import — ${ShopManager.getShops().find(s => s.id === currentShop)?.name || 'Order Shipping'}`}</h3>
                    <span style="font-size:12px;color:var(--text-muted);">${dateFrom} s/d ${dateTo}</span>
                </div>
            </div>
        `;

        // Build income lookup from saved penghasilan data
        const incomeMap = {};
        if (typeof IncomeManager !== 'undefined' && IncomeManager.getSavedIncomes) {
            const allIncomes = IncomeManager.getSavedIncomes();
            allIncomes.forEach(inc => {
                if (inc.noPesanan) {
                    incomeMap[inc.noPesanan] = inc.totalEarnings || 0;
                }
            });
        }

        // Summary cards at top (both platforms)
        const totalQty = orders.reduce((s, o) => s + (o.jumlah || 1), 0);
        const orderRevenue = orders.reduce((s, o) => s + (o.totalPembayaran || o.dibayarPembeli || 0), 0);
        const totalIncomeProfit = orders.reduce((s, o) => {
            const penghasilan = incomeMap[o.noPesanan];
            if (penghasilan !== undefined) {
                return s + (penghasilan - (o.totalModal || 0));
            }
            return s;
        }, 0);

        html += `
            <div class="import-summary-grid" style="margin-bottom:12px;">
                <div class="import-summary-card">
                    <span class="import-summary-label">📦 Total Pesanan</span>
                    <span class="import-summary-value">${orders.length}</span>
                </div>
                <div class="import-summary-card">
                    <span class="import-summary-label">📊 Quantity</span>
                    <span class="import-summary-value">${totalQty}</span>
                </div>
                <div class="import-summary-card">
                    <span class="import-summary-label">💰 Order Revenue</span>
                    <span class="import-summary-value">${formatRp(orderRevenue)}</span>
                </div>
                <div class="import-summary-card">
                    <span class="import-summary-label">📈 Total Profit</span>
                    <span class="import-summary-value" style="color:var(--green);">${formatRp(totalIncomeProfit)}</span>
                </div>
            </div>
        `;

        html += `

            <div class="card table-card" style="margin-top:16px;">

                <!-- Sort Buttons & Filter -->
                <div style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-bottom:1px solid rgba(0, 0, 0, 0.04);background:rgba(0, 0, 0, 0.01);overflow-x:auto;">
                    <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;margin-right:2px;">Urutkan:</span>
                    <button onclick="OrderShipping.sortTable('date')" class="btn-filter os-sort-btn ${osSortField === 'date' ? 'active' : ''}" style="padding:4px 10px;font-size:11px;white-space:nowrap;${osSortField !== 'date' ? 'opacity:0.6;' : ''}">📅 Tanggal</button>
                    <button onclick="OrderShipping.sortTable('product')" class="btn-filter os-sort-btn ${osSortField === 'product' ? 'active' : ''}" style="padding:4px 10px;font-size:11px;white-space:nowrap;${osSortField !== 'product' ? 'opacity:0.6;' : ''}">📦 Nama Produk</button>
                    <button onclick="OrderShipping.sortTable('variation')" class="btn-filter os-sort-btn ${osSortField === 'variation' ? 'active' : ''}" style="padding:4px 10px;font-size:11px;white-space:nowrap;${osSortField !== 'variation' ? 'opacity:0.6;' : ''}">🏷️ Variasi</button>
                    <button onclick="OrderShipping.sortTable('status')" class="btn-filter os-sort-btn ${osSortField === 'status' ? 'active' : ''}" style="padding:4px 10px;font-size:11px;white-space:nowrap;${osSortField !== 'status' ? 'opacity:0.6;' : ''}">📊 Status</button>
                    
                    ${ !isHistory ? `
                    <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
                        <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">Periode Import:</span>
                        <input type="date" id="osImpDateFrom" value="${osImportFilterDateFrom}" 
                            style="padding:4px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);font-size:11px;background:rgba(0,0,0,0.02);color:var(--text);">
                        <span style="font-size:11px;color:var(--text-muted);">-</span>
                        <input type="date" id="osImpDateTo" value="${osImportFilterDateTo}" 
                            style="padding:4px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);font-size:11px;background:rgba(0,0,0,0.02);color:var(--text);">
                        <button onclick="OrderShipping.applyImportFilter()" class="btn-filter" style="padding:4px 10px;font-size:11px;background:var(--accent-gradient);color:#fff;border:none;">Filter</button>
                    </div>
                    ` : '' }
                </div>

                <div class="table-wrapper">
                    <table class="order-table" id="orderShippingTable">
                        <thead>
                            <tr>
                                ${isHistory ? '<th style="width:40px;text-align:center;"><input type="checkbox" id="osSelectAll" title="Pilih Semua" onchange="OrderShipping.toggleSelectAll(this)"></th>' : ''}
                                <th>Tanggal</th>
                                <th>No Pesanan</th>
                                <th>Nama Produk</th>
                                <th>Variasi</th>
                                <th>Qty</th>
                                <th>Dibayar Customer</th>
                                <th>Penghasilan</th>
                                <th>Modal</th>
                                <th>Profit</th>
                                <th>No Resi</th>
                                <th>Status</th>
                                ${isHistory ? '<th>Aksi</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
        `;

        // Let's sort the orders array according to the state before rendering
        let renderOrders = [...orders];
        if (osSortField) {
            renderOrders.sort((a, b) => {
                let valA, valB;
                if (osSortField === 'date') { valA = a.tanggalOrder; valB = b.tanggalOrder; }
                else if (osSortField === 'product') { valA = a.namaProduk; valB = b.namaProduk; }
                else if (osSortField === 'variation') { valA = a.namaVariasi; valB = b.namaVariasi; }
                else if (osSortField === 'status') { valA = a.status; valB = b.status; }
                
                valA = String(valA || '').toLowerCase().trim();
                valB = String(valB || '').toLowerCase().trim();
                
                return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        renderOrders.forEach((o, idx) => {
            const statusClass = o.status.includes('Selesai') ? 'profit-positive' :
                                o.status.includes('Batal') ? 'profit-negative' : '';
            const shortStatus = o.status.length > 12 ? o.status.substring(0, 10) + '..' : o.status;

            // Penghasilan from income data
            const penghasilan = incomeMap[o.noPesanan] ?? null;
            const hasPenghasilan = penghasilan !== null;
            const modal = o.totalModal || 0;
            const profit = hasPenghasilan ? penghasilan - modal : null;

            html += `
                <tr>
                    ${isHistory ? `<td style="text-align:center;"><input type="checkbox" class="os-row-checkbox" value="${o.noPesanan}" onchange="OrderShipping.updateDeleteButton()"></td>` : ''}
                    <td style="white-space:nowrap;font-size:12px;">${o.tanggalOrder}</td>
                    <td style="font-size:11px;white-space:nowrap;">${o.noPesanan||'-'}</td>
                    <td class="product-name-cell" title="${escapeHtml(o.namaProduk)}">${escapeHtml(o.namaProduk.length > 35 ? o.namaProduk.substring(0, 32) + '...' : o.namaProduk)}</td>
                    <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(o.namaVariasi)}">${escapeHtml(o.namaVariasi || o.matchedVariation || '-')}</td>
                    <td style="text-align:center;">${o.jumlah}</td>
                    <td style="white-space:nowrap;font-weight:600;">${formatRp(o.totalPembayaran || o.dibayarPembeli)}</td>
                    <td style="white-space:nowrap;${hasPenghasilan ? 'color:var(--green);font-weight:600;' : 'color:var(--text-muted);font-size:11px;'}">${hasPenghasilan ? formatRp(penghasilan) : '-'}</td>
                    <td style="white-space:nowrap;font-size:12px;">${modal > 0 ? formatRp(modal) : '<span style="color:var(--text-muted);font-size:11px;">-</span>'}</td>
                    <td style="white-space:nowrap;font-weight:600;${profit !== null ? (profit >= 0 ? 'color:var(--green);' : 'color:var(--red);') : ''}">${profit !== null ? formatRp(profit) : '<span style="color:var(--text-muted);font-size:11px;">-</span>'}</td>
                    <td style="font-size:11px;white-space:nowrap;">${o.noResi || '-'}</td>
                    <td style="font-size:11px;" class="${statusClass}" title="${escapeHtml(o.status)}">${escapeHtml(shortStatus)}</td>
                    ${ isHistory ? `
                    <td><button onclick="OrderShipping.deleteSavedOrder('${o.noPesanan}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;" title="Hapus">🗑️</button></td>
                    ` : '' }
                </tr>
            `;
        });

        html += '</tbody></table></div></div>'; // close table + card
        
        if (!isHistory) {
            // Add save button at the bottom of the import view
            html += `
                <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:12px;">
                    <button class="btn-modal-cancel" onclick="OrderShipping.hideImportView()">Batal</button>
                    <button class="btn-calculate" onclick="OrderShipping.saveOrders()">
                        <span class="btn-text">💾 Simpan Semua Pesanan</span>
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
        container.classList.remove('hidden');

        if (isHistory) {
            const selAll = document.getElementById('osSelectAll');
            if (selAll) selAll.checked = false;
            if (typeof OrderShipping !== 'undefined') {
                updateDeleteButton();
            }
        }
    }

    // ---- EDITABLE MODAL ----
    function recalcProfit(inputEl) {
        const idx = inputEl.dataset.idx;
        const noPesanan = inputEl.dataset.pesanan;
        const revenue = parseFloat(inputEl.dataset.revenue) || 0;
        const biaya = parseFloat(inputEl.dataset.biaya) || 0;
        const qty = parseInt(inputEl.dataset.qty) || 1;
        const modalPerUnit = parseFloat(inputEl.value) || 0;
        const profitCell = document.getElementById(`os-profit-imp-${idx}`);

        // Update di internal state agar bisa disimpan kelak
        const targetOrder = importedOrders.find(o => o.noPesanan === noPesanan);

        if (inputEl.value === '' || isNaN(modalPerUnit)) {
            profitCell.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">-</span>';
            if (targetOrder) {
                targetOrder.modalPerUnit = null;
                targetOrder.totalModal = null;
                targetOrder.estProfit = null;
            }
        } else {
            const totalModal = modalPerUnit * qty;
            const profit = revenue - totalModal - biaya;
            profitCell.innerHTML = `<span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(profit)}</span>`;
            if (targetOrder) {
                targetOrder.modalPerUnit = modalPerUnit;
                targetOrder.totalModal = totalModal;
                targetOrder.estProfit = profit;
            }
        }
    }


    function setAdminPercent() {
        const input = document.getElementById('osAdminFeeInput');
        const val = input ? parseFloat(input.value) : 0;
        if (!isNaN(val)) {
            // Detect platform from imported orders
            const isTiktok = importedOrders.length > 0 && importedOrders[0].platform === 'tiktok';

            if (isTiktok) {
                osTiktokCommission = val;
            } else {
                osAdminPercent = val;
            }

            let orders = importedOrders;
            if (osImportFilterDateFrom) orders = orders.filter(o => (o.tanggalOrder || '') >= osImportFilterDateFrom);
            if (osImportFilterDateTo) orders = orders.filter(o => (o.tanggalOrder || '') <= osImportFilterDateTo);

            let changed = false;
            orders.forEach(o => {
                o.biayaAdmin = Math.round(o.revenue * (val / 100));
                
                const oldTotalBiaya = o.totalBiaya;
                const newTotalP = o.biayaAdmin + (o.biayaGratisOngkir || 0) + (o.biayaPromoExtra || 0) + (o.biayaProsesPesanan || 0) + (o.biayaHematKirim || 0);
                const newTotalBiaya = newTotalP + (o.diskonPenjual || 0) + (o.voucherPenjual || 0);

                o.totalPotongan = newTotalP;
                o.totalBiaya = newTotalBiaya;
                
                if (oldTotalBiaya !== newTotalBiaya) {
                    changed = true;
                    if (o.totalModal !== null) {
                        o.estProfit = o.revenue - o.totalModal - o.totalBiaya;
                    }
                }
            });
            if (changed) renderResults();
            const label = isTiktok ? 'Komisi TikTok' : 'Biaya Admin Shopee';
            showToast(`${label} diupdate jadi ${val}%`, 'success');
        }
    }

    function applyImportFilter() {
        const dFrom = document.getElementById('osImpDateFrom');
        const dTo = document.getElementById('osImpDateTo');
        if (dFrom) osImportFilterDateFrom = dFrom.value;
        if (dTo) osImportFilterDateTo = dTo.value;
        renderResults(); // trigger repaint tabel dan re-calculate summary
    }

    function updateSummaryTotals() {
        const inputs = document.querySelectorAll('.os-modal-input');
        let totalModal = 0;
        let totalProfit = 0;
        let count = 0;
        inputs.forEach(inp => {
            const modal = parseFloat(inp.value) || 0;
            const revenue = parseFloat(inp.dataset.revenue) || 0;
            const biaya = parseFloat(inp.dataset.biaya) || 0;
            const qty = parseInt(inp.dataset.qty) || 1;
            if (inp.value !== '' && !isNaN(modal)) {
                totalModal += modal * qty;
                totalProfit += (revenue - modal * qty - biaya);
                count++;
            }
        });
        const modalEl = document.getElementById('osTotalModal');
        const profitEl = document.getElementById('osTotalProfit');
        if (modalEl) modalEl.innerHTML = count > 0 ? formatRp(totalModal) : '<span style="font-size:13px;color:var(--text-muted);">-</span>';
        if (profitEl) {
            profitEl.innerHTML = count > 0
                ? `<span class="${totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(totalProfit)}</span>`
                : '<span style="font-size:13px;color:var(--text-muted);">-</span>';
        }
    }

    // ---- INIT ----
    let loadedFiles = [];

    function processFiles(files) {
        const validFiles = files.filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ['xlsx', 'xls', 'csv'].includes(ext);
        });

        if (validFiles.length === 0) {
            showToast('Tidak ada file .xlsx yang valid', 'error');
            return;
        }

        const dropZone = document.getElementById('orderShippingDropZone');
        dropZone.innerHTML = `
            <div class="drop-loading">
                <div class="spinner"></div>
                <span>Memproses ${validFiles.length} file...</span>
            </div>
        `;

        let allOrders = [...importedOrders]; // Keep existing orders
        let processed = 0;
        const newFileNames = [];

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const orders = parseExcel(workbook);
                    allOrders = allOrders.concat(orders);
                    newFileNames.push(file.name);
                    if (!loadedFiles.includes(file.name)) loadedFiles.push(file.name);
                } catch (err) {
                    showToast(`Gagal membaca ${file.name}: ${err.message}`, 'error');
                }

                processed++;
                if (processed === validFiles.length) {
                    // Aggregate orders with same noPesanan
                    const aggregated = aggregateOrdersByOrderNumber(allOrders);

                    renderResults(aggregated);
                    updateFileList();
                    showToast(`${aggregated.length} order dari ${loadedFiles.length} file berhasil digabungkan!`, 'success');

                    dropZone.innerHTML = `
                        <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span class="drop-text">✅ ${aggregated.length} order dari ${loadedFiles.length} file</span>
                        <span class="drop-hint">Drop file lain untuk menambahkan data</span>
                    `;
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function updateFileList() {
        const el = document.getElementById('osFileList');
        if (!el) return;
        if (loadedFiles.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                <span style="font-size:11px;color:var(--text-muted);">📁 File dimuat:</span>
                ${loadedFiles.map(f => `<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(0, 0, 0, 0.06);color:var(--text-muted);">${escapeHtml(f)}</span>`).join('')}
                <button onclick="OrderShipping.resetFiles()" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,0,0,0.2);background:transparent;color:var(--red);cursor:pointer;">✕ Reset</button>
            </div>
        `;
    }

    function resetFiles() {
        loadedFiles = [];
        importedOrders = [];
        const el = document.getElementById('osFileList');
        if (el) el.innerHTML = '';
        const container = document.getElementById('orderShippingResults');
        if (container) { container.innerHTML = ''; container.classList.add('hidden'); }
        const dropZone = document.getElementById('orderShippingDropZone');
        if (dropZone) {
            dropZone.innerHTML = `
                <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span class="drop-text">Drop file Excel Order.shipping di sini</span>
                <span class="drop-hint">atau klik untuk browse — bisa pilih beberapa file sekaligus</span>
            `;
        }
        showToast('Data direset', 'info');
    }

    // ---- UI FLOW & STATE ----
    function selectShop(shopId) {
        currentShop = shopId;
        const shop = ShopManager.getShops().find(s => s.id === shopId);
        const shopName = shop ? shop.name : shopId;
        
        // Sembunyikan daftar toko, tampilkan tabel riwayat pesanan (History View)
        document.getElementById('osShopSelectionView').classList.add('hidden');
        document.getElementById('osImportView').classList.add('hidden');
        document.getElementById('osHistoryView').classList.remove('hidden');
        
        // Sesuaikan judul tabel
        const titleEl = document.getElementById('osHistoryTitle');
        if (titleEl) titleEl.textContent = `Data Pesanan — ${shopName}`;
        
        // Reset filter
        const fromEl = document.getElementById('osFilterDateFrom');
        const toEl = document.getElementById('osFilterDateTo');
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
        
        renderHistory();
    }

    function backToShopSelection() {
        currentShop = null;
        document.getElementById('osHistoryView').classList.add('hidden');
        document.getElementById('osImportView').classList.add('hidden');
        document.getElementById('osShopSelectionView').classList.remove('hidden');
    }

    function showImportView() {
        if (!currentShop) {
            showToast('Toko belum dipilih', 'error');
            return;
        }

        // Langsung panggil File Picker (Dialog OS)
        document.getElementById('orderShippingFileInput').click();
    }

    function _switchToImportUI() {
        osCurrentMode = 'import';
        const shop = ShopManager.getShops().find(s => s.id === currentShop);
        const shopName = shop ? shop.name : currentShop;

        document.getElementById('osHistoryView').classList.add('hidden');
        document.getElementById('osImportView').classList.remove('hidden');
        
        const titleEl = document.getElementById('osUploadTitle');
        if (titleEl) titleEl.textContent = `📦 Import Data Excel — ${shopName}`;
        
        // Reset test area
        document.getElementById('orderShippingResults').innerHTML = '';
        document.getElementById('orderShippingResults').classList.add('hidden');
        document.getElementById('osFileList').innerHTML = '';
        selectedFiles = [];
    }

    function hideImportView() {
        document.getElementById('osImportView').classList.add('hidden');
        document.getElementById('osHistoryView').classList.remove('hidden');
        resetFiles();
        renderHistory();
    }

    function renderHistory() {
        osCurrentMode = 'history';
        const container = document.getElementById('osHistoryResults');
        if (!container) return;
        
        let filtered = savedOrders;
        
        // Filter by selected shop
        if (currentShop) {
            filtered = filtered.filter(o => o.shopId === currentShop);
        }
        
        // Filter by Date Range
        const dateFrom = document.getElementById('osFilterDateFrom')?.value;
        const dateTo = document.getElementById('osFilterDateTo')?.value;
        
        if (dateFrom) filtered = filtered.filter(o => (o.tanggalOrder||'') >= dateFrom);
        if (dateTo) filtered = filtered.filter(o => (o.tanggalOrder||'') <= dateTo);
        
        // Serahkan data terfilter ke engine renderResults dalam mode history
        renderResults(filtered, 'history');
    }

    async function saveOrders() {
        let ordersToSave = importedOrders;
        if (osImportFilterDateFrom) ordersToSave = ordersToSave.filter(o => (o.tanggalOrder || '') >= osImportFilterDateFrom);
        if (osImportFilterDateTo) ordersToSave = ordersToSave.filter(o => (o.tanggalOrder || '') <= osImportFilterDateTo);

        if(ordersToSave.length === 0) {
            showToast('Tidak ada order dari filter yang dipilih untuk disimpan', 'error'); return;
        }
        
        const deduped = [...savedOrders];
        let added = 0;
        let updated = 0;
        
        ordersToSave.forEach(o => {
            // Apply unmapped product mappings automatically before saving
            // Find modal if not edited manually
            if (o.modalPerUnit === null && o.totalModal === null) {
                const res = findModal(o.namaProduk, o.hargaAwal, o.namaVariasi, o.sku);
                if (res.isMapped) {
                    o.modalPerUnit = res.modal;
                    o.totalModal = res.modal !== null ? res.modal * o.jumlah : null;
                    o.estProfit = o.totalModal !== null ? (o.revenue - o.totalModal - o.totalBiaya) : null;
                }
            }
            
            o.shopId = currentShop;
            const existingIdx = deduped.findIndex(so => so.noPesanan === o.noPesanan);
            if (existingIdx !== -1) {
                deduped[existingIdx] = o;
                updated++;
            } else {
                deduped.push(o);
                added++;
            }
        });
        
        savedOrders = deduped;
        if(typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(savedOrders));
        }
        
        showToast(`${added} disimpan, ${updated} diperbarui`, 'success');
        hideImportView();
    }

    async function deleteSavedOrder(noPesanan) {
        const ok = await AppModal.confirm(`Hapus pesanan ${noPesanan}?`, 'Hapus Pesanan', 'danger');
        if (!ok) return;
        savedOrders = savedOrders.filter(o => o.noPesanan !== noPesanan);
        if(typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(savedOrders));
        }
        renderHistory();
        showToast('Pesanan dihapus', 'success');
    }

    function toggleSelectAll(cb) {
        const checkboxes = document.querySelectorAll('.os-row-checkbox');
        checkboxes.forEach(c => c.checked = cb.checked);
        updateDeleteButton();
    }

    function updateDeleteButton() {
        const anyChecked = document.querySelectorAll('.os-row-checkbox:checked').length > 0;
        const btn = document.getElementById('osBtnDeleteSelected');
        if (btn) btn.style.display = anyChecked ? 'inline-block' : 'none';
        
        const allBoxes = document.querySelectorAll('.os-row-checkbox');
        const selAll = document.getElementById('osSelectAll');
        if (selAll && allBoxes.length > 0) {
            selAll.checked = allBoxes.length === document.querySelectorAll('.os-row-checkbox:checked').length;
        }
    }

    async function deleteSelectedOrders() {
        const checked = document.querySelectorAll('.os-row-checkbox:checked');
        if (checked.length === 0) return;
        
        const ok = await AppModal.confirm(`Hapus ${checked.length} pesanan yang dipilih?`, 'Hapus Pesanan Masal', 'danger');
        if (!ok) return;
        
        const idsToDelete = Array.from(checked).map(cb => cb.value);
        savedOrders = savedOrders.filter(o => !idsToDelete.includes(o.noPesanan));
        
        if (typeof StorageManager !== 'undefined') {
            await StorageManager.setItem(STORAGE_KEY, JSON.stringify(savedOrders));
        }
        
        showToast(`${checked.length} pesanan berhasil dihapus`, 'success');
        renderHistory();
        
        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    }

    function switchTab(tab) {
        document.querySelectorAll('.os-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-muted)';
            b.style.borderBottomColor = 'transparent';
        });
        document.querySelectorAll('.os-tab-content').forEach(c => c.classList.add('hidden'));
        const activeBtn = document.querySelector(`.os-tab-btn[data-tab="${tab}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.color = 'var(--text)';
            activeBtn.style.borderBottomColor = 'var(--blue)';
        }
        document.getElementById(`osTab-${tab}`)?.classList.remove('hidden');
    }
    function toggleDateDetail(date) {
        const cls = 'os-date-' + date.replace(/[^0-9]/g, '');
        const rows = document.querySelectorAll('.' + cls);
        rows.forEach(row => {
            const isHidden = row.style.display === 'none';
            row.style.display = isHidden ? '' : 'none';
        });
        // Toggle arrow on the parent row
        const allDateRows = document.querySelectorAll('#osTab-dates tr[onclick]');
        allDateRows.forEach(tr => {
            if (tr.getAttribute('onclick').includes(date)) {
                const td = tr.querySelector('td');
                if (td) {
                    const isOpen = td.textContent.startsWith('▼');
                    td.innerHTML = td.innerHTML.replace(isOpen ? '▼' : '▶', isOpen ? '▶' : '▼');
                }
            }
        });
    }

    function getOrders() { return importedOrders; }

    async function init() {
        if(typeof StorageManager !== 'undefined') {
            try {
                const data = await StorageManager.getItem(STORAGE_KEY);
                if (data) {
                    savedOrders = JSON.parse(data);
                    // Provide default structure
                    savedOrders.forEach(o => {
                        if (typeof o.revenue === 'undefined') o.revenue = (o.hargaDiskon||0)*o.jumlah;
                    });
                }
            } catch(e) { savedOrders = []; }
        }

        // 1. Render shop selection
        if (typeof ShopManager !== 'undefined') {
            ShopManager.renderShopList('orderShippingShopList', 'OrderShipping.selectShop');
        }

        // Attach buttons
        const btnShow = document.getElementById('btnShowOsImport');
        if(btnShow) btnShow.addEventListener('click', showImportView);
        
        const btnHide = document.getElementById('btnHideOsImport');
        if(btnHide) btnHide.addEventListener('click', hideImportView);

        // 2. Setup file input + drag-drop listeners
        const fileInput = document.getElementById('orderShippingFileInput');
        const dropZone = document.getElementById('orderShippingDropZone');
        if (fileInput && dropZone) {
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    _switchToImportUI();
                    processFiles(files);
                }
                e.target.value = ''; // Fix bug: allow to upload the same file again
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) processFiles(files);
            });
            dropZone.addEventListener('click', () => fileInput.click());
        }
    }

    function getCurrentShop() { 
        if(!currentShop) return null;
        const shop = ShopManager.getShops().find(s => s.id === currentShop);
        return shop ? shop.name : currentShop; 
    }

    function getCurrentShopId() { return currentShop; }

    function sortTable(field) {
        if (osSortField === field) {
            osSortField = null;
        } else {
            osSortField = field;
        }
        
        if (osCurrentMode === 'history') {
            renderHistory();
        } else {
            if (importedOrders && importedOrders.length > 0) {
                renderResults(null, 'import');
            }
        }
        
        switchTab('orders');
    }

    // Export newly added functions for index.html inline handlers
    return { 
        init, recalcProfit, setAdminPercent, sortTable, resetFiles, 
        switchTab, toggleDateDetail, getOrders, applyImportFilter, 
        selectShop, backToShopSelection, getCurrentShop, getCurrentShopId,
        renderHistory, showImportView, hideImportView, saveOrders, deleteSavedOrder,
        toggleSelectAll, updateDeleteButton, deleteSelectedOrders
    };
})();
