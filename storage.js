// ========================================
// STORAGE MANAGER 
// Async wrapper for IndexedDB via localForage
// ========================================

const StorageManager = {
    lastModified: {},
    init: async function() {
        if (typeof localforage === 'undefined') {
            console.error('❌ localForage failed to load. StorageManager cannot initialize.');
            return false;
        }

        localforage.config({
            name: 'BizManagerDB',
            storeName: 'bizmanager_data',
            description: 'Offline database for SellerSync'
        });

        // 🔄 Migration logic from localStorage -> IndexedDB
        try {
            const isMigrated = await localforage.getItem('_migrated_from_ls');
            if (!isMigrated) {
                console.log('🔄 Migrating data from localStorage to localForage (IndexedDB)...');
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    // Match any keys we might have used
                    if (key.includes('bizmanager') || key.includes('roas') || key.includes('tasks_v2') || key.includes('team_v1') || key.includes('competitors') || key.includes('scraped') || key.includes('sellersync') || key.includes('aliases')) {
                        const val = localStorage.getItem(key);
                        await localforage.setItem(key, val);
                    }
                }
                await localforage.setItem('_migrated_from_ls', true);
                console.log('✅ Migration complete!');
            }
        } catch (e) {
            console.error('❌ Migration failed:', e);
        }

        console.log('📦 StorageManager (IndexedDB) ready.');
        return true;
    },

    /**
     * Safely sets an item in localForage asynchronously.
     * @param {string} key 
     * @param {string} value 
     * @returns {Promise<boolean>}
     */
    setItem: async function(key, value) {
        const newTimestamp = Date.now();
        if (this.lastModified[key] && newTimestamp - this.lastModified[key] < 100) {
            console.warn('⚠️ Possible concurrent modification detected for', key);
        }
        this.lastModified[key] = newTimestamp;
        try {
            await localforage.setItem(key, value);
            // Verify write succeeded
            const verify = await localforage.getItem(key);
            if (verify !== value) throw new Error('Write verification failed');
            return true;
        } catch (e) {
            console.error(`❌ [StorageManager] Error saving to IndexedDB [${key}]:`, e);
            if (typeof showToast !== 'undefined') {
                showToast('⛔ Gagal menyimpan data ke database browser.', 'error');
            }
            return false;
        }
    },

    /**
     * Gets an item from localForage asynchronously
     * @param {string} key 
     * @returns {Promise<string|null>}
     */
    getItem: async function(key) {
        try {
            return await localforage.getItem(key);
        } catch (e) {
            console.error(`❌ [StorageManager] Error reading from IndexedDB [${key}]:`, e);
            return null;
        }
    },

    /**
     * Removes an item from localForage asynchronously
     * @param {string} key 
     */
    removeItem: async function(key) {
        try {
            await localforage.removeItem(key);
        } catch (e) {
            // ignore
        }
    },

    /**
     * Mengekspor keseluruhan isi IndexedDB menjadi format JSON
     * @returns {Promise<string>}
     */
    exportDatabase: async function() {
        try {
            const keys = await localforage.keys();
            const exportData = {};
            for (const key of keys) {
                exportData[key] = await localforage.getItem(key);
            }
            return JSON.stringify(exportData, null, 2);
        } catch (e) {
            console.error('❌ [StorageManager] Failed to export database:', e);
            throw e;
        }
    },

    /**
     * Memulihkan atau menimpa IndexedDB dengan string JSON
     * @param {string} jsonString
     * @returns {Promise<boolean>}
     */
    importDatabase: async function(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (typeof parsed !== 'object' || parsed === null) throw new Error('Format Database Tidak Valid');
            
            // Bersihkan data lama
            await localforage.clear();

            // Tulis seluruh data baru
            for (const key of Object.keys(parsed)) {
                await localforage.setItem(key, parsed[key]);
            }
            
            return true;
        } catch (e) {
            console.error('❌ [StorageManager] Failed to import database:', e);
            return false;
        }
    }
};
