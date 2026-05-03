import sys

with open(r'd:\Aplikasi Saya\profit-log.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = r"""    async function deleteEntry(date, targetShopId) {
        if (!confirm(`Hapus data profit tanggal ${date}?`)) return;
        const allEntries = await loadEntries();
        // If deleting from specific shop, delete that only. If deleting from 'all' view, delete all records for that date.
        const entries = allEntries.filter(e => {
            if (targetShopId && targetShopId !== 'all') return !(e.date === date && e.shopId === targetShopId);
            return e.date !== date;
        });
        saveEntries(entries);
        showToast('Data dihapus', 'info');
        await render();
    }

    function switchTab(tab) {
        document.querySelectorAll('.pl-tab-btn').forEach(b => {
            b.style.color = 'var(--text-muted)';
            b.style.borderBottomColor = 'transparent';
        });
        document.querySelectorAll('.pl-tab-content').forEach(c => c.classList.add('hidden'));
        const btn = document.querySelector(`.pl-tab-btn[data-tab="${tab}"]`);
        if (btn) {
            btn.style.color = 'var(--text)';
            btn.style.borderBottomColor = 'var(--blue)';
        }
        document.getElementById(`plTab-${tab}`)?.classList.remove('hidden');
    }

    function setFilter(shopId) {
        currentShopFilter = shopId;
        render();
    }

    function toggleRow(id, iconId) {
        const children = document.querySelectorAll('.child-of-' + id);
        const icon = document.getElementById(iconId);
        let willShow = false;
        children.forEach(c => {
            if (c.style.display === 'none') {
                c.style.display = 'table-row';
                willShow = true;
            } else {
                c.style.display = 'none';
            }
        });
        if (icon) {
            icon.textContent = willShow ? '▼' : '▶';
        }
    }

    async function render() {
        const container = document.getElementById('profitLogContent');
        if (!container) return;

        const allEntries = await loadEntries();
        const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
        const getShopName = (id) => {
            const s = shops.find(s => s.id === id);
            return s ? s.name : id;
        };

        // Filter valid entries based on shop selection
        let filteredEntries = currentShopFilter === 'all' 
            ? allEntries 
            : allEntries.filter(e => e.shopId === currentShopFilter);
        
        filteredEntries.sort((a, b) => a.date.localeCompare(b.date));

        let html = '';

        // Top Filter Bar
        html += `
            <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;background:var(--bg-card);padding:12px 16px;border-radius:12px;border:1px solid var(--border-color);">
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);">Tampilkan Data:</span>
                <select onchange="ProfitLog.setFilter(this.value)" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(0,0,0,0.15);background:rgba(0,0,0,0.04);color:var(--text-primary);font-size:13px;min-width:180px;cursor:pointer;">
                    <option value="all" ${currentShopFilter === 'all' ? 'selected' : ''}>🏢 Semua Toko (Agregat)</option>
                    ${shops.map(s => `<option value="${s.id}" ${currentShopFilter === s.id ? 'selected' : ''}>🏪 ${escapeHtml(s.name)}</option>`).join('')}
                </select>
            </div>
        `;

        if (filteredEntries.length === 0) {
            html += `<div class="card" style="padding:40px;text-align:center;">
                <p style="font-size:14px;color:var(--text-muted);">Belum ada data profit tersimpan untuk filter ini</p>
                <p style="font-size:12px;color:var(--text-muted);">Import order lalu klik "Simpan ke Profit Log" untuk menambahkan data</p>
            </div>`;
            container.innerHTML = html;
            return;
        }

        // Tab buttons
        html += `<div style="display:flex;gap:4px;border-bottom:1px solid rgba(0,0,0,0.08);">
            <button class="pl-tab-btn" data-tab="harian" onclick="ProfitLog.switchTab('harian')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text);cursor:pointer;border-bottom:2px solid var(--blue);margin-bottom:-1px;">📅 Harian</button>
            <button class="pl-tab-btn" data-tab="bulanan" onclick="ProfitLog.switchTab('bulanan')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">📆 Bulanan</button>
            <button class="pl-tab-btn" data-tab="tahunan" onclick="ProfitLog.switchTab('tahunan')" style="padding:10px 16px;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">📊 Tahunan</button>
        </div>`;

        // ---- TAB: HARIAN ----
        html += `<div id="plTab-harian" class="pl-tab-content">
            <div class="card table-card" style="margin-top:0;border-radius:0 0 8px 8px;">
                <div class="table-wrapper"><table class="order-table">
                    <thead><tr>
                        <th>Tanggal</th><th>Order</th><th>Item</th><th>Revenue</th><th>Modal</th><th>Biaya</th><th>Profit</th><th></th>
                    </tr></thead><tbody>`;

        const dateMap = {};
        let totalRev = 0, totalMod = 0, totalBia = 0, totalProf = 0, totalOrd = 0, totalItm = 0;
        
        filteredEntries.forEach(e => {
            if (!dateMap[e.date]) dateMap[e.date] = { date: e.date, revenue: 0, modal: 0, biaya: 0, profit: 0, orders: 0, items: 0, children: [] };
            dateMap[e.date].revenue += e.revenue;
            dateMap[e.date].modal += (e.modal || 0);
            dateMap[e.date].biaya += (e.biaya || 0);
            dateMap[e.date].profit += e.profit;
            dateMap[e.date].orders += (e.orders || 0);
            dateMap[e.date].items += (e.items || 0);
            dateMap[e.date].children.push(e);

            totalRev += e.revenue;
            totalMod += (e.modal || 0);
            totalBia += (e.biaya || 0);
            totalProf += e.profit;
            totalOrd += (e.orders || 0);
            totalItm += (e.items || 0);
        });

        Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
            const hasChildren = currentShopFilter === 'all' && d.children.length > 1;
            const pClass = d.profit >= 0 ? 'profit-positive' : 'profit-negative';
            const rowId = 'daily-' + d.date.replace(/-/g, '');
            const iconId = 'icon-' + rowId;
            
            html += `<tr ${hasChildren ? `style="cursor:pointer;" onclick="ProfitLog.toggleRow('${rowId}', '${iconId}')"` : ''}>
                <td style="white-space:nowrap;font-weight:600;">
                    ${hasChildren ? `<span id="${iconId}" style="display:inline-block;width:16px;font-size:10px;color:var(--blue);">▶</span>` : ''} 
                    ${d.date}
                </td>
                <td style="text-align:center;">${d.orders}</td>
                <td style="text-align:center;">${d.items}</td>
                <td>${formatRp(d.revenue)}</td>
                <td>${formatRp(d.modal)}</td>
                <td>${formatRp(d.biaya)}</td>
                <td class="${pClass}">${formatRp(d.profit)}</td>
                <td><button onclick="event.stopPropagation(); ProfitLog.deleteEntry('${d.date}', '${currentShopFilter}')" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:12px;" title="Hapus">🗑️</button></td>
            </tr>`;

            if (hasChildren) {
                d.children.forEach(c => {
                    const cpClass = c.profit >= 0 ? 'profit-positive' : 'profit-negative';
                    html += `<tr class="child-of-${rowId}" style="display:none;background:rgba(0,0,0,0.02);font-size:12px;">
                        <td style="padding-left:30px;color:var(--text-muted);">↳ ${getShopName(c.shopId)}</td>
                        <td style="text-align:center;">${c.orders}</td>
                        <td style="text-align:center;">${c.items}</td>
                        <td>${formatRp(c.revenue)}</td>
                        <td>${formatRp(c.modal)}</td>
                        <td>${formatRp(c.biaya)}</td>
                        <td class="${cpClass}">${formatRp(c.profit)}</td>
                        <td><button onclick="event.stopPropagation(); ProfitLog.deleteEntry('${c.date}', '${c.shopId}')" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:11px;" title="Hapus ini">🗑️</button></td>
                    </tr>`;
                });
            }
        });

        html += `<tr style="border-top:2px solid rgba(0,0,0,0.15);font-weight:700;">
            <td>TOTAL</td>
            <td style="text-align:center;">${totalOrd}</td>
            <td style="text-align:center;">${totalItm}</td>
            <td>${formatRp(totalRev)}</td>
            <td>${formatRp(totalMod)}</td>
            <td>${formatRp(totalBia)}</td>
            <td class="${totalProf >= 0 ? 'profit-positive' : 'profit-negative'}">${formatRp(totalProf)}</td>
            <td></td>
        </tr>`;
        html += `</tbody></table></div></div></div>`;

        // ---- TAB: BULANAN ----
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const monthMap = {};
        
        Object.values(dateMap).forEach(d => {
            const m = d.date.substring(0, 7); // YYYY-MM
            if (!monthMap[m]) monthMap[m] = { month: m, revenue: 0, modal: 0, biaya: 0, profit: 0, orders: 0, items: 0, days: 0, children: [] };
            monthMap[m].revenue += d.revenue;
            monthMap[m].modal += d.modal;
            monthMap[m].biaya += d.biaya;
            monthMap[m].profit += d.profit;
            monthMap[m].orders += d.orders;
            monthMap[m].items += d.items;
            monthMap[m].days++;
            monthMap[m].children.push(d); // Contains aggregated Daily data
        });

        html += `<div id="plTab-bulanan" class="pl-tab-content hidden">
            <div class="card table-card" style="margin-top:0;border-radius:0 0 8px 8px;">
                <div class="table-wrapper"><table class="order-table">
                    <thead><tr>
                        <th>Bulan</th><th>Hari Berjalan</th><th>Order</th><th>Revenue</th><th>Modal</th><th>Biaya</th><th>Profit</th><th>Rata-rata/Hari</th>
                    </tr></thead><tbody>`;

        Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).forEach(m => {
            const [y, mIndex] = m.month.split('-');
            const label = `${monthNames[parseInt(mIndex)]} ${y}`;
            const avg = m.days > 0 ? Math.round(m.profit / m.days) : 0;
            const pClass = m.profit >= 0 ? 'profit-positive' : 'profit-negative';
            const rowId = 'monthly-' + m.month.replace('-', '');
            const iconId = 'icon-' + rowId;
            const hasChildren = m.children.length > 0;

            html += `<tr ${hasChildren ? `style="cursor:pointer;" onclick="ProfitLog.toggleRow('${rowId}', '${iconId}')"` : ''}>
                <td style="white-space:nowrap;font-weight:600;">
                    ${hasChildren ? `<span id="${iconId}" style="display:inline-block;width:16px;font-size:10px;color:var(--blue);">▶</span>` : ''} 
                    ${label}
                </td>
                <td style="text-align:center;">${m.days}</td>
                <td style="text-align:center;">${m.orders}</td>
                <td>${formatRp(m.revenue)}</td>
                <td>${formatRp(m.modal)}</td>
                <td>${formatRp(m.biaya)}</td>
                <td class="${pClass}">${formatRp(m.profit)}</td>
                <td class="${avg >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size:11px;">${formatRp(avg)}/hari</td>
            </tr>`;

            if (hasChildren) {
                m.children.sort((a, b) => a.date.localeCompare(b.date)).forEach(c => {
                    const cpClass = c.profit >= 0 ? 'profit-positive' : 'profit-negative';
                    html += `<tr class="child-of-${rowId}" style="display:none;background:rgba(0,0,0,0.02);font-size:12px;">
                        <td style="padding-left:30px;color:var(--text-muted);">↳ ${c.date}</td>
                        <td style="text-align:center;">-</td>
                        <td style="text-align:center;">${c.orders}</td>
                        <td>${formatRp(c.revenue)}</td>
                        <td>${formatRp(c.modal)}</td>
                        <td>${formatRp(c.biaya)}</td>
                        <td class="${cpClass}">${formatRp(c.profit)}</td>
                        <td></td>
                    </tr>`;
                });
            }
        });
        html += `</tbody></table></div></div></div>`;

        // ---- TAB: TAHUNAN ----
        const yearMap = {};
        Object.values(monthMap).forEach(m => {
            const y = m.month.substring(0, 4);
            if (!yearMap[y]) yearMap[y] = { year: y, revenue: 0, modal: 0, biaya: 0, profit: 0, orders: 0, items: 0, days: 0, months: new Set(), children: [] };
            yearMap[y].revenue += m.revenue;
            yearMap[y].modal += m.modal;
            yearMap[y].biaya += m.biaya;
            yearMap[y].profit += m.profit;
            yearMap[y].orders += m.orders;
            yearMap[y].items += m.items;
            yearMap[y].days += m.days;
            yearMap[y].months.add(m.month);
            yearMap[y].children.push(m); // Contains aggregated Monthly data
        });

        html += `<div id="plTab-tahunan" class="pl-tab-content hidden">
            <div class="card table-card" style="margin-top:0;border-radius:0 0 8px 8px;">
                <div class="table-wrapper"><table class="order-table">
                    <thead><tr>
                        <th>Tahun</th><th>Bulan Aktif</th><th>Hari Berjalan</th><th>Order</th><th>Revenue</th><th>Modal</th><th>Biaya</th><th>Profit</th><th>Rata-rata/Bulan</th>
                    </tr></thead><tbody>`;

        Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year)).forEach(yObj => {
            const avgMonth = yObj.months.size > 0 ? Math.round(yObj.profit / yObj.months.size) : 0;
            const pClass = yObj.profit >= 0 ? 'profit-positive' : 'profit-negative';
            const rowId = 'yearly-' + yObj.year;
            const iconId = 'icon-' + rowId;
            const hasChildren = yObj.children.length > 0;

            html += `<tr ${hasChildren ? `style="cursor:pointer;" onclick="ProfitLog.toggleRow('${rowId}', '${iconId}')"` : ''}>
                <td style="font-weight:700;font-size:15px;">
                    ${hasChildren ? `<span id="${iconId}" style="display:inline-block;width:16px;font-size:10px;color:var(--blue);">▶</span>` : ''} 
                    ${yObj.year}
                </td>
                <td style="text-align:center;">${yObj.months.size}</td>
                <td style="text-align:center;">${yObj.days}</td>
                <td style="text-align:center;">${yObj.orders}</td>
                <td>${formatRp(yObj.revenue)}</td>
                <td>${formatRp(yObj.modal)}</td>
                <td>${formatRp(yObj.biaya)}</td>
                <td class="${pClass}" style="font-weight:700;font-size:14px;">${formatRp(yObj.profit)}</td>
                <td class="${avgMonth >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size:11px;">${formatRp(avgMonth)}/bln</td>
            </tr>`;

            if (hasChildren) {
                yObj.children.sort((a, b) => a.month.localeCompare(b.month)).forEach(c => {
                    const [cY, cM] = c.month.split('-');
                    const cLabel = `${monthNames[parseInt(cM)]} ${cY}`;
                    const cpClass = c.profit >= 0 ? 'profit-positive' : 'profit-negative';
                    html += `<tr class="child-of-${rowId}" style="display:none;background:rgba(0,0,0,0.02);font-size:12px;">
                        <td style="padding-left:30px;color:var(--text-muted);">↳ ${cLabel}</td>
                        <td style="text-align:center;">-</td>
                        <td style="text-align:center;">${c.days} hari</td>
                        <td style="text-align:center;">${c.orders}</td>
                        <td>${formatRp(c.revenue)}</td>
                        <td>${formatRp(c.modal)}</td>
                        <td>${formatRp(c.biaya)}</td>
                        <td class="${cpClass}">${formatRp(c.profit)}</td>
                        <td></td>
                    </tr>`;
                });
            }
        });
        html += `</tbody></table></div></div></div>`;

        container.innerHTML = html;
    }

    async function init() {
        await render();
    }

    return { init, render, saveFromOrders, saveFromShopeeImport, deleteEntry, switchTab, setFilter, toggleRow };
})();
"""

lines = lines[:140]

with open(r'd:\Aplikasi Saya\profit-log.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
    f.write(new_content)
