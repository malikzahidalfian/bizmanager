/**
 * Shop Manager — Handles custom stores (toko) configuration across modules
 * Now supports platform-specific shops (Shopee, TikTok Shop, Lazada).
 */
const ShopManager = (() => {
    const STORAGE_KEY = 'sellersync_shops';
    let shops = [];

    // Default shops if never initialized
    const DEFAULT_SHOPS = [
        { id: 'ricko', name: "Ricko's Media Player", platform: 'shopee', initials: '🛒' },
        { id: 'malik', name: "Malik's Player", platform: 'tiktok', initials: '🎵' }
    ];

    async function init() {
        if (typeof StorageManager === 'undefined') {
            console.error('StorageManager is not loaded!');
            return;
        }

        try {
            const raw = await StorageManager.getItem(STORAGE_KEY);
            if (raw) {
                shops = JSON.parse(raw);
                // Migrate old shops without a designated platform to 'shopee'
                let migrated = false;
                shops.forEach(s => {
                    if (!s.platform) { s.platform = 'shopee'; migrated = true; }
                });
                if (migrated) await _save();
            } else {
                shops = [...DEFAULT_SHOPS];
                await _save();
            }
        } catch (e) {
            console.error('Error loading shops', e);
            shops = [...DEFAULT_SHOPS];
        }
    }

    async function _save() {
        await StorageManager.setItem(STORAGE_KEY, JSON.stringify(shops));
    }

    function getShops() {
        return shops;
    }

    function getShopsByPlatform(platform) {
        return shops.filter(s => s.platform === platform);
    }

    async function addShop(name, platform) {
        if (!name || !name.trim()) return null;
        const id = 'shop_' + Date.now();
        let initials = '🛒';
        if (platform === 'tiktok') initials = '🎵';
        if (platform === 'lazada') initials = '💙';

        const newShop = { id, name: name.trim(), platform, initials };
        shops.push(newShop);
        await _save();
        return newShop;
    }

    async function removeShop(id) {
        const idx = shops.findIndex(s => s.id === id);
        if (idx !== -1) {
            shops.splice(idx, 1);
            await _save();
            return true;
        }
        return false;
    }

    // --- SVG MARKETPLACE LOGOS ---
    function _getPlatformLogo(platform, size = 48) {
        const logos = {
            'shopee': `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="14" fill="#EE4D2D"/>
                <path d="M16 16v-3.5c0-4 3.5-7.5 8-7.5s8 3.5 8 7.5V16" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
                <path d="M9 16l2.5 24c.2 2 1.5 3 3.5 3h18c2 0 3.3-1 3.5-3L39 16H9z" fill="white"/>
                <path d="M28.5 25.5c0-1.5-1.2-2.3-3.2-2.8l-1.8-.5c-1.5-.4-2.2-1-2.2-2 0-1.1 1.2-1.8 2.8-1.8 1.6 0 2.8.6 2.8.6l1-2.5s-1.4-.8-3.8-.8c-3.2 0-5.4 1.8-5.4 4.5 0 2.5 1.7 3.5 4.3 4.2l1.6.4c1.8.5 2.4 1.2 2.4 2.2 0 1.3-1.4 2.1-3.2 2.1-2 0-3.6-1.1-3.6-1.1l-1 2.6s1.8 1.2 4.6 1.2c3.4 0 5.8-1.7 5.8-4.8z" fill="#EE4D2D"/>
            </svg>`,
            'tiktok': `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="14" fill="#010101"/>
                <g transform="translate(10, 8) scale(1.3)">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.09-1.03-1.67-.98-2.78-2.62-2.94-4.57-.05-1.42.06-2.84.44-4.22.6-2.12 2.27-3.72 4.39-4.16.89-.15 1.8-.21 2.7-.21.05 1.56.03 3.13.05 4.69-.67-.14-1.35-.19-2.03-.13-1.17.07-2.28.6-2.97 1.57-.68 1.01-.87 2.23-.52 3.39.37 1.25 1.34 2.16 2.58 2.44 1.17.27 2.4.07 3.39-.56.84-.52 1.36-1.33 1.51-2.31.14-1.07.13-2.16.14-3.24.01-3.66.01-7.32 0-10.98z" fill="#25F4EE" transform="translate(-1, 0)"/>
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.09-1.03-1.67-.98-2.78-2.62-2.94-4.57-.05-1.42.06-2.84.44-4.22.6-2.12 2.27-3.72 4.39-4.16.89-.15 1.8-.21 2.7-.21.05 1.56.03 3.13.05 4.69-.67-.14-1.35-.19-2.03-.13-1.17.07-2.28.6-2.97 1.57-.68 1.01-.87 2.23-.52 3.39.37 1.25 1.34 2.16 2.58 2.44 1.17.27 2.4.07 3.39-.56.84-.52 1.36-1.33 1.51-2.31.14-1.07.13-2.16.14-3.24.01-3.66.01-7.32 0-10.98z" fill="#FE2C55" transform="translate(1, 1)"/>
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.09-1.03-1.67-.98-2.78-2.62-2.94-4.57-.05-1.42.06-2.84.44-4.22.6-2.12 2.27-3.72 4.39-4.16.89-.15 1.8-.21 2.7-.21.05 1.56.03 3.13.05 4.69-.67-.14-1.35-.19-2.03-.13-1.17.07-2.28.6-2.97 1.57-.68 1.01-.87 2.23-.52 3.39.37 1.25 1.34 2.16 2.58 2.44 1.17.27 2.4.07 3.39-.56.84-.52 1.36-1.33 1.51-2.31.14-1.07.13-2.16.14-3.24.01-3.66.01-7.32 0-10.98z" fill="#FFFFFF"/>
                </g>
            </svg>`,
            'lazada': `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="14" fill="#0F146D"/>
                <path d="M26.5 35.8l-10.3-9c-2.8-2.5-3.6-6.6-1.5-9.6 1.8-2.6 5.5-3.3 8.3-1.5L24 16.2v17l2.5 2.6z" fill="#F47421"/>
                <path d="M21.5 35.8l10.3-9c2.8-2.5 3.6-6.6 1.5-9.6-1.8-2.6-5.5-3.3-8.3-1.5L24 16.2v17l-2.5 2.6z" fill="#F9A01B"/>
            </svg>`
        };
        return logos[platform] || logos['shopee'];
    }

    function _getPlatformConfig(platform) {
        const configs = {
            'shopee': { label: 'Shopee', gradient: 'linear-gradient(135deg, #ee4d2d, #ff6b4a)', color: '#ee4d2d', bgLight: 'rgba(238,77,45,0.08)' },
            'tiktok': { label: 'TikTok Shop', gradient: 'linear-gradient(135deg, #25F4EE, #FE2C55)', color: '#010101', bgLight: 'rgba(37,244,238,0.08)' },
            'lazada': { label: 'Lazada', gradient: 'linear-gradient(135deg, #0F146D, #1a237e)', color: '#0F146D', bgLight: 'rgba(15,20,109,0.08)' }
        };
        return configs[platform] || configs['shopee'];
    }

    // --- UI RENDER FOR PENGATURAN TOKO ---
    function renderShopManager(platform) {
        const container = document.getElementById('shopManagerContent');
        if (!container) return;

        const config = _getPlatformConfig(platform);
        const platformShops = getShopsByPlatform(platform);
        const logo = _getPlatformLogo(platform, 40);

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 24px;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="width:56px; height:56px; border-radius:16px; background:${config.bgLight}; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                        ${_getPlatformLogo(platform, 36)}
                    </div>
                    <div>
                        <h2 style="font-size:24px; font-weight:700; color:var(--text); margin-bottom:4px;">Toko ${config.label}</h2>
                        <p style="color:var(--text-muted); font-size:14px; margin:0;">Kelola daftar toko Anda yang terdaftar di ${config.label}.</p>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">
        `;

        platformShops.forEach(s => {
            html += `
                <div class="shop-card" style="position:relative; background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:28px 24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); transition:all 0.2s; text-align:center;">
                    <button style="position:absolute; top:12px; right:12px; background:rgba(239, 68, 68, 0.1); border:none; color:var(--red); width:28px; height:28px; border-radius:50%; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" 
                            onclick="ShopManager.confirmRemoveShop('${s.id}', '${platform}')" title="Hapus Toko">✕</button>
                    <div style="margin-bottom:14px; display:flex; align-items:center; justify-content:center;">
                        <div style="width:64px; height:64px; border-radius:18px; background:${config.bgLight}; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                            ${_getPlatformLogo(platform, 38)}
                        </div>
                    </div>
                    <div style="font-weight:700; font-size:16px; color:var(--text);">${escapeHtml(s.name)}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:6px; display:inline-flex; align-items:center; gap:4px; padding:3px 10px; background:rgba(0,0,0,0.04); border-radius:12px;">
                        <span style="width:6px; height:6px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                        Aktif
                    </div>
                </div>
            `;
        });

        // Add New Shop Card
        html += `
            <div class="shop-card-add" onclick="ShopManager.promptAddShop('${platform}')" style="background:transparent; border:2px dashed var(--border-color); border-radius:12px; padding:24px; cursor:pointer; transition:all 0.2s; text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:160px;">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--accent-gradient); color:white; display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:12px; box-shadow:0 4px 12px rgba(99, 102, 241, 0.3);">+</div>
                <div style="font-weight:600; font-size:15px; color:var(--text);">Tambah Toko Baru</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Klik untuk daftar toko ${config.label}</div>
            </div>
        </div>
        `;

        container.innerHTML = html;
        
        // Add hover effects dynamically
        container.querySelectorAll('.shop-card-add').forEach(el => {
            el.addEventListener('mouseover', () => { el.style.borderColor = 'var(--accent)'; el.style.background = 'rgba(99, 102, 241, 0.03)'; });
            el.addEventListener('mouseout', () => { el.style.borderColor = 'var(--border-color)'; el.style.background = 'transparent'; });
        });
        container.querySelectorAll('.shop-card').forEach(el => {
            el.addEventListener('mouseover', () => { el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; });
            el.addEventListener('mouseout', () => { el.style.transform = 'none'; el.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; });
        });
    }

    function _showAddShopModal(platform, onComplete) {
        const cfg = _getPlatformConfig(platform);
        const logoSvg = _getPlatformLogo(platform, 44);
        const logoBgSvg = _getPlatformLogo(platform, 90);

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; top:0; left:0; right:0; bottom:0;
            background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
            z-index:10000; display:flex; align-items:center; justify-content:center;
            opacity:0; transition:opacity 0.25s ease;
        `;

        overlay.innerHTML = `
            <div id="addShopModalBox" style="
                background:var(--bg-card, #1e1e2d); border:1px solid rgba(255,255,255,0.1);
                border-radius:20px; width:420px; max-width:90vw;
                box-shadow:0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
                transform:scale(0.9) translateY(20px); opacity:0;
                transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                overflow:hidden;
            ">
                <!-- Header with gradient -->
                <div style="
                    background:${cfg.gradient}; padding:28px 28px 24px;
                    position:relative; overflow:hidden;
                ">
                    <div style="position:absolute; top:-15px; right:-15px; opacity:0.12; transform:rotate(15deg);">${logoBgSvg}</div>
                    <div style="margin-bottom:10px; position:relative;">${logoSvg}</div>
                    <h3 style="margin:0; font-size:20px; font-weight:700; color:#fff; position:relative;">Tambah Toko ${cfg.label}</h3>
                    <p style="margin:6px 0 0; font-size:13px; color:rgba(255,255,255,0.8); position:relative;">Daftarkan toko baru Anda di platform ${cfg.label}</p>
                </div>

                <!-- Body -->
                <div style="padding:24px 28px 20px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:var(--text, #333); margin-bottom:8px;">
                        Nama Toko
                    </label>
                    <input type="text" id="addShopNameInput" placeholder="Contoh: Toko Saya Official" 
                        style="
                            width:100%; padding:14px 16px; border-radius:12px;
                            border:2px solid var(--border-color, rgba(0,0,0,0.1)); background:var(--bg, #f9fafb);
                            color:var(--text, #111); font-size:15px; font-weight:500;
                            outline:none; transition:all 0.2s ease;
                            box-sizing:border-box;
                        "
                        onfocus="this.style.borderColor='${cfg.color}'; this.style.boxShadow='0 0 0 4px ${cfg.color}25'"
                        onblur="this.style.borderColor='var(--border-color, rgba(0,0,0,0.1))'; this.style.boxShadow='none'"
                    >
                    <p style="margin:8px 0 0; font-size:11px; color:var(--text-muted, #666);">
                        💡 Gunakan nama yang mudah dikenali, misal nama toko di ${cfg.label}
                    </p>
                </div>

                <!-- Footer -->
                <div style="padding:0 28px 24px; display:flex; gap:10px; justify-content:flex-end;">
                    <button id="addShopCancelBtn" style="
                        padding:12px 24px; border-radius:12px; border:1px solid var(--border-color, rgba(0,0,0,0.15));
                        background:transparent; color:var(--text-muted, #555); font-size:14px; font-weight:600;
                        cursor:pointer; transition:all 0.2s;
                    ">Batal</button>
                    <button id="addShopSaveBtn" style="
                        padding:12px 28px; border-radius:12px; border:none;
                        background:${cfg.gradient}; color:#fff; font-size:14px; font-weight:700;
                        cursor:pointer; transition:all 0.2s;
                        box-shadow:0 4px 15px ${cfg.color}40;
                    ">Tambahkan</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const box = document.getElementById('addShopModalBox');
            if (box) { box.style.transform = 'scale(1) translateY(0)'; box.style.opacity = '1'; }
        });

        const input = document.getElementById('addShopNameInput');
        const saveBtn = document.getElementById('addShopSaveBtn');
        const cancelBtn = document.getElementById('addShopCancelBtn');

        // Auto-focus input
        setTimeout(() => input && input.focus(), 100);

        function closeModal() {
            const box = document.getElementById('addShopModalBox');
            if (box) { box.style.transform = 'scale(0.9) translateY(20px)'; box.style.opacity = '0'; }
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 250);
        }

        async function doSave() {
            const name = input.value.trim();
            if (!name) {
                input.style.borderColor = '#ef4444';
                input.style.boxShadow = '0 0 0 4px rgba(239,68,68,0.2)';
                input.placeholder = 'Nama toko harus diisi!';
                input.focus();
                return;
            }

            // Disable button while saving
            saveBtn.textContent = '⏳ Menyimpan...';
            saveBtn.disabled = true;

            await addShop(name, platform);
            closeModal();
            if (typeof showToast !== 'undefined') showToast(`Toko "${name}" berhasil ditambahkan! 🎉`, 'success');
            if (onComplete) onComplete();
        }

        saveBtn.addEventListener('click', doSave);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        // Keyboard: Enter to save, Escape to close
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSave();
            if (e.key === 'Escape') closeModal();
        });

        // Hover effects
        saveBtn.addEventListener('mouseover', () => { saveBtn.style.transform = 'translateY(-1px)'; saveBtn.style.boxShadow = `0 6px 20px ${cfg.color}50`; });
        saveBtn.addEventListener('mouseout', () => { saveBtn.style.transform = 'none'; saveBtn.style.boxShadow = `0 4px 15px ${cfg.color}40`; });
        cancelBtn.addEventListener('mouseover', () => { cancelBtn.style.background = 'rgba(255,255,255,0.06)'; });
        cancelBtn.addEventListener('mouseout', () => { cancelBtn.style.background = 'transparent'; });
    }

    async function promptAddShop(platform) {
        _showAddShopModal(platform, () => renderShopManager(platform));
    }

    async function confirmRemoveShop(id, platform) {
        const shop = shops.find(s => s.id === id);
        if (!shop) return;
        const shopName = shop.name;

        // Step 1: First confirmation
        const isOk = await AppModal.confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus toko "${shopName}" secara PERMANEN.\n\nSemua data produk yang terkait dengan toko ini mungkin akan kehilangan referensinya.\n\nLanjutkan?`, 'Hapus Toko', 'danger');
        if (!isOk) return;

        // Step 2: Type shop name to confirm
        const typed = await AppModal.prompt(`Untuk mengonfirmasi penghapusan, ketik nama toko:\n\n"${shopName}"`, '', 'Konfirmasi Nama Toko');
        if (!typed || typed.trim().toLowerCase() !== shopName.trim().toLowerCase()) {
            if (typed !== null && typeof showToast !== 'undefined') showToast('Nama toko tidak cocok. Penghapusan dibatalkan.', 'error');
            return;
        }

        const ok = await removeShop(id);
        if (ok) {
            renderShopManager(platform);
            if(typeof showToast !== 'undefined') showToast(`Toko "${shopName}" berhasil dihapus!`, 'success');
        }
    }

    // --- RENDER SHOP LIST FOR IMPORT MODULES (no delete/add buttons) ---
    function renderShopList(containerId, onSelectCallback) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        shops.forEach(s => {
            const cfg = _getPlatformConfig(s.platform || 'shopee');
            html += `
                <div class="shop-card" style="position:relative; background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:24px; cursor:pointer; transition:all 0.2s; text-align:center;"
                     onclick="${onSelectCallback}('${s.id}')">
                    <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:center;">
                        <div style="width:56px; height:56px; border-radius:16px; background:${cfg.bgLight}; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.06);">
                            ${_getPlatformLogo(s.platform || 'shopee', 34)}
                        </div>
                    </div>
                    <div style="font-weight:700; font-size:15px; color:var(--text);">${escapeHtml(s.name)}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">Klik untuk import</div>
                </div>
            `;
        });

        container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px;">${html}</div>`;
    }

    async function triggerAdd(containerId, onSelectCallback) {
        _showAddShopModal('shopee', () => renderShopList(containerId, onSelectCallback));
    }

    async function triggerRemove(id, containerId, onSelectCallback) {
        const ok = await AppModal.confirm('Yakin ingin menghapus toko ini?', 'Hapus Toko', 'danger');
        if (ok) {
            const removed = await removeShop(id);
            if (removed) {
                renderShopList(containerId, onSelectCallback);
                if(typeof showToast !== 'undefined') showToast(`Toko dihapus!`, 'success');
            }
        }
    }

    async function updateShopTarget(id, targetVal) {
        const shop = shops.find(s => s.id === id);
        if (shop) {
            shop.targetProfit = targetVal;
            await _save();
            return true;
        }
        return false;
    }

    return {
        init,
        getShops,
        getShopsByPlatform,
        addShop,
        removeShop,
        getPlatformLogo: _getPlatformLogo,
        renderShopManager,
        promptAddShop,
        confirmRemoveShop,
        renderShopList,
        triggerAdd,
        triggerRemove,
        updateShopTarget
    };
})();
