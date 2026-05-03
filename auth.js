// ========================================
// AUTH MODULE — Firebase Google Sign-In
// ========================================

const Auth = (() => {
    const ALLOWED_EMAILS = ['malikzahidalfian@gmail.com'];
    let currentUser = null;

    function init() {
        // Listen for auth state changes
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                // Check if email is allowed
                if (!ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
                    showToast('⛔ Akun tidak diizinkan. Hubungi admin.', 'error');
                    await firebase.auth().signOut();
                    return;
                }
                currentUser = user;
                console.log('✅ Logged in as:', user.email);
                hideLoginScreen();
                // Initialize the app after login
                if (typeof App !== 'undefined' && App.init) {
                    App.init();
                }
            } else {
                currentUser = null;
                showLoginScreen();
            }
        });
    }

    async function loginWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const loginBtn = document.getElementById('authLoginBtn');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="auth-spinner"></span> Menghubungkan...';
        }

        try {
            await firebase.auth().signInWithPopup(provider);
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup, do nothing
            } else if (error.code === 'auth/popup-blocked') {
                showToast('⚠️ Pop-up diblokir browser. Izinkan pop-up untuk login.', 'error');
            } else {
                showToast('❌ Gagal login: ' + error.message, 'error');
            }
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Masuk dengan Google
                `;
            }
        }
    }

    async function logout() {
        try {
            await firebase.auth().signOut();
            currentUser = null;
            showLoginScreen();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    function showLoginScreen() {
        const overlay = document.getElementById('authOverlay');
        const sidebar = document.getElementById('sidebar');
        const mainWrapper = document.getElementById('mainWrapper');
        
        if (overlay) overlay.style.display = 'flex';
        if (sidebar) sidebar.style.display = 'none';
        if (mainWrapper) mainWrapper.style.display = 'none';
    }

    function hideLoginScreen() {
        const overlay = document.getElementById('authOverlay');
        const sidebar = document.getElementById('sidebar');
        const mainWrapper = document.getElementById('mainWrapper');

        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transform = 'scale(1.05)';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 400);
        }
        if (sidebar) sidebar.style.display = '';
        if (mainWrapper) mainWrapper.style.display = '';

        // Update user info in sidebar
        updateUserInfo();
    }

    function updateUserInfo() {
        const el = document.getElementById('authUserInfo');
        if (el && currentUser) {
            const photoUrl = currentUser.photoURL || '';
            const displayName = currentUser.displayName || currentUser.email;
            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; padding:12px 16px; border-top:1px solid var(--border-color);">
                    ${photoUrl 
                        ? `<img src="${photoUrl}" style="width:32px; height:32px; border-radius:50%; border:2px solid var(--accent);" referrerpolicy="no-referrer">` 
                        : `<div style="width:32px; height:32px; border-radius:50%; background:var(--accent-gradient); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:14px;">${displayName.charAt(0).toUpperCase()}</div>`
                    }
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</div>
                        <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentUser.email}</div>
                    </div>
                    <button onclick="Auth.logout()" title="Logout" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px; border-radius:6px; transition:all 0.2s;" onmouseover="this.style.color='var(--red)';this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.color='var(--text-muted)';this.style.background='none'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    </button>
                </div>
            `;
        }
    }

    function getUser() {
        return currentUser;
    }

    return {
        init,
        loginWithGoogle,
        logout,
        getUser
    };
})();
