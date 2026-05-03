const BusinessSummary = (() => {
    let chartInstances = [];

    async function init() {
        console.log('📊 BusinessSummary module initialized');
    }

    function destroyCharts() {
        chartInstances.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        chartInstances = [];
    }

    async function render() {
        destroyCharts();

        const container = document.getElementById('pageBusinessSummary');
        if (!container) {
            console.error('Business Summary container not found');
            return;
        }

        try {
            // Load order data
            const orderData = await StorageManager.getItem('bizmanager_orders');
            const orders = orderData ? JSON.parse(orderData) : [];

            console.log('📊 [Business Summary] Loaded from storage:', {
                hasData: orderData !== null,
                ordersCount: orders.length,
                firstOrder: orders[0] ? { noPesanan: orders[0].noPesanan, namaProduk: orders[0].namaProduk, revenue: orders[0].revenue, hargaDiskon: orders[0].hargaDiskon, jumlah: orders[0].jumlah } : null,
                allKeys: orders[0] ? Object.keys(orders[0]) : []
            });

            if (orders.length === 0) {
                showEmptyState();
                return;
            }

            // Analyze data
            const analysis = analyzeOrderData(orders);
            console.log('📊 Analysis result:', analysis);

            // Make sure the page content exists
            // Make sure the page content exists
            if (!container.querySelector('.page-content')) {
                container.innerHTML = `
                    <div class="page-content">
                        <div class="bs-header-container">
                            <h1 class="bs-header-title">Business Summary</h1>
                        </div>
                        <div class="summary-cards-grid" id="summaryCardsGrid"></div>
                        <div class="charts-section">
                            <div class="chart-row">
                                <div class="chart-card-premium">
                                    <div class="card-header"><h3>Top Kota/Kabupaten</h3></div>
                                    <div class="card-body"><div id="cityList" class="premium-data-list"></div></div>
                                </div>
                                <div class="chart-card-premium">
                                    <div class="card-header"><h3>Top Produk</h3></div>
                                    <div class="card-body"><div id="productList" class="premium-data-list"></div></div>
                                </div>
                            </div>
                            <div class="chart-row">
                                <div class="chart-card-premium">
                                    <div class="card-header"><h3>Rasio Toko</h3></div>
                                    <div class="card-body" style="position: relative; height: 350px;"><canvas id="shopChart"></canvas></div>
                                </div>
                                <div class="chart-card-premium">
                                    <div class="card-header"><h3>Tren Pendapatan Bulanan</h3></div>
                                    <div class="card-body" style="position: relative; height: 350px;"><canvas id="monthlyChart"></canvas></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Cleanup old Detail Analisis table if it still exists from previous sessions
            const oldTableCard = container.querySelector('#businessSummaryTable')?.closest('.card');
            if (oldTableCard) {
                oldTableCard.remove();
            }

            // Render summary cards
            console.log('📊 About to render summary cards...');
            renderSummaryCards(analysis);
            console.log('📊 Summary cards rendered');

            // Render charts
            console.log('📊 About to render charts...');
            renderCharts(analysis);
            console.log('📊 Charts rendered');

        } catch (error) {
            console.error('Error rendering business summary:', error);
            showErrorState(error.message);
        }
    }

    function showEmptyState() {
        const container = document.getElementById('pageBusinessSummary');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h2>Tidak Ada Data</h2>
                <p>Belum ada data pesanan yang dapat dianalisis. Upload file Excel dengan data pesanan terlebih dahulu.</p>
                <button class="btn btn-primary" onclick="App.navigate('order-shipping')">
                    <span>Upload Data Pesanan</span>
                </button>
            </div>
        `;
    }

    function showErrorState(message = 'Terjadi kesalahan saat memuat data') {
        const container = document.getElementById('pageBusinessSummary');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h2>Error</h2>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="BusinessSummary.render()">
                    <span>Coba Lagi</span>
                </button>
            </div>
        `;
    }

    function analyzeOrderData(orders) {
        const analysis = {
            cities: {},
            products: {},
            shops: {},
            monthly: {},
            totalRevenue: 0,
            totalOrders: orders.length,
            totalProducts: 0
        };

        orders.forEach(order => {
            // Calculate revenue if not present (dari order-shipping, bisa jadi hargaDiskon*jumlah)
            let revenue = parseFloat(order.revenue || 0);
            if (revenue === 0 && order.hargaDiskon && order.jumlah) {
                revenue = parseFloat(order.hargaDiskon) * parseInt(order.jumlah);
            }
            // Alternative: use dibayarPembeli as revenue
            if (revenue === 0 && order.dibayarPembeli) {
                revenue = parseFloat(order.dibayarPembeli);
            }
            // Alternative: use totalPembayaran
            if (revenue === 0 && order.totalPembayaran) {
                revenue = parseFloat(order.totalPembayaran);
            }

            // City analysis
            const city = order.alamatPembeli || order.kota || 'Tidak Diketahui';
            if (!analysis.cities[city]) {
                analysis.cities[city] = { count: 0, revenue: 0 };
            }
            analysis.cities[city].count++;
            analysis.cities[city].revenue += revenue;

            // Product analysis with variations
            const productKey = `${order.namaProduk || 'Produk Tidak Diketahui'}_${order.namaVariasi || ''}`;
            if (!analysis.products[productKey]) {
                analysis.products[productKey] = {
                    productName: order.namaProduk || 'Produk Tidak Diketahui',
                    variation: order.namaVariasi || null,
                    quantity: 0,
                    revenue: 0
                };
            }
            analysis.products[productKey].quantity += parseInt(order.jumlah || 1);
            analysis.products[productKey].revenue += revenue;
            analysis.totalProducts += parseInt(order.jumlah || 1);

            // Shop analysis
            let shopId = order.namaTokoShop || order.shop;
            if (!shopId) {
                if (order.platform === 'tiktok') shopId = 'TikTok Shop';
                else if (order.platform === 'shopee') shopId = 'Shopee';
                else if (order.platform) shopId = order.platform.charAt(0).toUpperCase() + order.platform.slice(1);
                else shopId = 'Toko Tidak Diketahui';
            }
            
            if (!analysis.shops[shopId]) {
                analysis.shops[shopId] = { revenue: 0, orders: 0 };
            }
            analysis.shops[shopId].revenue += revenue;
            analysis.shops[shopId].orders++;

            // Monthly analysis
            const dateStr = order.tanggalOrder || order.tanggalBayar || order.tglOrder;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!analysis.monthly[monthKey]) {
                    analysis.monthly[monthKey] = { revenue: 0, orders: 0 };
                }
                analysis.monthly[monthKey].revenue += revenue;
                analysis.monthly[monthKey].orders++;
            }

            analysis.totalRevenue += revenue;
        });

        console.log('📊 Analyzed data:', {
            totalRevenue: analysis.totalRevenue,
            totalOrders: analysis.totalOrders,
            totalProducts: analysis.totalProducts,
            citiesCount: Object.keys(analysis.cities).length,
            productsCount: Object.keys(analysis.products).length,
            shopsCount: Object.keys(analysis.shops).length,
            monthsCount: Object.keys(analysis.monthly).length
        });

        return analysis;
    }

    function renderSummaryCards(analysis) {
        const container = document.getElementById('summaryCardsGrid');
        console.log('🎯 renderSummaryCards - container:', { found: !!container, id: 'summaryCardsGrid', analysis: analysis });
        if (!container) {
            console.error('❌ ERROR: summaryCardsGrid container NOT FOUND!');
            return;
        }

        const svgRevenue = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
        const svgOrders = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;
        const svgProducts = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`;
        const svgCities = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>`;

        const cards = [
            {
                icon: svgRevenue,
                value: formatCurrency(analysis.totalRevenue),
                label: 'Total Pendapatan',
                gradient: 'var(--grad-revenue)',
                glow: 'rgba(236, 72, 153, 0.3)'
            },
            {
                icon: svgOrders,
                value: analysis.totalOrders.toLocaleString(),
                label: 'Total Pesanan',
                gradient: 'var(--grad-orders)',
                glow: 'rgba(59, 130, 246, 0.3)'
            },
            {
                icon: svgProducts,
                value: analysis.totalProducts.toLocaleString(),
                label: 'Produk Terjual',
                gradient: 'var(--grad-margin)',
                glow: 'rgba(245, 158, 11, 0.3)'
            },
            {
                icon: svgCities,
                value: Object.keys(analysis.cities).length.toString(),
                label: 'Jangkauan Kota',
                gradient: 'var(--grad-profit)',
                glow: 'rgba(139, 92, 246, 0.3)'
            }
        ];

        container.innerHTML = cards.map(card => `
            <div class="summary-card-premium" style="--card-gradient: ${card.gradient}; --card-glow: ${card.glow};">
                <div class="card-icon-wrapper">${card.icon}</div>
                <div>
                    <div class="card-label">${card.label}</div>
                    <div class="card-value">${card.value}</div>
                </div>
            </div>
        `).join('');
    }

    function renderCharts(analysis) {
        // City List
        renderCityList(analysis.cities);

        // Product List
        renderProductList(analysis.products);

        // Shop Chart
        renderShopChart(analysis.shops);

        // Monthly Chart
        renderMonthlyChart(analysis.monthly);
    }

    function renderCityList(cities) {
        const container = document.getElementById('cityList');
        if (!container) return;

        const sortedCities = Object.entries(cities)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5);

        if (sortedCities.length === 0) {
            container.innerHTML = '<div class="no-data">Tidak ada data kota</div>';
            return;
        }

        const totalOrders = sortedCities.reduce((sum, [,data]) => sum + data.count, 0);

        container.innerHTML = sortedCities.map(([city, data], index) => {
            const percentage = ((data.count / totalOrders) * 100).toFixed(1);
            let rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
            return `
            <div class="premium-data-item">
                <div class="rank-badge ${rankClass}">${index + 1}</div>
                <div class="item-info">
                    <div class="item-title">${city}</div>
                    <div class="item-subtitle">${data.count} pesanan</div>
                </div>
                <div class="item-metrics">
                    <div class="item-revenue">${formatCurrency(data.revenue)}</div>
                    <div class="item-percentage">${percentage}%</div>
                </div>
            </div>
        `}).join('');
    }

    function renderProductList(products) {
        const container = document.getElementById('productList');
        if (!container) return;

        const sortedProducts = Object.entries(products)
            .sort(([,a], [,b]) => b.quantity - a.quantity)
            .slice(0, 5);

        if (sortedProducts.length === 0) {
            container.innerHTML = '<div class="no-data">Tidak ada data produk</div>';
            return;
        }

        const totalProducts = sortedProducts.reduce((sum, [,data]) => sum + data.quantity, 0);

        container.innerHTML = sortedProducts.map(([key, data], index) => {
            const percentage = ((data.quantity / totalProducts) * 100).toFixed(1);
            let rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
            return `
            <div class="premium-data-item">
                <div class="rank-badge ${rankClass}">${index + 1}</div>
                <div class="item-info">
                    <div class="item-title" title="${data.productName}">${data.productName}</div>
                    <div class="item-subtitle">${data.variation ? `Variasi: ${data.variation}` : `${data.quantity} terjual`}</div>
                </div>
                <div class="item-metrics">
                    <div class="item-revenue">${formatCurrency(data.revenue)}</div>
                    <div class="item-percentage">${percentage}%</div>
                </div>
            </div>
        `}).join('');
    }

    function renderShopChart(shops) {
        const ctx = document.getElementById('shopChart');
        if (!ctx) return;

        const shopEntries = Object.entries(shops).sort(([,a], [,b]) => b.revenue - a.revenue);

        if (shopEntries.length === 0) {
            const chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Tidak Ada Data'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
            chartInstances.push(chart);
            return;
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: shopEntries.map(([name]) => name),
                datasets: [{
                    data: shopEntries.map(([,data]) => data.revenue),
                    backgroundColor: [
                        '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6', '#14b8a6', '#f43f5e'
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                layout: { padding: 20 },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { family: 'Inter, sans-serif', size: 12, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 27, 75, 0.9)',
                        titleFont: { size: 14, family: 'Inter, sans-serif' },
                        bodyFont: { size: 14, weight: 'bold', family: 'Inter, sans-serif' },
                        padding: 12,
                        cornerRadius: 12,
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1) + '%';
                                return `${context.label}: ${formatCurrency(value)} (${percentage})`;
                            }
                        }
                    }
                }
            }
        });

        chartInstances.push(chart);
    }

    function renderMonthlyChart(monthly) {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;

        const ctx2d = ctx.getContext('2d');
        const gradient = ctx2d.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        const sortedMonths = Object.entries(monthly)
            .sort(([a], [b]) => a.localeCompare(b));

        const labels = sortedMonths.length === 0 ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] : sortedMonths.map(([month]) => {
            const [year, monthNum] = month.split('-');
            return `${monthNum}/${year}`;
        });
        const dataPoints = sortedMonths.length === 0 ? [0, 0, 0, 0, 0, 0] : sortedMonths.map(([,data]) => data.revenue);

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: dataPoints,
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#6366f1',
                    pointHoverBorderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 10, bottom: 10 } },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(30, 27, 75, 0.9)',
                        titleFont: { size: 14, family: 'Inter, sans-serif' },
                        bodyFont: { size: 14, weight: 'bold', family: 'Inter, sans-serif' },
                        padding: 12,
                        cornerRadius: 12,
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { font: { family: 'Inter, sans-serif', size: 12 }, color: '#64748b' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false, borderDash: [5, 5] },
                        ticks: {
                            font: { family: 'Inter, sans-serif', size: 12 },
                            color: '#64748b',
                            callback: function(value) {
                                if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + 'K';
                                return value;
                            }
                        }
                    }
                }
            }
        });

        chartInstances.push(chart);
    }

    function renderDataTable(analysis) {
        const container = document.getElementById('businessSummaryTable');
        if (!container) return;

        // This would render a detailed table - simplified for now
        const tbody = container.querySelector('tbody') || container.appendChild(document.createElement('tbody'));

        const rows = [
            ...Object.entries(analysis.cities).slice(0, 3).map(([city, data]) => ({
                category: 'Kota',
                item: city,
                count: data.count,
                percentage: ((data.count / analysis.totalOrders) * 100).toFixed(1) + '%',
                revenue: formatCurrency(data.revenue)
            })),
            ...Object.entries(analysis.products).slice(0, 3).map(([key, data]) => ({
                category: 'Produk',
                item: data.productName + (data.variation ? ` (${data.variation})` : ''),
                count: data.quantity,
                percentage: ((data.quantity / analysis.totalProducts) * 100).toFixed(1) + '%',
                revenue: formatCurrency(data.revenue)
            }))
        ];

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.category}</td>
                <td>${row.item}</td>
                <td>${row.count}</td>
                <td>${row.percentage}</td>
                <td>${row.revenue}</td>
            </tr>
        `).join('');
    }

    function getShopDisplayName(shopId) {
        // Placeholder function - not used in current implementation
        return shopId;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    return { init, render };
})();

