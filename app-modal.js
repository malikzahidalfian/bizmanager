const AppModal = (() => {
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
            z-index: 10000; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.2s ease; padding: 16px;
        `;
        document.body.appendChild(overlay);
        // Force repaint
        overlay.offsetHeight;
        overlay.style.opacity = '1';
        return overlay;
    }

    function createBox() {
        const box = document.createElement('div');
        box.style.cssText = `
            background: var(--bg-card, #ffffff);
            border-radius: 16px; width: 100%; max-width: 400px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px var(--border-color, rgba(0,0,0,0.05));
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            transform: scale(0.95) translateY(10px); opacity: 0;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            overflow: hidden; display: flex; flex-direction: column;
        `;
        return box;
    }

    function closeOverlay(overlay, box, callback) {
        if (box) {
            box.style.transform = 'scale(0.95) translateY(10px)';
            box.style.opacity = '0';
        }
        if (overlay) {
            overlay.style.opacity = '0';
        }
        setTimeout(() => {
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (callback) callback();
        }, 200);
    }

    function getIconHtml(type) {
        if (type === 'danger' || type === 'error') {
            return `<div style="width:48px; height:48px; border-radius:50%; background:rgba(239, 68, 68, 0.1); color:var(--red, #ef4444); display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:16px;">⚠️</div>`;
        }
        if (type === 'info' || type === 'prompt') {
            return `<div style="width:48px; height:48px; border-radius:50%; background:rgba(59, 130, 246, 0.1); color:var(--blue, #3b82f6); display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:16px;">ℹ️</div>`;
        }
        return '';
    }

    async function alert(message, title = 'Perhatian') {
        return new Promise(resolve => {
            const overlay = createOverlay();
            const box = createBox();
            
            box.innerHTML = `
                <div style="padding: 24px;">
                    ${getIconHtml('info')}
                    <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: var(--text-primary, #1e1b4b);">${title}</h3>
                    <div style="font-size: 14px; color: var(--text-secondary, #475569); line-height: 1.5; white-space: pre-wrap;">${message}</div>
                </div>
                <div style="padding: 16px 24px; background: rgba(0,0,0,0.02); border-top: 1px solid var(--border-color, #e2e8f0); display: flex; justify-content: flex-end;">
                    <button id="am-ok-btn" style="padding: 10px 20px; border-radius: 8px; border: none; background: var(--accent, #6366f1); color: white; font-weight: 600; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s;">Oke</button>
                </div>
            `;
            
            overlay.appendChild(box);
            box.offsetHeight;
            box.style.transform = 'scale(1) translateY(0)';
            box.style.opacity = '1';

            const btn = box.querySelector('#am-ok-btn');
            btn.focus();
            
            const handleClose = () => closeOverlay(overlay, box, () => resolve(true));
            
            btn.addEventListener('click', handleClose);
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') handleClose();
            });
        });
    }

    async function confirm(message, title = 'Konfirmasi', type = 'danger') {
        return new Promise(resolve => {
            const overlay = createOverlay();
            const box = createBox();
            
            const isDanger = type === 'danger';
            const btnBg = isDanger ? 'var(--red, #ef4444)' : 'var(--accent, #6366f1)';
            
            box.innerHTML = `
                <div style="padding: 24px;">
                    ${getIconHtml(isDanger ? 'danger' : 'info')}
                    <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: var(--text-primary, #1e1b4b);">${title}</h3>
                    <div style="font-size: 14px; color: var(--text-secondary, #475569); line-height: 1.5; white-space: pre-wrap;">${message}</div>
                </div>
                <div style="padding: 16px 24px; background: rgba(0,0,0,0.02); border-top: 1px solid var(--border-color, #e2e8f0); display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="am-cancel-btn" style="padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: transparent; color: var(--text-secondary, #475569); font-weight: 600; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s;">Batal</button>
                    <button id="am-yes-btn" style="padding: 10px 20px; border-radius: 8px; border: none; background: ${btnBg}; color: white; font-weight: 600; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s;">Ya, Lanjutkan</button>
                </div>
            `;
            
            overlay.appendChild(box);
            box.offsetHeight;
            box.style.transform = 'scale(1) translateY(0)';
            box.style.opacity = '1';

            const btnCancel = box.querySelector('#am-cancel-btn');
            const btnYes = box.querySelector('#am-yes-btn');
            btnCancel.focus();
            
            const handleResult = (val) => closeOverlay(overlay, box, () => resolve(val));
            
            btnCancel.addEventListener('click', () => handleResult(false));
            btnYes.addEventListener('click', () => handleResult(true));
            
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') handleResult(false);
            });
        });
    }

    async function prompt(message, defaultValue = '', title = 'Input Diperlukan') {
        return new Promise(resolve => {
            const overlay = createOverlay();
            const box = createBox();
            
            box.innerHTML = `
                <div style="padding: 24px;">
                    ${getIconHtml('prompt')}
                    <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: var(--text-primary, #1e1b4b);">${title}</h3>
                    <div style="font-size: 14px; color: var(--text-secondary, #475569); line-height: 1.5; margin-bottom: 16px; white-space: pre-wrap;">${message}</div>
                    <input type="text" id="am-input-val" value="${defaultValue.replace(/"/g, '&quot;')}" style="width: 100%; padding: 12px 16px; border-radius: 8px; border: 2px solid var(--border-color, #e2e8f0); background: var(--bg-primary, #f0f4f8); color: var(--text-primary, #1e1b4b); font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box;">
                </div>
                <div style="padding: 16px 24px; background: rgba(0,0,0,0.02); border-top: 1px solid var(--border-color, #e2e8f0); display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="am-cancel-btn" style="padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: transparent; color: var(--text-secondary, #475569); font-weight: 600; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s;">Batal</button>
                    <button id="am-yes-btn" style="padding: 10px 20px; border-radius: 8px; border: none; background: var(--accent, #6366f1); color: white; font-weight: 600; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s;">Konfirmasi</button>
                </div>
            `;
            
            overlay.appendChild(box);
            box.offsetHeight;
            box.style.transform = 'scale(1) translateY(0)';
            box.style.opacity = '1';

            const input = box.querySelector('#am-input-val');
            input.focus();
            if (input.value) input.select();
            
            const btnCancel = box.querySelector('#am-cancel-btn');
            const btnYes = box.querySelector('#am-yes-btn');
            
            // Add focus styles dynamically
            input.addEventListener('focus', () => input.style.borderColor = 'var(--accent, #6366f1)');
            input.addEventListener('blur', () => input.style.borderColor = 'var(--border-color, #e2e8f0)');

            const handleResult = (val) => closeOverlay(overlay, box, () => resolve(val));
            
            btnCancel.addEventListener('click', () => handleResult(null));
            btnYes.addEventListener('click', () => handleResult(input.value));
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleResult(input.value);
                if (e.key === 'Escape') handleResult(null);
            });
        });
    }

    return { alert, confirm, prompt };
})();
