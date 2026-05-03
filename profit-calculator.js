// ========================================
// PROFIT CALCULATOR MODULE
// Migrated from d:\Aplikasi\app.js
// ========================================

const ProfitCalculator = (() => {
    // ---- UTILITY ----
    function parseRupiah(value) {
        if (!value) return 0;
        return parseInt(String(value).replace(/[^\d]/g, ''), 10) || 0;
    }

    function formatRupiah(num) {
        const abs = Math.abs(Math.round(num));
        const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (num < 0 ? '-' : '') + 'Rp ' + formatted;
    }

    function formatPercent(num) {
        return num.toFixed(1) + '%';
    }

    function setupRupiahInput(input) {
        input.addEventListener('input', function () {
            const raw = this.value.replace(/[^\d]/g, '');
            if (raw) {
                this.value = parseInt(raw, 10).toLocaleString('id-ID');
            } else {
                this.value = '';
            }
        });
    }

    // ---- SHOPEE CALCULATION ----
    function calculateShopee() {
        const hargaJual = parseRupiah(document.getElementById('shopeeHargaJual').value);
        const modal = parseRupiah(document.getElementById('shopeeModal').value);
        const ongkir = parseRupiah(document.getElementById('shopeeOngkir').value);
        const jumlahItem = parseInt(document.getElementById('shopeeJumlahItem').value) || 1;
        const diskonSeller = parseRupiah(document.getElementById('shopeeDiskonSeller').value);

        const kategoriSelect = document.getElementById('shopeeKategori');
        let adminPercent;
        if (kategoriSelect.value === 'custom') {
            adminPercent = parseFloat(document.getElementById('shopeeCustomFee').value) || 0;
        } else {
            adminPercent = parseFloat(kategoriSelect.value);
        }

        const gratisOngkir = document.getElementById('shopeeGratisOngkir').checked;
        const preOrder = document.getElementById('shopeePreOrder').checked;
        const promoEkstra = document.getElementById('shopeePromoEkstra').checked;
        const hematKirim = document.getElementById('shopeeHematKirim').checked;
        const komisiAffiliate = parseFloat(document.getElementById('shopeeKomisiAffiliate').value) || 0;

        if (hargaJual <= 0) {
            window.showToast && showToast('Masukkan harga jual terlebih dahulu.', 'warning');
            return;
        }

        const hargaNetPerItem = hargaJual - diskonSeller;
        const biayaAdmin = hargaNetPerItem * (adminPercent / 100) * jumlahItem;
        const biayaProses = 1250;

        let biayaGratisOngkir = 0;
        if (gratisOngkir) {
            const perItem = Math.min(hargaNetPerItem * 0.04, 10000);
            biayaGratisOngkir = perItem * jumlahItem;
        }

        let biayaPreOrder = 0;
        if (preOrder) {
            biayaPreOrder = hargaNetPerItem * 0.03 * jumlahItem;
        }

        let biayaPromoEkstra = 0;
        if (promoEkstra) {
            biayaPromoEkstra = hargaNetPerItem * 0.045 * jumlahItem;
        }

        let biayaHematKirim = 0;
        if (hematKirim) {
            biayaHematKirim = 350;
        }

        let biayaAffiliate = 0;
        if (komisiAffiliate > 0) {
            biayaAffiliate = hargaNetPerItem * (komisiAffiliate / 100) * jumlahItem;
        }

        const totalBiaya = biayaAdmin + biayaProses + biayaGratisOngkir + biayaPreOrder + biayaPromoEkstra + biayaHematKirim + biayaAffiliate;
        const totalOngkir = ongkir;
        const totalPenjualan = hargaNetPerItem * jumlahItem;
        const pendapatanBersih = totalPenjualan - totalBiaya;
        const totalModal = (modal * jumlahItem) + totalOngkir;
        const profit = pendapatanBersih - totalModal;
        const profitMargin = totalPenjualan > 0 ? (profit / totalPenjualan) * 100 : 0;
        const profitPerItem = jumlahItem > 0 ? profit / jumlahItem : 0;

        renderShopeeResult({
            hargaJual, hargaNetPerItem, jumlahItem,
            adminPercent, biayaAdmin,
            biayaProses, gratisOngkir, biayaGratisOngkir,
            preOrder, biayaPreOrder,
            promoEkstra, biayaPromoEkstra,
            hematKirim, biayaHematKirim,
            komisiAffiliate, biayaAffiliate,
            totalBiaya, totalPenjualan, pendapatanBersih,
            modal, totalOngkir, totalModal,
            profit, profitMargin, profitPerItem
        });
    }

    function renderShopeeResult(d) {
        const section = document.getElementById('resultShopee');
        const breakdown = document.getElementById('breakdownShopee');
        const summary = document.getElementById('summaryShopee');

        let rows = '';
        rows += sectionHeader('PENJUALAN');
        rows += resultRow('Harga Jual per Item', formatRupiah(d.hargaJual));
        if (d.hargaNetPerItem !== d.hargaJual) {
            rows += resultRow('Harga Setelah Diskon Seller', formatRupiah(d.hargaNetPerItem));
        }
        rows += resultRow('Jumlah Item', d.jumlahItem + ' pcs');
        rows += resultRow('Total Penjualan', formatRupiah(d.totalPenjualan), 'positive');

        rows += sectionHeader('POTONGAN MARKETPLACE');
        rows += resultRow(`Biaya Admin (${d.adminPercent}%)`, '-' + formatRupiah(d.biayaAdmin), 'negative');
        rows += resultRow('Biaya Proses Pesanan', '-' + formatRupiah(d.biayaProses), 'negative');
        if (d.gratisOngkir) {
            rows += resultRow('Gratis Ongkir XTRA (4%)', '-' + formatRupiah(d.biayaGratisOngkir), 'negative');
        }
        if (d.promoEkstra) {
            rows += resultRow('Promo Layanan Ekstra (4.5%)', '-' + formatRupiah(d.biayaPromoEkstra), 'negative');
        }
        if (d.hematKirim) {
            rows += resultRow('Hemat Biaya Kirim', '-' + formatRupiah(d.biayaHematKirim), 'negative');
        }
        if (d.preOrder) {
            rows += resultRow('Biaya Pre-Order (3%)', '-' + formatRupiah(d.biayaPreOrder), 'negative');
        }
        if (d.komisiAffiliate > 0) {
            rows += resultRow(`Komisi Affiliate (${d.komisiAffiliate}%)`, '-' + formatRupiah(d.biayaAffiliate), 'negative');
        }
        rows += resultRow('Total Potongan', '-' + formatRupiah(d.totalBiaya), 'negative');

        rows += sectionHeader('PENDAPATAN & MODAL');
        rows += resultRow('Pendapatan Bersih (setelah potongan)', formatRupiah(d.pendapatanBersih));
        rows += resultRow(`Modal Produk (${d.jumlahItem} × ${formatRupiah(d.modal)})`, '-' + formatRupiah(d.modal * d.jumlahItem), 'negative');
        if (d.totalOngkir > 0) {
            rows += resultRow('Ongkos Kirim Penjual', '-' + formatRupiah(d.totalOngkir), 'negative');
        }

        breakdown.innerHTML = rows;

        const isLoss = d.profit < 0;
        summary.innerHTML = `
            <div class="summary-box revenue" style="animation-delay: 0.1s">
                <div class="summary-label">Total Potongan</div>
                <div class="summary-value" style="color: var(--red)">${formatRupiah(d.totalBiaya)}</div>
                <div class="summary-sub">${formatPercent(d.totalPenjualan > 0 ? (d.totalBiaya / d.totalPenjualan) * 100 : 0)} dari penjualan</div>
            </div>
            <div class="summary-box profit ${isLoss ? 'loss' : ''}" style="animation-delay: 0.2s">
                <div class="summary-label">${isLoss ? 'Rugi Bersih' : 'Profit Bersih'}</div>
                <div class="summary-value">${formatRupiah(d.profit)}</div>
                <div class="summary-sub">${formatRupiah(d.profitPerItem)} / item</div>
            </div>
            <div class="summary-box margin" style="animation-delay: 0.3s">
                <div class="summary-label">Profit Margin</div>
                <div class="summary-value" style="color: ${isLoss ? 'var(--red)' : 'var(--green)'}">${formatPercent(d.profitMargin)}</div>
                <div class="summary-sub">${isLoss ? 'RUGI' : d.profitMargin > 20 ? 'Bagus!' : d.profitMargin > 10 ? 'Cukup' : 'Tipis'}</div>
            </div>
        `;

        section.classList.remove('hidden');
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---- TIKTOK SHOP CALCULATION ----
    function calculateTiktok() {
        const hargaJual = parseRupiah(document.getElementById('tiktokHargaJual').value);
        const modal = parseRupiah(document.getElementById('tiktokModal').value);
        const ongkir = parseRupiah(document.getElementById('tiktokOngkir').value);
        const jumlahItem = parseInt(document.getElementById('tiktokJumlahItem').value) || 1;
        const diskonSeller = parseRupiah(document.getElementById('tiktokDiskonSeller').value);

        const kategoriSelect = document.getElementById('tiktokKategori');
        let komisiPercent;
        if (kategoriSelect.value === 'custom') {
            komisiPercent = parseFloat(document.getElementById('tiktokCustomFee').value) || 0;
        } else {
            komisiPercent = parseFloat(kategoriSelect.value);
        }

        let effectiveKomisi = komisiPercent;
        if (kategoriSelect.value === '10.0') {
            effectiveKomisi = 8.0;
        }

        const preOrder = document.getElementById('tiktokPreOrder').checked;

        if (hargaJual <= 0) {
            window.showToast && showToast('Masukkan harga jual terlebih dahulu.', 'warning');
            return;
        }

        const hargaNetPerItem = hargaJual - diskonSeller;
        const biayaKomisi = hargaNetPerItem * (effectiveKomisi / 100) * jumlahItem;
        const biayaProses = 1250;

        let biayaPreOrder = 0;
        if (preOrder) {
            biayaPreOrder = hargaNetPerItem * 0.03 * jumlahItem;
        }

        const totalBiaya = biayaKomisi + biayaProses + biayaPreOrder;
        const totalPenjualan = hargaNetPerItem * jumlahItem;
        const pendapatanBersih = totalPenjualan - totalBiaya;
        const totalOngkir = ongkir;
        const totalModal = (modal * jumlahItem) + totalOngkir;
        const profit = pendapatanBersih - totalModal;
        const profitMargin = totalPenjualan > 0 ? (profit / totalPenjualan) * 100 : 0;
        const profitPerItem = jumlahItem > 0 ? profit / jumlahItem : 0;

        renderTiktokResult({
            hargaJual, hargaNetPerItem, jumlahItem,
            komisiPercent, effectiveKomisi, biayaKomisi,
            biayaProses, preOrder, biayaPreOrder,
            totalBiaya, totalPenjualan, pendapatanBersih,
            modal, totalOngkir, totalModal,
            profit, profitMargin, profitPerItem,
            hasDiscount: kategoriSelect.value === '10.0'
        });
    }

    function renderTiktokResult(d) {
        const section = document.getElementById('resultTiktok');
        const breakdown = document.getElementById('breakdownTiktok');
        const summary = document.getElementById('summaryTiktok');

        let rows = '';
        rows += sectionHeader('PENJUALAN');
        rows += resultRow('Harga Jual per Item', formatRupiah(d.hargaJual));
        if (d.hargaNetPerItem !== d.hargaJual) {
            rows += resultRow('Harga Setelah Diskon Seller', formatRupiah(d.hargaNetPerItem));
        }
        rows += resultRow('Jumlah Item', d.jumlahItem + ' pcs');
        rows += resultRow('Total Penjualan', formatRupiah(d.totalPenjualan), 'positive');

        rows += sectionHeader('POTONGAN MARKETPLACE');
        const komisiLabel = d.hasDiscount
            ? `Komisi Platform (${d.komisiPercent}% − diskon 20% = ${d.effectiveKomisi}%)`
            : `Komisi Platform (${d.effectiveKomisi}%)`;
        rows += resultRow(komisiLabel, '-' + formatRupiah(d.biayaKomisi), 'negative');
        rows += resultRow('Biaya Proses Order', '-' + formatRupiah(d.biayaProses), 'negative');
        if (d.preOrder) {
            rows += resultRow('Biaya Pre-Order (3%)', '-' + formatRupiah(d.biayaPreOrder), 'negative');
        }
        rows += resultRow('Total Potongan', '-' + formatRupiah(d.totalBiaya), 'negative');

        rows += sectionHeader('PENDAPATAN & MODAL');
        rows += resultRow('Pendapatan Bersih (setelah potongan)', formatRupiah(d.pendapatanBersih));
        rows += resultRow(`Modal Produk (${d.jumlahItem} × ${formatRupiah(d.modal)})`, '-' + formatRupiah(d.modal * d.jumlahItem), 'negative');
        if (d.totalOngkir > 0) {
            rows += resultRow('Ongkos Kirim Penjual', '-' + formatRupiah(d.totalOngkir), 'negative');
        }

        breakdown.innerHTML = rows;

        const isLoss = d.profit < 0;
        summary.innerHTML = `
            <div class="summary-box revenue" style="animation-delay: 0.1s">
                <div class="summary-label">Total Potongan</div>
                <div class="summary-value" style="color: var(--red)">${formatRupiah(d.totalBiaya)}</div>
                <div class="summary-sub">${formatPercent(d.totalPenjualan > 0 ? (d.totalBiaya / d.totalPenjualan) * 100 : 0)} dari penjualan</div>
            </div>
            <div class="summary-box profit ${isLoss ? 'loss' : ''}" style="animation-delay: 0.2s">
                <div class="summary-label">${isLoss ? 'Rugi Bersih' : 'Profit Bersih'}</div>
                <div class="summary-value">${formatRupiah(d.profit)}</div>
                <div class="summary-sub">${formatRupiah(d.profitPerItem)} / item</div>
            </div>
            <div class="summary-box margin" style="animation-delay: 0.3s">
                <div class="summary-label">Profit Margin</div>
                <div class="summary-value" style="color: ${isLoss ? 'var(--red)' : 'var(--green)'}">${formatPercent(d.profitMargin)}</div>
                <div class="summary-sub">${isLoss ? 'RUGI' : d.profitMargin > 20 ? 'Bagus!' : d.profitMargin > 10 ? 'Cukup' : 'Tipis'}</div>
            </div>
        `;

        section.classList.remove('hidden');
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---- HELPERS ----
    function sectionHeader(label) {
        return `<div class="result-row section-header"><span class="label">${label}</span></div>`;
    }

    function resultRow(label, value, cls = '') {
        return `<div class="result-row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
    }

    // ---- Static calculation for order-data reuse ----
    function calcShopeeProfit({ hargaJual, modal, qty, adminPercent, ongkir = 0, gratisOngkir = true, preOrder = false }) {
        const hargaNet = hargaJual;
        const biayaAdmin = hargaNet * (adminPercent / 100) * qty;
        const biayaProses = 1250;
        let biayaGO = 0;
        if (gratisOngkir) biayaGO = Math.min(hargaNet * 0.04, 10000) * qty;
        let biayaPO = 0;
        if (preOrder) biayaPO = hargaNet * 0.03 * qty;
        const totalBiaya = biayaAdmin + biayaProses + biayaGO + biayaPO;
        const totalPenjualan = hargaNet * qty;
        const pendapatan = totalPenjualan - totalBiaya;
        const totalModal = (modal * qty) + ongkir;
        const profit = pendapatan - totalModal;
        const margin = totalPenjualan > 0 ? (profit / totalPenjualan) * 100 : 0;
        return { revenue: totalPenjualan, profit, margin, totalBiaya };
    }

    function calcTiktokProfit({ hargaJual, modal, qty, komisiPercent, ongkir = 0, preOrder = false }) {
        const hargaNet = hargaJual;
        const biayaKomisi = hargaNet * (komisiPercent / 100) * qty;
        const biayaProses = 1250;
        let biayaPO = 0;
        if (preOrder) biayaPO = hargaNet * 0.03 * qty;
        const totalBiaya = biayaKomisi + biayaProses + biayaPO;
        const totalPenjualan = hargaNet * qty;
        const pendapatan = totalPenjualan - totalBiaya;
        const totalModal = (modal * qty) + ongkir;
        const profit = pendapatan - totalModal;
        const margin = totalPenjualan > 0 ? (profit / totalPenjualan) * 100 : 0;
        return { revenue: totalPenjualan, profit, margin, totalBiaya };
    }

    // ---- INIT ----
    function init() {
        // Tab switching
        const tabBtns = document.querySelectorAll('#calcTabNav .tab-btn');
        const tabPanels = document.querySelectorAll('#pageCalculator .tab-panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                tabPanels.forEach(p => {
                    p.classList.remove('active');
                    const id = p.id.toLowerCase();
                    if ((target === 'shopee' && id.includes('shopee')) ||
                        (target === 'tiktok' && id.includes('tiktok'))) {
                        p.classList.add('active');
                    }
                });
            });
        });

        // Custom fee toggle
        document.getElementById('shopeeKategori').addEventListener('change', function () {
            document.getElementById('shopeeCustomFeeGroup').classList.toggle('hidden', this.value !== 'custom');
        });
        document.getElementById('tiktokKategori').addEventListener('change', function () {
            document.getElementById('tiktokCustomFeeGroup').classList.toggle('hidden', this.value !== 'custom');
        });

        // Calculate buttons
        document.getElementById('btnCalculateShopee').addEventListener('click', calculateShopee);
        document.getElementById('btnCalculateTiktok').addEventListener('click', calculateTiktok);

        // Rupiah formatting
        const rupiahInputs = [
            'shopeeHargaJual', 'shopeeModal', 'shopeeOngkir', 'shopeeDiskonSeller',
            'tiktokHargaJual', 'tiktokModal', 'tiktokOngkir', 'tiktokDiskonSeller'
        ];
        rupiahInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) setupRupiahInput(el);
        });

        // Enter key
        document.getElementById('panelShopee').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') calculateShopee();
        });
        document.getElementById('panelTiktok').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') calculateTiktok();
        });
    }

    return {
        init,
        formatRupiah,
        formatPercent,
        parseRupiah,
        setupRupiahInput,
        calcShopeeProfit,
        calcTiktokProfit
    };
})();
