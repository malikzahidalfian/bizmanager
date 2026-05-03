const TargetProfit = (() => {
    function init() {
        const btnSave = document.getElementById('btnSaveTargetProfit');
        if (btnSave) {
            btnSave.addEventListener('click', saveTargets);
        }
    }

    function render() {
        const container = document.getElementById('targetProfitContainer');
        if (!container) return;

        const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
        if (shops.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Belum ada toko yang terdaftar.</p>';
            return;
        }

        let html = '';
        shops.forEach(s => {
            const currentTarget = s.targetProfit || 0;
            html += `
                <div class="form-group" style="padding:16px; border:1px solid var(--border-color); border-radius:12px; background:var(--bg-card); display:flex; align-items:center; justify-content:space-between; gap:16px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        ${typeof ShopManager !== 'undefined' && typeof ShopManager.getPlatformLogo === 'function' ? ShopManager.getPlatformLogo(s.platform || 'shopee', 40) : `<div style="font-size:24px; width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.04); border-radius:10px;">${s.initials}</div>`}
                        <div>
                            <div style="font-weight:700; color:var(--text); font-size:15px;">${s.name}</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Platform: <span style="text-transform:capitalize;">${s.platform || 'General'}</span></div>
                        </div>
                    </div>
                    <div>
                        <label style="font-size:12px; color:var(--text-muted); margin-bottom:4px; display:block;">Target Bulanan (Rp)</label>
                        <input type="text" class="form-input target-input" data-id="${s.id}" value="${currentTarget > 0 ? currentTarget : ''}" inputmode="numeric" style="text-align:right; width:200px; font-weight:600; color:var(--text-primary);">
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;

        // Apply Rupiah formatting to all spawned inputs
        container.querySelectorAll('.target-input').forEach(input => {
            if (typeof ProfitCalculator !== 'undefined') {
                ProfitCalculator.setupRupiahInput(input);
            }
            // If there's an existing target, format it visually on load
            const val = parseInt(input.value.replace(/\D/g, '') || 0);
            if (val > 0) input.value = val.toLocaleString('id-ID');
        });
    }

    async function saveTargets() {
        const btn = document.getElementById('btnSaveTargetProfit');
        btn.textContent = 'Menyimpan...';
        btn.disabled = true;

        const inputs = document.querySelectorAll('.target-input');
        const shops = typeof ShopManager !== 'undefined' ? ShopManager.getShops() : [];
        
        for (const input of inputs) {
            const id = input.dataset.id;
            const val = parseInt(input.value.replace(/\D/g, '') || 0);
            
            const shop = shops.find(s => s.id === id);
            if (shop && shop.targetProfit !== val) {
                if (typeof ShopManager.updateShopTarget === 'function') {
                    await ShopManager.updateShopTarget(id, val);
                } else {
                    console.warn('ShopManager.updateShopTarget is not a function');
                }
            }
        }

        setTimeout(() => {
            btn.textContent = 'Simpan Target';
            btn.disabled = false;
            if (typeof showToast !== 'undefined') showToast('Target profit bulanan berhasil disimpan!', 'success');
            if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
        }, 500);
    }

    return { init, render };
})();
