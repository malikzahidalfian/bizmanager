// ========================================
// APP CONTROLLER — Ricko's App Main Router
// ========================================
// NOTE: showToast() and escapeHtml() are defined globally
//       in index.html inline script (loads before all modules)

const App = (() => {
    const pages = {
        dashboard: { el: 'pageDashboard', nav: 'navDashboard', title: 'Dashboard' },
        calculator: { el: 'pageCalculator', nav: 'navCalculator', title: 'Profit Calculator' },
        products: { el: 'pageProducts', nav: 'navProducts', title: 'Daftar Produk' },
        'shop-manager-shopee': { el: 'pageShopManager', nav: 'navShopShopee', title: 'Pengaturan Toko Shopee' },
        'shop-manager-tiktok': { el: 'pageShopManager', nav: 'navShopTiktok', title: 'Pengaturan Toko TikTok' },
        'shop-manager-lazada': { el: 'pageShopManager', nav: 'navShopLazada', title: 'Pengaturan Toko Lazada' },
        'shop-products': { el: 'pageShopProducts', nav: 'navShopProducts', title: 'Pengaturan Produk' },

        'order-shipping': { el: 'pageOrderShipping', nav: 'navOrderShipping', title: 'Data Pesanan' },
        'income-data': { el: 'pageIncomeData', nav: 'navIncomeData', title: 'Data Penghasilan' },

        'business-summary': { el: 'pageBusinessSummary', nav: 'navBusinessSummary', title: 'Business Summary' },

        tasks: { el: 'pageTasks', nav: 'navTasks', title: 'Task Tracker' },
        roas: { el: 'pageRoas', nav: 'navRoas', title: 'Performa Iklan' },
        competitors: { el: 'pageCompetitors', nav: 'navCompetitors', title: 'Kompetitor' },
        'target-profit': { el: 'pageTargetProfit', nav: 'navTargetProfit', title: 'Target Profit Bulanan' },
        'affiliate-shopee': { el: 'pageAffiliate', nav: 'navAffiliateShopee', title: 'Shopee Affiliate' },
        'affiliate-tiktok': { el: 'pageAffiliate', nav: 'navAffiliateTiktok', title: 'TikTok Affiliate' }
    };

    function navigate(page) {
        if (!pages[page]) page = 'dashboard';

        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        // Show target
        const targetNav = document.getElementById(pages[page].nav);
        if (targetNav) {
            targetNav.classList.add('active');
            const parentGroup = targetNav.closest('.nav-group');
            if (parentGroup) parentGroup.classList.add('open');
        }

        document.getElementById(pages[page].el).classList.add('active');
        document.getElementById('pageTitle').textContent = pages[page].title;

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');

        // Update URL hash
        if (window.location.hash !== '#' + page) {
            history.replaceState(null, '', '#' + page);
        }

        // Refresh data when navigating to specific pages
        if (page === 'dashboard') updateDashboard();
        if (page === 'products') ProductList.renderProductGrid();
        if (page === 'roas' && typeof RoasCalculator !== 'undefined') RoasCalculator.renderShopSelection();
        if (page === 'competitors' && typeof CompetitorTracker !== 'undefined') CompetitorTracker.renderList();
        if (page === 'target-profit' && typeof TargetProfit !== 'undefined') TargetProfit.render();
        if (page === 'affiliate-shopee' && typeof AffiliateCommission !== 'undefined') {
            const titleEl = document.getElementById('affiliatePageTitle');
            if (titleEl) titleEl.textContent = '🤝 Shopee Affiliate';
            document.getElementById('affFilterPlatform').value = 'shopee';
            if (AffiliateCommission.switchPlatform) AffiliateCommission.switchPlatform('shopee');
            else AffiliateCommission.render();
        }
        if (page === 'affiliate-tiktok' && typeof AffiliateCommission !== 'undefined') {
            const titleEl = document.getElementById('affiliatePageTitle');
            if (titleEl) titleEl.textContent = '🤝 TikTok Affiliate';
            document.getElementById('affFilterPlatform').value = 'tiktok';
            if (AffiliateCommission.switchPlatform) AffiliateCommission.switchPlatform('tiktok');
            else AffiliateCommission.render();
        }
        if (page === 'order-shipping' && typeof OrderShipping !== 'undefined' && OrderShipping.renderHistory) OrderShipping.renderHistory();
        if (page === 'income-data' && typeof IncomeManager !== 'undefined' && IncomeManager.renderHistory) IncomeManager.renderHistory();
        if (page === 'business-summary') {
            if (typeof BusinessSummary !== 'undefined') BusinessSummary.render();
        }
        if (page === 'tasks') {
            TaskTracker.renderKanban();
            TaskTracker.renderCalendar();
            TaskTracker.renderTeam();
        }

        if (page.startsWith('shop-manager-')) {
            const platform = page.split('-')[2];
            if (typeof ShopManager !== 'undefined') ShopManager.renderShopManager(platform);
        }

        if (page === 'shop-products') {
            if (typeof ProductList !== 'undefined' && typeof ProductList.renderShopSelector === 'function') {
                ProductList.renderShopSelector();
            }
        }
    }

    function getPageFromHash() {
        const hash = window.location.hash.replace('#', '');
        return pages[hash] ? hash : 'dashboard';
    }

    // ---- DASHBOARD ----

    function setupDashboardCardClicks() {
        // Make stat cards clickable
        const cardMappings = {
            'dashTotalRevenue': 'income-data',
            'dashTotalProfit': 'income-data',
            'dashTotalOrders': 'order-shipping',
            'dashAdSpendTotal': 'roas'
        };

        Object.entries(cardMappings).forEach(([cardId, page]) => {
            const card = document.getElementById(cardId);
            if (card) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => navigate(page));
            }
        });
    }
    let dashChart = null;
    let dashFlatpickr = null;
    const fmt = (n) => ProfitCalculator.formatRupiah(Math.round(n || 0));

    function getDateRange() {
        if (!dashFlatpickr) {
            const now = new Date();
            const todayStr = now.toISOString().substring(0, 10);
            return { from: todayStr, to: todayStr, label: 'Hari Ini' };
        }

        const dates = dashFlatpickr.selectedDates;
        if (dates.length === 0) {
            const now = new Date();
            const dStr = now.toISOString().substring(0, 10);
            return { from: dStr, to: dStr, label: 'Hari Ini' };
        }

        const formatLocalDate = (d) => {
            return d.toLocaleDateString('sv-SE');
        };

        if (dates.length === 1) {
            const d1 = formatLocalDate(dates[0]);
            return { from: d1, to: d1, label: d1 };
        } else {
            const d1 = formatLocalDate(dates[0]);
            const d2 = formatLocalDate(dates[1]);
            return { from: d1, to: d2, label: d1 + ' - ' + d2 };
        }
    }

    async function updateDashboard() {

        // Load all Orders
        let allEntries = [];
        try {
            const data = await StorageManager.getItem('bizmanager_orders');
            allEntries = data ? JSON.parse(data) : [];
        } catch (e) { allEntries = []; }

        // Filter by date range and status = 'Selesai'
        const range = getDateRange();
        const entries = allEntries.filter(e => {
            const inDate = (e.tanggalOrder || '') >= range.from && (e.tanggalOrder || '') <= range.to;
            const statusStr = String(e.status || '').trim().toLowerCase();
            const isCompleted = statusStr.includes('selesai') || statusStr.includes('completed');
            return inDate && isCompleted;
        });

        // Load Ad Spend data from ROAS entries
        let adEntries = [];
        try {
            const adData = await StorageManager.getItem('bizmanager_roas');
            adEntries = adData ? JSON.parse(adData) : [];
        } catch (e) { adEntries = []; }

        // Filter ads by same date range
        const filteredAds = adEntries.filter(e => e.tanggal >= range.from && e.tanggal <= range.to);

        // Group ad spend by shopId
        const adSpendByShop = {};
        let totalAdSpendAll = 0;
        filteredAds.forEach(e => {
            const sid = e.shopId || 'unknown';
            if (!adSpendByShop[sid]) adSpendByShop[sid] = 0;
            adSpendByShop[sid] += e.adSpend || 0;
            totalAdSpendAll += e.adSpend || 0;
        });

        // Group by shopId for Performa per Toko
        const groupedShop = {};
        entries.forEach(e => {
            const sid = e.shopId || 'unknown';
            if (!groupedShop[sid]) groupedShop[sid] = { revenue: 0, profit: 0, modal: 0, biaya: 0, adSpend: 0 };
            groupedShop[sid].revenue += e.revenue || 0;
            const profit = (e.estProfit != null && !isNaN(e.estProfit)) ? e.estProfit : 0;
            groupedShop[sid].profit += profit;
            groupedShop[sid].modal += e.totalModal || 0;
            groupedShop[sid].biaya += e.totalBiaya || 0;
        });

        // Merge ad spend into groupedShop
        Object.keys(adSpendByShop).forEach(sid => {
            if (!groupedShop[sid]) groupedShop[sid] = { revenue: 0, profit: 0, modal: 0, biaya: 0, adSpend: 0 };
            groupedShop[sid].adSpend = adSpendByShop[sid];
        });

        // Calculate totals
        const totalRevenue = entries.reduce((s, e) => s + (e.revenue || 0), 0);
        const totalProfitRaw = entries.reduce((s, e) => s + ((e.estProfit != null && !isNaN(e.estProfit)) ? e.estProfit : 0), 0);
        const totalProfit = totalProfitRaw - totalAdSpendAll; // Profit dikurangi Ad Spend
        const totalOrders = entries.reduce((s, e) => s + (e.jumlah || 1), 0);

        // Update stat cards
        document.getElementById('dashRevVal').textContent = fmt(totalRevenue);
        document.getElementById('dashProfitVal').textContent = fmt(totalProfit);
        document.getElementById('dashOrdersVal').textContent = totalOrders.toLocaleString('id-ID');

        // Render Shop Performance Grid
        const gridContainer = document.getElementById('dashShopPerfGrid');
        if (gridContainer) {
            let html = '';
            const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];

            shops.forEach(shop => {
                const data = groupedShop[shop.id] || { revenue: 0, profit: 0, adSpend: 0 };
                const shopAdSpend = data.adSpend || 0;
                const netProfit = data.profit - shopAdSpend; // Profit dikurangi Ad Spend
                const target = shop.targetProfit || 0;
                // Cap progress at 100% for the visual width, but allow text to show more
                const rawProgress = target > 0 ? (netProfit / target) * 100 : 0;
                const visualProgress = Math.min(100, Math.max(0, rawProgress));
                const progressText = target > 0 ? rawProgress.toFixed(1) + '%' : 'N/A';

                html += `
                    <div class="shop-performance-card clickable-card" data-shop-id="${shop.id}" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:20px; box-shadow:0 2px 4px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:16px; cursor:pointer; transition: all 0.2s ease; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">
                        <div style="display:flex; align-items:center; gap:12px;">
                            ${typeof ShopManager !== 'undefined' && typeof ShopManager.getPlatformLogo === 'function' ?
                        ShopManager.getPlatformLogo(shop.platform || 'shopee', 48) :
                        `<div style="font-size:28px; width:48px; height:48px; background:rgba(0,0,0,0.04); border-radius:12px; display:flex; align-items:center; justify-content:center;">${shop.initials}</div>`
                    }
                            <div>
                                <div style="font-weight:700; color:var(--text); font-size:16px;">${escapeHtml(shop.name)}</div>
                                <div style="font-size:12px; color:var(--text-muted); margin-top:2px; text-transform:capitalize;">${shop.platform || 'General'}</div>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div style="background:rgba(0,0,0,0.02); padding:12px; border-radius:8px;">
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-bottom:4px;">Total Omset</div>
                                <div style="font-weight:700; color:var(--text-primary); font-size:16px;">${fmt(data.revenue)}</div>
                            </div>
                            <div style="background:${netProfit >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)'}; padding:12px; border-radius:8px;">
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-bottom:4px;">Profit Bersih</div>
                                <div style="font-weight:700; color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'}; font-size:16px;">${fmt(netProfit)}</div>
                            </div>
                        </div>
                        ${shopAdSpend > 0 ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div style="background:rgba(0,0,0,0.02); padding:12px; border-radius:8px;">
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-bottom:4px;">Profit Kotor</div>
                                <div style="font-weight:600; color:var(--text); font-size:14px;">${fmt(data.profit)}</div>
                            </div>
                            <div style="background:rgba(239,68,68,0.05); padding:12px; border-radius:8px;">
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-bottom:4px;">Ad Spend</div>
                                <div style="font-weight:600; color:var(--red); font-size:14px;">-${fmt(shopAdSpend)}</div>
                            </div>
                        </div>
                        ` : ''}
                        <div style="margin-top:auto;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:12px; font-weight:600; color:var(--text-muted);">Pencapaian Target</span>
                                <span style="font-size:12px; font-weight:700; color:var(--text);">${progressText}</span>
                            </div>
                            <div style="width:100%; height:8px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                                <div style="width:${visualProgress}%; height:100%; background:var(--accent); border-radius:4px; transition:width 0.5s ease;"></div>
                            </div>
                            <div style="font-size:11px; color:var(--text-muted); text-align:right; margin-top:6px;">
                                Target: ${target > 0 ? fmt(target) : 'Belum diatur'}
                            </div>
                        </div>
                    </div>
                `;
            });

            const unknownData = groupedShop['unknown'];
            if (unknownData && unknownData.profit > 0) {
                html += `
                    <div class="shop-performance-card" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:20px; box-shadow:0 2px 4px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:16px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="font-size:28px; width:48px; height:48px; background:rgba(0,0,0,0.04); border-radius:12px; display:flex; align-items:center; justify-content:center;">❓</div>
                            <div>
                                <div style="font-weight:700; color:var(--text); font-size:16px;">Toko Lama (Tidak Valid)</div>
                                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Data tanpa shopId</div>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div style="background:rgba(0,0,0,0.02); padding:12px; border-radius:8px;">
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-bottom:4px;">Total Omset</div>
                                <div style="font-weight:700; color:var(--text-primary); font-size:16px;">${fmt(unknownData.revenue)}</div>
                            </div>
                            <div style="background:rgba(34,197,94,0.05); padding:12px; border-radius:8px;">
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-bottom:4px;">Total Profit</div>
                                <div style="font-weight:700; color:var(--green); font-size:16px;">${fmt(unknownData.profit)}</div>
                            </div>
                        </div>
                        <div style="margin-top:auto;">
                            <div style="font-size:11px; color:var(--text-muted); text-align:center; padding:12px; background:rgba(0,0,0,0.02); border-radius:8px;">
                                Target tidak berlaku
                            </div>
                        </div>
                    </div>
                `;
            }

            if (!html) html = '<div style="color:var(--text-muted); font-size:14px; padding:20px;">Belum ada pesanan di rentang waktu ini.</div>';
            gridContainer.innerHTML = html;

            // Add click handlers for shop performance cards
            const shopCards = gridContainer.querySelectorAll('.shop-performance-card');
            shopCards.forEach(card => {
                card.addEventListener('click', () => {
                    const shopId = card.getAttribute('data-shop-id');
                    if (shopId) {
                        const shop = shops.find(s => s.id === shopId);
                        if (shop) {
                            navigate(`shop-manager-${shop.platform}`);
                        }
                    }
                });
            });
        }

        // Badge update
        try { TaskTracker.updateOverdueBadge(); } catch (e) { }

        // Update Ad Performance separately so it can have its own filter
        updateAdPerformance();
        updateGrandTotal(totalProfit, totalAdSpendAll);

        // Update Affiliate Commission Dashboard
        if (typeof AffiliateCommission !== 'undefined' && AffiliateCommission.render) {
            try { AffiliateCommission.render(); } catch (e) { }
        }
    }

    async function updateGrandTotal(totalProfit, totalAdSpend) {
        let affiliateTotal = 0;
        try {
            const affDataStr = await StorageManager.getItem('bizmanager_affiliate');
            if (affDataStr) {
                const affEntries = JSON.parse(affDataStr);
                const range = getDateRange();

                const pNum = v => typeof v === 'number' ? v : parseInt(String(v).replace(/\D/g, '') || 0);

                const filtered = affEntries.filter(e => {
                    const dt = typeof e.tanggal === 'string' ? e.tanggal.substring(0, 10) : '';
                    if (!dt) return false;
                    return dt >= range.from && dt <= range.to;
                });

                affiliateTotal = filtered.reduce((sum, e) => sum + pNum(e.komisi), 0);
            }
        } catch (e) { }

        const grandTotal = totalProfit + affiliateTotal;
        const el = document.getElementById('dashMasterGrandTotal');
        if (el) el.textContent = fmt(grandTotal);
        const detailEl = document.getElementById('dashMasterGrandTotalDetail');
        if (detailEl) {
            let detail = `Profit Toko: ${fmt(totalProfit)}`;
            if (totalAdSpend > 0) detail += ` (sudah − Ad Spend ${fmt(totalAdSpend)})`;
            detail += ` | Affiliate: ${fmt(affiliateTotal)}`;
            detailEl.textContent = detail;
        }
    }

    async function updateAdPerformance() {
        let adEntries = [];
        try {
            const adData = await StorageManager.getItem('bizmanager_roas');
            adEntries = adData ? JSON.parse(adData) : [];
        } catch (e) { adEntries = []; }

        const range = getDateRange();

        const filteredAds = adEntries.filter(e => e.tanggal >= range.from && e.tanggal <= range.to);

        const adTotals = filteredAds.reduce((acc, e) => {
            acc.impressions += e.impressions || 0;
            acc.clicks += e.clicks || 0;
            acc.orders += e.orders || 0;
            acc.revenue += e.revenue || 0;
            acc.adSpend += e.adSpend || 0;
            return acc;
        }, { impressions: 0, clicks: 0, orders: 0, revenue: 0, adSpend: 0 });

        const adCTR = adTotals.impressions > 0 ? (adTotals.clicks / adTotals.impressions * 100) : 0;
        const roas = adTotals.adSpend > 0 ? (adTotals.revenue / adTotals.adSpend) : 0;

        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        // Remove formatting for simple numbers if desired, but toLocaleString is usually best.
        setEl('dashAdVisits', adTotals.impressions.toLocaleString('id-ID'));
        setEl('dashAdClicks', adTotals.clicks.toLocaleString('id-ID'));
        setEl('dashAdCTR', adCTR.toFixed(2) + '%');
        setEl('dashAdOrders', adTotals.orders.toLocaleString('id-ID'));
        setEl('dashAdRevenue', fmt(adTotals.revenue));
        setEl('dashAdCost', fmt(adTotals.adSpend));
        setEl('dashAdROAS', roas.toFixed(2) + 'x');
        setEl('dashAdSpendTotalVal', fmt(adTotals.adSpend));
    }



    // ---- CLOCK ----
    function updateClock() {
        const now = new Date();
        const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        document.getElementById('sidebarTime').textContent = now.toLocaleTimeString('id-ID', opts);

        const dateOpts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('topbarDate').textContent = now.toLocaleDateString('id-ID', dateOpts);
    }

    // ---- THEME ----
    function setupTheme() {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;

        // Match initial icon state based on what index.html script injected
        if (document.body.classList.contains('dark-theme')) {
            toggleBtn.textContent = '☀️';
        }

        toggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-theme');
            localStorage.setItem('bizmanager_theme', isDark ? 'dark' : 'light');
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // ---- SIDEBAR ----
    function setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        document.getElementById('sidebarToggle').addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });

        document.getElementById('sidebarClose').addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });

        // Nav items
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) navigate(page);
            });
        });

        // Nav groups
        document.querySelectorAll('.nav-group-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.nav-group');
                if (group) group.classList.toggle('open');
            });
        });
    }

    // ---- INIT ----
    async function safeInit(name, fn) {
        try {
            await fn();
            console.log('✅ ' + name + '.init() OK');
        } catch (err) {
            console.error('❌ ' + name + '.init() FAILED:', err);
            // Show visual error on page
            setTimeout(() => {
                const toast = document.getElementById('toastContainer');
                if (toast) {
                    const div = document.createElement('div');
                    div.className = 'toast error';
                    div.textContent = '❌ Error di ' + name + ': ' + err.message;
                    div.style.cssText = 'background:#ef4444;color:white;padding:12px;border-radius:8px;margin-bottom:8px;font-size:13px;max-width:400px;';
                    toast.appendChild(div);
                }
            }, 100);
        }
    }

    async function init() {
        console.log('🚀 Ricko\'s App init starting...');

        try { setupTheme(); console.log('✅ Theme Toggle OK'); }
        catch (e) { console.error('❌ Theme Toggle FAILED:', e); }

        try { setupSidebar(); console.log('✅ Sidebar OK'); }
        catch (e) { console.error('❌ Sidebar FAILED:', e); }

        const storageOk = await StorageManager.init();
        if (!storageOk) console.warn('⚠️ StorageManager initialization failed or localForage is disconnected');

        // Setup Flatpickr for Dashboard
        const dashDateInput = document.getElementById('dashCustomDateRange');
        if (dashDateInput && typeof flatpickr !== 'undefined') {
            const now = new Date();
            const d30 = new Date(now);
            d30.setDate(d30.getDate() - 29);

            dashFlatpickr = flatpickr(dashDateInput, {
                mode: 'range',
                locale: typeof flatpickr.l10ns !== 'undefined' ? flatpickr.l10ns.id : 'default',
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'j M Y',
                defaultDate: [d30, now],
                onChange: function (selectedDates) {
                    if (selectedDates.length === 2) updateDashboard();
                }
            });
        }

        // Setup clickable dashboard stat cards
        setupDashboardCardClicks();

        // Init modules — each wrapped in try-catch so one failure doesn't block others
        await safeInit('ShopManager', async () => await ShopManager.init());
        await safeInit('ProfitCalculator', async () => await ProfitCalculator.init());
        await safeInit('ProductList', async () => await ProductList.init());
        await safeInit('AliasManager', async () => await AliasManager.init());
        await safeInit('RoasCalculator', async () => await RoasCalculator.init());
        await safeInit('CompetitorTracker', async () => await CompetitorTracker.init());
        await safeInit('OrderShipping', async () => await OrderShipping.init());
        await safeInit('IncomeManager', async () => { if (typeof IncomeManager !== 'undefined') await IncomeManager.init(); });
        await safeInit('BusinessSummary', async () => { if (typeof BusinessSummary !== 'undefined') await BusinessSummary.init(); });
        await safeInit('TargetProfit', async () => { if (typeof TargetProfit !== 'undefined') TargetProfit.init(); });
        await safeInit('AffiliateCommission', async () => { if (typeof AffiliateCommission !== 'undefined') await AffiliateCommission.init(); });

        await safeInit('TaskTracker', async () => await TaskTracker.init());

        // Hash routing
        window.addEventListener('hashchange', () => {
            navigate(getPageFromHash());
        });

        // Navigate to initial page
        navigate(getPageFromHash());

        // Clock
        updateClock();
        setInterval(updateClock, 1000);

        console.log('🏁 Ricko\'s App init complete');

        // Diagnostic: check all critical buttons
        setTimeout(diagnoseBtns, 500);
    }

    function diagnoseBtns() {
        const btns = [
            'btnImportAds', 'btnAddRoas', 'btnAddCompetitor', 'btnAddTask',
            'btnAddProduct', 'btnImportProduct', 'btnDeleteAllProducts',
            'btnCalculateShopee', 'btnCalculateTiktok',
            'sidebarToggle', 'sidebarClose'
        ];
        let issues = [];
        btns.forEach(id => {
            const el = document.getElementById(id);
            if (!el) issues.push(id + ' (MISSING from DOM!)');
        });

        // Check comp tab buttons
        const tabBtns = document.querySelectorAll('.comp-tab-btn');
        if (tabBtns.length === 0) issues.push('.comp-tab-btn (NO TAB BUTTONS FOUND!)');

        if (issues.length > 0) {
            console.warn('⚠️ Button issues:', issues);
        } else {
            console.log('✅ All critical buttons present in DOM');
        }
    }

    return { init, updateDashboard, updateAdPerformance, navigate };
})();

// Boot
document.addEventListener('DOMContentLoaded', async () => await App.init());
