const AliasManager = (() => {
    const STORAGE_KEY = 'bizmanager_aliases';
    let aliases = {};

    async function init() {
        try {
            const data = await StorageManager.getItem(STORAGE_KEY);
            aliases = data ? JSON.parse(data) : {};
            console.log(`🔗 AliasManager loaded ${Object.keys(aliases).length} mappings`);
        } catch(e) { aliases = {}; }
    }

    function generateKey(productName, variationName) {
        return `${productName || ''} | ${variationName || ''}`.toLowerCase().trim();
    }

    function getAlias(productName, variationName) {
        const key = generateKey(productName, variationName);
        return aliases[key] || null;
    }

    async function saveAlias(productName, variationName, targetProductId, targetVariantName) {
        const key = generateKey(productName, variationName);
        aliases[key] = {
            productId: targetProductId,
            variantName: targetVariantName || null
        };
        await StorageManager.setItem(STORAGE_KEY, JSON.stringify(aliases));
        console.log(`🔗 Saved Alias: "${key}" -> ${targetProductId} / ${targetVariantName}`);
    }

    function resolveViaAlias(productName, variationName) {
        const mapping = getAlias(productName, variationName);
        if (!mapping) return null;

        const products = ProductList.getProducts();
        const p = products.find(prod => String(prod.id) === String(mapping.productId));
        
        if (p) {
            if (mapping.variantName) {
                const v = (p.variations || []).find(v => String(v.name).trim().toLowerCase() === String(mapping.variantName).trim().toLowerCase());
                if (v) return { modal: v.modal || 0, variationName: v.name, isMapped: true };
            }
            
            // Fallback to product modal first
            let fallbackModal = p.modal || 0;
            // If product modal is 0 or missing, borrow from the first variation (Pukul Rata approximation)
            if (!fallbackModal && p.variations && p.variations.length > 0) {
                fallbackModal = p.variations[0].modal || 0;
            }
            
            return { modal: fallbackModal, variationName: p.name, isMapped: true };
        }
        return null;
    }

    function getAllAliases() {
        return aliases;
    }

    // ---- UI DIALOG FOR MAPPING ----
    function showMappingDialog(unmappedItems, onComplete) {
        // Deduplicate
        const uniqueKeys = new Set();
        const uniqueItems = [];
        unmappedItems.forEach(item => {
            if (item.unmappable) return; // Cannot map items without names
            const key = generateKey(item.name, item.variation);
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                uniqueItems.push(item);
            }
        });

        if (uniqueItems.length === 0) {
            AppModal.alert('Semua item sudah dipetakan atau tidak memiliki nama yang bisa dipetakan.', 'Alias Manager', 'info');
            return;
        }

        // Build Product Dropdown Options
        const products = ProductList.getProducts();
        let optionsHtml = '<option value="">-- Pilih Produk Master --</option>';
        products.forEach(p => {
            optionsHtml += `<optgroup label="${escapeHtml(p.name)}">`;
            // Always allow mapping to the general product if Shopee drops variation info
            optionsHtml += `<option value="${p.id}||" style="font-weight:bold;">📦 ${escapeHtml(p.name)} (Pukul Rata / Umum)</option>`;
            
            if (p.variations && p.variations.length > 0) {
                p.variations.forEach(v => {
                    optionsHtml += `<option value="${p.id}||${escapeHtml(v.name)}">↳ ${escapeHtml(v.name)} (Modal: ${v.modal||0})</option>`;
                });
            }
            optionsHtml += `</optgroup>`;
        });

        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit;';
        
        // Create modal content
        let html = `
            <div style="background:#1e1e2d;width:600px;max-width:90%;max-height:85vh;border-radius:12px;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);">
                <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:16px;color:#fff;">🔗 Petakan ${uniqueItems.length} Produk Baru</h3>
                    <button id="aliasMapClose" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">&times;</button>
                </div>
                <div style="padding:20px;overflow-y:auto;flex:1;">
                    <p style="font-size:13px;color:var(--text-muted);margin-top:0;margin-bottom:16px;">
                        Produk berikut tidak dikenali. Pilih produk dari database Anda agar sistem bisa mengingatnya (100% Akurat).
                    </p>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="border-bottom:2px solid rgba(255,255,255,0.1);text-align:left;color:var(--text-muted);">
                                <th style="padding-bottom:8px;">Nama di Shopee/TikTok</th>
                                <th style="padding-bottom:8px;width:50%;">Peta ke Produk Master</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        uniqueItems.forEach((item, i) => {
            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:10px 0;">
                        <div style="font-weight:600;color:var(--text);margin-bottom:4px;">${escapeHtml(item.name || '-')}</div>
                        <div style="color:var(--text-muted);font-size:11px;">Variasi: ${escapeHtml(item.variation || '-')}</div>
                        <div style="color:var(--yellow);font-size:11px;">Harga: ${item.price}</div>
                    </td>
                    <td style="padding:10px 0;">
                        <select id="aliasMap_${i}" style="width:100%;padding:8px;border-radius:6px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:13px;">
                            ${optionsHtml}
                        </select>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
                <div style="padding:16px 20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:flex-end;gap:10px;">
                    <button id="aliasMapCancel" style="padding:8px 16px;border-radius:6px;border:none;background:rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:13px;">Batal</button>
                    <button id="aliasMapSave" style="padding:8px 16px;border-radius:6px;border:none;background:var(--blue);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Simpan Pemetaan</button>
                </div>
            </div>
        `;

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        const closeBtn = document.getElementById('aliasMapClose');
        const cancelBtn = document.getElementById('aliasMapCancel');
        const saveBtn = document.getElementById('aliasMapSave');

        function closeDialog() { document.body.removeChild(overlay); }

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        saveBtn.addEventListener('click', async () => {
            let saved = 0;
            saveBtn.textContent = 'Menyimpan...';
            saveBtn.disabled = true;

            for (let i = 0; i < uniqueItems.length; i++) {
                const select = document.getElementById(`aliasMap_${i}`);
                if (select && select.value) {
                    const parts = select.value.split('||');
                    const pId = parts[0];
                    const vName = parts[1] || '';
                    await saveAlias(uniqueItems[i].name, uniqueItems[i].variation, pId, vName);
                    saved++;
                }
            }

            closeDialog();
            if (saved > 0) {
                if (window.showToast) window.showToast(`✅ ${saved} produk berhasil dipetakan!`, 'success');
                if (onComplete) onComplete();
            }
        });
    }

    return { init, getAlias, saveAlias, resolveViaAlias, getAllAliases, generateKey, showMappingDialog };
})();
