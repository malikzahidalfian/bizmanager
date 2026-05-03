// ========================================
// DAILY ROUTINE (TASK TRACKER) MODULE
// ========================================

const DailyTasks = (() => {
    const STORAGE_KEY = 'bizmanager_daily_tasks';
    let state = {
        lastDate: '',
        templates: [
            { id: 'tpl_1', text: 'Cek dan balas semua chat', category: 'toko' },
            { id: 'tpl_2', text: 'Proses dan cetak resi pesanan masuk', category: 'toko' },
            { id: 'tpl_3', text: 'Cek stok barang & laporan penjualan', category: 'toko' },
            { id: 'tpl_4', text: 'Riset 3 ide konten TikTok/Shopee Video', category: 'affiliate' },
            { id: 'tpl_5', text: 'Rekam 2 footage video produk', category: 'affiliate' },
            { id: 'tpl_6', text: 'Edit & Upload 1 konten VT', category: 'affiliate' }
        ],
        history: {} // { 'YYYY-MM-DD': [ {id, text, category, done, isTemplate} ] }
    };

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    // Utilities
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' })[s];
        });
    }

    function getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    async function init() {
        if (typeof StorageManager !== 'undefined') {
            try {
                const stored = await StorageManager.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.history && parsed.templates) {
                        state = parsed;
                        if (!state.oneOffs) state.oneOffs = [];
                        if (!state.categories) {
                            state.categories = [
                                { id: 'toko', name: '🛒 Operasional Toko' },
                                { id: 'affiliate', name: '🎥 Konten Affiliate' },
                                { id: 'lainnya', name: '📦 Lainnya' }
                            ];
                        }
                    }
                }
            } catch(e) {}
        }

        // Kalau belum ada data atau kategori kosong dari fresh install
        if (!state.categories) {
            state.categories = [
                { id: 'toko', name: '🛒 Operasional Toko' },
                { id: 'affiliate', name: '🎥 Konten Affiliate' },
                { id: 'lainnya', name: '📦 Lainnya' }
            ];
        }

        checkNewDay();
        render();
    }

    function save() {
        if (typeof StorageManager !== 'undefined') {
            StorageManager.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    }

    function getDatesOfCurrentWeek() {
        const d = new Date();
        const day = d.getDay(); 
        const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1); 
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const tempDate = new Date(d.getFullYear(), d.getMonth(), diffToMonday + i);
            const str = `${tempDate.getFullYear()}-${String(tempDate.getMonth()+1).padStart(2,'0')}-${String(tempDate.getDate()).padStart(2,'0')}`;
            dates.push(str);
        }
        return dates;
    }

    function checkNewDay() {
        const today = getTodayStr();
        if (state.lastDate !== today) {
            const weekDates = getDatesOfCurrentWeek();
            const dayNamesArr = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            
            weekDates.forEach((dateStr, i) => {
                if (!state.history[dateStr]) {
                    const dName = dayNamesArr[i];
                    const tasks = state.templates.filter(t => {
                        if (!t.days || t.days.length === 0 || t.days.includes('Semua')) return true;
                        return t.days.includes(dName);
                    }).map(t => ({
                        id: 'task_' + dateStr + '_' + Math.random().toString(36).substr(2,4),
                        text: t.text,
                        category: t.category,
                        done: false,
                        isTemplate: true
                    }));
                    state.history[dateStr] = tasks;
                }
            });
            state.lastDate = today;
            save();
            
            // Tampilkan kembali elemen konfeti / reset UI saat hari baru
            const conf = document.getElementById('dtConfetti');
            if(conf) {
                conf.style.opacity = '0';
                conf.style.transform = 'scale(0.5)';
            }
        }
    }

    // ---- RENDER ----
    function render() {
        renderHeader();
        updateCategoryDropdown();
        renderLists();
        renderProgress();
        renderCalendar();
    }

    function renderHeader() {
        const el = document.getElementById('dtCurrentDate');
        if (!el) return;
        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        el.textContent = '📅 ' + new Date().toLocaleDateString('id-ID', opts);
    }

    function renderLists() {
        const grid = document.getElementById('dtWeeklyGrid');
        const oneOffList = document.getElementById('dtListOneOff');
        if (!grid || !oneOffList) return;

        const weekDates = getDatesOfCurrentWeek();
        const dayNamesArr = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        const today = getTodayStr();
        
        const pastelColors = [
            { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', dot: '#3b82f6', badgeBg: '#dbeafe' }, // Blue
            { bg: '#fdf4ff', border: '#f5d0fe', text: '#86198f', dot: '#d946ef', badgeBg: '#fae8ff' }, // Fuchsia
            { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#f59e0b', badgeBg: '#fef3c7' }, // Amber
            { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', dot: '#22c55e', badgeBg: '#dcfce7' }, // Green
            { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', dot: '#a855f7', badgeBg: '#f3e8ff' }, // Purple
            { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', dot: '#f43f5e', badgeBg: '#ffe4e6' }, // Rose
            { bg: '#fdf8f6', border: '#fed7aa', text: '#c2410c', dot: '#f97316', badgeBg: '#ffedd5' }  // Orange
        ];
        
        let gridHtml = '';
        weekDates.forEach((dateStr, i) => {
            const tasks = state.history[dateStr] || [];
            const isToday = dateStr === today;
            const p = pastelColors[i % pastelColors.length];
            
            const cardBg = `background:${p.bg}; border:1px solid ${isToday ? p.dot : p.border}; box-shadow:${isToday ? '0 0 0 2px '+p.border : '0 2px 10px rgba(0,0,0,0.03)'}; border-top:${isToday ? '4px solid '+p.dot : '1px solid '+p.border};`;
            const titleColor = `color:${p.text}; font-weight:800;`;

            gridHtml += `
            <div style="min-width:260px; max-width:280px; flex-shrink:0; border-radius:16px; padding:12px 16px; ${cardBg}">
                <div style="font-size:15px; margin-bottom:12px; text-align:center; padding-bottom:8px; border-bottom:1px dashed ${p.border}; ${titleColor}">${dayNamesArr[i]} ${isToday ? '✨' : ''}</div>
                <div style="display:flex; flex-direction:column; gap:4px; max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
                    ${tasks.map(t => createTaskHtml(t, dateStr)).join('')}
                </div>
                ${tasks.length === 0 ? `<div style="font-size:12px; color:${p.text}; opacity:0.6; text-align:center; padding:12px 10px; font-style:italic;">Belum ada rutinitas</div>` : ''}
            </div>
            `;
        });
        grid.innerHTML = gridHtml;
        
        // Render One-Offs
        // Render One-Offs
        const oneOffs = state.oneOffs || [];
        if (oneOffs.length === 0) {
            oneOffList.innerHTML = '<div style="font-size:13px; color:var(--text-muted); font-style:italic;">Belum ada tugas tambahan.</div>';
        } else {
            let offHtml = '';
            
            // Render category groups
            (state.categories || []).forEach((cat, idx) => {
                const catOneOffs = oneOffs.filter(t => t.category === cat.id);
                if (catOneOffs.length > 0) {
                    const p = pastelColors[idx % pastelColors.length];
                    offHtml += `
                    <div style="min-width:300px; max-width:300px; flex-shrink:0; background:${p.bg}; border-radius:16px; padding:16px; border:1px solid ${p.border}; scroll-snap-align:start; box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                        <div style="font-size:15px; font-weight:700; color:${p.text}; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="width:10px; height:10px; border-radius:50%; background:${p.dot}; box-shadow:0 0 0 3px ${p.badgeBg};"></div>
                                <span>${cat.name}</span>
                            </div>
                            <span style="font-size:12px; font-weight:700; background:${p.badgeBg}; color:${p.text}; padding:2px 10px; border-radius:12px;">${catOneOffs.length}</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px; max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
                            ${catOneOffs.map(t => createOneOffHtml(t)).join('')}
                        </div>
                    </div>`;
                }
            });
            
            // Render orphan / unknown tasks
            const mappedIds = (state.categories || []).map(c => c.id);
            const orphanOneOffs = oneOffs.filter(t => !mappedIds.includes(t.category));
            if (orphanOneOffs.length > 0) {
                offHtml += `
                <div style="min-width:300px; max-width:300px; flex-shrink:0; background:#ffffff; border-radius:16px; padding:16px; border:1px dashed #cbd5e1; scroll-snap-align:start;">
                    <div style="font-size:15px; font-weight:700; color:#64748b; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="width:8px; height:8px; border-radius:50%; background:#94a3b8;"></div>
                            <span>📦 Lainnya</span>
                        </div>
                        <span style="font-size:12px; font-weight:600; background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:12px;">${orphanOneOffs.length}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
                        ${orphanOneOffs.map(t => createOneOffHtml(t)).join('')}
                    </div>
                </div>`;
            }

            oneOffList.innerHTML = offHtml;
        }
    }

    function createTaskHtml(t, dateStr) {
        return `
        <div style="position:relative; display:flex; align-items:flex-start; gap:10px; padding:8px 10px; border-radius:8px; transition:all 0.2s; background: ${t.done ? 'var(--bg-hover)' : 'transparent'}; margin-bottom:4px;" onmouseover="this.style.background='var(--bg-hover)'; Array.from(this.querySelectorAll('.btn-action')).forEach(b=>b.style.opacity='1')" onmouseout="this.style.background='${t.done ? 'var(--bg-hover)' : 'transparent'}'; Array.from(this.querySelectorAll('.btn-action')).forEach(b=>b.style.opacity='0')">
            <input type="checkbox" ${t.done ? 'checked' : ''} onclick="DailyTasks.toggleTask('${t.id}', '${dateStr}')" style="width:18px;height:18px;cursor:pointer;margin-top:2px;accent-color:var(--accent);">
            <span style="flex:1; font-size:13.5px; line-height:1.4; font-weight: ${t.done ? '400' : '500'}; ${t.done ? 'text-decoration:line-through;color:var(--text-muted);' : 'color:var(--text-primary);'}">
                ${escapeHtml(t.text)}
            </span>
            <div style="display:flex; gap:2px;">
                <button class="btn-action" onclick="DailyTasks.editTask('${t.id}', '${dateStr}')" style="background:none;border:none;color:#6366f1;cursor:pointer;font-size:14px;padding:0 4px; opacity:0; transition:0.2s;" title="Edit tugas ini">✏️</button>
                <button class="btn-action" onclick="DailyTasks.deleteTask('${t.id}', '${dateStr}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 4px; opacity:0; transition:0.2s;" title="Hapus tugas rutin khusus hari ini">✕</button>
            </div>
        </div>`;
    }

    function createOneOffHtml(t) {
        let icon = '📌';
        const bg = t.done ? 'transparent' : '#ffffff';
        const opacity = t.done ? '0.6' : '1';
        const border = t.done ? '1px solid transparent' : '1px solid #e2e8f0';
        const shadow = t.done ? 'none' : '0 2px 6px rgba(0,0,0,0.02)';
        
        return `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; margin-bottom:6px; border:${border}; border-radius:12px; background: ${bg}; opacity: ${opacity}; transition:all 0.2s; box-shadow: ${shadow};">
            <input type="checkbox" ${t.done ? 'checked' : ''} onclick="DailyTasks.toggleOneOff('${t.id}')" style="width:20px;height:20px;cursor:pointer;flex-shrink:0;accent-color:var(--accent);">
            <div style="font-size:16px; margin-top:-2px;">${icon}</div>
            <span style="flex:1; font-size:14px; line-height:1.4; font-weight: ${t.done ? '400' : '500'}; ${t.done ? 'text-decoration:line-through;color:var(--text-muted);' : 'color:var(--text-primary);'} transition:all 0.2s;">
                ${escapeHtml(t.text)}
            </span>
            <div style="display:flex; gap:2px; flex-shrink:0;">
                <button onclick="DailyTasks.editOneOff('${t.id}')" style="background:none;border:none;color:#6366f1;cursor:pointer;font-size:16px;padding:4px; opacity:0.3; transition:0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.3'" title="Edit tugas ekstra">✏️</button>
                <button onclick="DailyTasks.deleteOneOff('${t.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:4px; opacity:0.3; transition:0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.3'" title="Hapus tugas ekstra">✕</button>
            </div>
        </div>`;
    }

    function renderProgress() {
        const today = getTodayStr();
        const tasks = state.history[today] || [];
        const total = tasks.length;
        const done = tasks.filter(t => t.done).length;
        
        let pct = 0;
        if (total > 0) pct = Math.round((done / total) * 100);

        const txt = document.getElementById('dtProgressText');
        const bar = document.getElementById('dtProgressBar');
        const conf = document.getElementById('dtConfetti');

        if(txt) txt.textContent = `${done} / ${total} (${pct}%)`;
        if(bar) bar.style.width = pct + '%';
        
        if(conf) {
            if(pct === 100 && total > 0) {
                conf.style.opacity = '1';
                conf.style.transform = 'scale(1.2)';
            } else {
                conf.style.opacity = '0';
                conf.style.transform = 'scale(0.5)';
            }
        }
        
        // Update menu badge if not 100%
        if(typeof TaskTracker !== 'undefined' && TaskTracker.updateOverdueBadge) {
            TaskTracker.updateOverdueBadge(total - done);
        }
    }

    // ---- CALENDAR STREAK ----
    function renderCalendar() {
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const labelEl = document.getElementById('dtMonthLabel');
        if (labelEl) labelEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startDay = (firstDay.getDay() + 6) % 7; 

        const todayStr = getTodayStr();
        let html = '';

        // prev month formatting
        const prevMonthLast = new Date(currentYear, currentMonth, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            html += `<div class="cal-day other-month"><span class="cal-day-num">${prevMonthLast - i}</span></div>`;
        }

        // this month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            
            // calculate color based on history
            const historyDay = state.history[dateStr] || [];
            let colorSty = '';
            let emoji = '';
            if (historyDay.length > 0) {
                const total = historyDay.length;
                const done = historyDay.filter(t => t.done).length;
                const pct = done / total;
                if (pct === 1) {
                    colorSty = 'background:rgba(34,197,94,0.15); border:1px solid var(--green);';
                    emoji = '<div style="font-size:12px;margin-top:2px;">🔥</div>';
                } else if (pct > 0) {
                    colorSty = 'background:rgba(234,179,8,0.1); border:1px solid #eab308;';
                } else {
                    colorSty = 'background:var(--bg-hover);';
                }
            }

            html += `<div class="cal-day${isToday ? ' today' : ''}" style="${colorSty} display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <span class="cal-day-num" style="align-self:flex-start; margin-left:4px; margin-top:4px;">${d}</span>
                ${emoji}
            </div>`;
        }

        const daysContainer = document.getElementById('dtCalendarDays');
        if(daysContainer) daysContainer.innerHTML = html;
    }

    function prevMonth() {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    }
    function nextMonth() {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    }

    // ---- ACTIONS ----
    function toggleTask(id, dateStr) {
        if (!dateStr) dateStr = getTodayStr();
        if (!state.history[dateStr]) return;
        const t = state.history[dateStr].find(x => x.id === id);
        if(t) {
            t.done = !t.done;
            save();
            renderLists();
            renderProgress();
            renderCalendar(); 
        }
    }
    
    function toggleOneOff(id) {
        const t = state.oneOffs.find(x => x.id === id);
        if(t) {
            t.done = !t.done;
            save();
            renderLists();
        }
    }
    
    async function deleteOneOff(id) {
        const t = state.oneOffs.find(x => x.id === id);
        if(!t) return;
        const ok = typeof AppModal !== 'undefined' ? await AppModal.confirm(`Hapus tugas ekstra "${t.text}"?`, 'Hapus', 'danger') : confirm('Hapus?');
        if(!ok) return;
        state.oneOffs = state.oneOffs.filter(x => x.id !== id);
        save();
        renderLists();
    }

    async function editOneOff(id) {
        const t = state.oneOffs.find(x => x.id === id);
        if(!t) return;
        const newText = typeof AppModal !== 'undefined' ? await AppModal.prompt('Edit tugas ekstra:', t.text, 'Edit Tugas') : prompt('Edit tugas ekstra:', t.text);
        if(newText !== null && newText.trim() !== '') {
            t.text = newText.trim();
            save();
            renderLists();
        }
    }

    async function editTask(id, dateStr) {
        if (!dateStr) dateStr = getTodayStr();
        if (!state.history[dateStr]) return;
        const t = state.history[dateStr].find(x => x.id === id);
        if(!t) return;
        
        const newText = typeof AppModal !== 'undefined' ? await AppModal.prompt('Edit tugas (perubahan hanya untuk hari ini jika tugas rutin):', t.text, 'Edit Tugas') : prompt('Edit tugas:', t.text);
        if(newText !== null && newText.trim() !== '') {
            t.text = newText.trim();
            save();
            renderLists();
        }
    }

    function saveInlineOneOffTask() {
        const inputEl = document.getElementById('dtInlineAddInput');
        if (!inputEl) return;
        const text = inputEl.value.trim();
        if(!text) return;
        
        const catEl = document.getElementById('dtInlineAddCategory');
        const cat = catEl ? catEl.value : 'lainnya';

        state.oneOffs.push({
            id: 'oneoff_' + Date.now(),
            text: text,
            category: cat,
            done: false
        });
        save();
        inputEl.value = '';
        renderLists();
    }

    async function deleteTask(id, dateStr) {
        if (!dateStr) dateStr = getTodayStr();
        if (!state.history[dateStr]) return;
        const t = state.history[dateStr].find(x => x.id === id);
        if(!t) return;
        
        if (t.isTemplate) {
            const ok = typeof AppModal !== 'undefined' ? await AppModal.confirm(`Hapus jadwal rutin "${t.text}" ini secara permanen dari daftar mingguan Anda?`, 'Hapus Permanen', 'danger') : confirm('Hapus Permanen?');
            if(!ok) return;
            // 1. Delete from blueprint templates
            state.templates = state.templates.filter(tpl => !(tpl.text === t.text && tpl.category === t.category));
            // 2. Synchronize schedule globally
            syncTemplatesToWeek();
        } else {
            const ok = typeof AppModal !== 'undefined' ? await AppModal.confirm(`Hapus tugas "${t.text}" khusus dari riwayat hari ini?`, 'Hapus Tugas', 'danger') : confirm('Hapus?');
            if(!ok) return;

            state.history[dateStr] = state.history[dateStr].filter(x => x.id !== id);
            save();
            renderLists();
            renderProgress();
            renderCalendar();
        }
    }

    // ---- TEMPLATE MANAGEMENTS ----
    function openTemplateModal() {
        const c = document.getElementById('dtTemplateModal');
        if(c) {
            c.classList.remove('hidden');
            c.style.display = 'flex';
        }
    }

    function closeTemplateModal() {
        const c = document.getElementById('dtTemplateModal');
        if(c) {
            c.classList.add('hidden');
            c.style.display = 'none';
        }
    }

    function syncTemplatesToWeek() {
        const weekDates = getDatesOfCurrentWeek();
        const dayNamesArr = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        const todayStr = getTodayStr(); // Opsional untuk logika tambahan, sekarang kita sync ke seluruh minggu!
        
        weekDates.forEach((dateStr, i) => {
            // Pastikan properti array history untuk hari tersebut sudah ada, walau belum divisit.
            if (!state.history[dateStr]) {
                state.history[dateStr] = [];
            }

            const dName = dayNamesArr[i];
            
            // Remove templates that no longer apply (but keep finished and one-offs)
            state.history[dateStr] = state.history[dateStr].filter(task => {
                if (!task.isTemplate) return true; 
                if (task.done) return true; 
                
                const tOrigin = state.templates.find(t => t.text === task.text && t.category === task.category);
                if (!tOrigin) return false; 
                const applies = (!tOrigin.days || tOrigin.days.length === 0 || tOrigin.days.includes('Semua') || tOrigin.days.includes(dName));
                if (!applies) return false; 
                return true;
            });
            
            // Add missing templates
            state.templates.forEach(t => {
                const applies = (!t.days || t.days.length === 0 || t.days.includes('Semua') || t.days.includes(dName));
                if (applies) {
                    const exists = state.history[dateStr].find(x => x.text === t.text && x.category === t.category);
                    if (!exists) {
                        state.history[dateStr].push({
                            id: 'task_' + dateStr + '_' + Math.random().toString(36).substr(2,4),
                            text: t.text,
                            category: t.category,
                            done: false,
                            isTemplate: true
                        });
                    }
                }
            });
        });
        save();
        renderLists();
        renderProgress();
    }

    function addSimpleTemplate() {
        const inp = document.getElementById('dtSimpleInput');
        const dSel = document.getElementById('dtSimpleDay');
        const txt = inp ? inp.value.trim() : '';
        if(!txt) return;

        const dayVal = dSel ? dSel.value : 'Semua';

        state.templates.push({
            id: 'tpl_' + Date.now(),
            text: txt,
            category: 'umum',
            days: [dayVal]
        });
        
        if (inp) inp.value = '';
        save();
        syncTemplatesToWeek();
        closeTemplateModal();
    }

    // ---- CATEGORY MANAGEMENTS ----
    function openCategoryModal() {
        const c = document.getElementById('dtCategoryModal');
        if(c) {
            c.classList.remove('hidden');
            c.style.display = 'flex';
            renderCategoriesList();
        }
    }

    function closeCategoryModal() {
        const c = document.getElementById('dtCategoryModal');
        if(c) {
            c.classList.add('hidden');
            c.style.display = 'none';
        }
    }

    function renderCategoriesList() {
        const listDiv = document.getElementById('dtCategoryList');
        if (!listDiv) return;
        
        let html = '';
        const cats = state.categories || [];
        
        cats.forEach(c => {
            html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-hover); padding:8px 12px; border-radius:8px;">
                <span style="font-size:14px; font-weight:600;">${escapeHtml(c.name)}</span>
                <button onclick="DailyTasks.deleteCategory('${c.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">✕</button>
            </div>
            `;
        });
        
        listDiv.innerHTML = html;
        updateCategoryDropdown();
    }

    function updateCategoryDropdown() {
        const sel = document.getElementById('dtInlineAddCategory');
        if (!sel) return;
        
        const cats = state.categories || [];
        let html = '';
        cats.forEach(c => {
            html += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
        });
        sel.innerHTML = html || '<option value="lainnya">📦 Lainnya</option>';
    }

    function addCategory() {
        const inp = document.getElementById('dtNewCategoryInput');
        const txt = inp ? inp.value.trim() : '';
        if (!txt) return;
        
        if (!state.categories) state.categories = [];
        
        const newId = 'cat_' + Date.now();
        state.categories.push({ id: newId, name: txt });
        
        if (inp) inp.value = '';
        
        renderCategoriesList();
        renderLists();
    }

    async function deleteCategory(id) {
        const ok = typeof AppModal !== 'undefined' ? await AppModal.confirm('Hapus kategori ini? SEMUA tugas terkait kategori ini akan dipindahkan ke "Lainnya" agar memori riwayat jadwal Anda tetap aman.', 'Hapus Kategori', 'danger') : confirm('Hapus Kategori?');
        if (!ok) return;
        
        state.categories = state.categories.filter(c => c.id !== id);
        
        // Render will automatically dump orphaned tasks into 'Lainnya' group. Safe!
        renderCategoriesList();
        renderLists();
    }

    return {
        init, render, toggleTask, deleteTask, editTask,
        saveInlineOneOffTask, toggleOneOff, deleteOneOff, editOneOff,
        prevMonth, nextMonth,
        openTemplateModal, closeTemplateModal, addSimpleTemplate,
        openCategoryModal, closeCategoryModal, addCategory, deleteCategory
    };
})();

// Provide backward compatibility / alias for app.js initialization
const TaskTracker = {
    init: DailyTasks.init,
    renderKanban: DailyTasks.render, // alias for app.js
    renderCalendar: () => {}, 
    renderTeam: () => {},
    updateOverdueBadge: (count) => {
        const badge = document.getElementById('taskBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }
};
