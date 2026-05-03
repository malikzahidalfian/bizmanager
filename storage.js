// ========================================
// STORAGE MANAGER 
// Cloud-first: Firebase Firestore + localForage fallback
// ========================================

const StorageManager = {
    lastModified: {},
    _uid: null,
    _useCloud: false,
    _migrated: false,

    init: async function() {
        // Initialize localforage as fallback
        if (typeof localforage !== 'undefined') {
            localforage.config({
                name: 'BizManagerDB',
                storeName: 'bizmanager_data',
                description: 'Offline database for BizManager'
            });
        }

        // Check if Firebase Auth is available and user is logged in
        if (typeof firebase !== 'undefined' && firebase.auth && typeof db !== 'undefined') {
            const user = firebase.auth().currentUser;
            if (user) {
                this._uid = user.uid;
                this._useCloud = true;
                console.log('☁️ StorageManager: Cloud mode (Firestore) for user', user.email);
                
                // One-time migration: localforage → Firestore
                await this._migrateToCloud();
            } else {
                console.log('📦 StorageManager: Local mode (localForage) — not logged in');
            }
        } else {
            console.log('📦 StorageManager: Local mode (localForage) — Firebase not available');
        }

        // Legacy migration from localStorage → localforage (keep for local dev)
        if (typeof localforage !== 'undefined') {
            try {
                const isMigrated = await localforage.getItem('_migrated_from_ls');
                if (!isMigrated) {
                    console.log('🔄 Migrating data from localStorage to localForage...');
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key.includes('bizmanager') || key.includes('roas') || key.includes('tasks_v2') || key.includes('team_v1') || key.includes('competitors') || key.includes('scraped') || key.includes('sellersync') || key.includes('aliases')) {
                            const val = localStorage.getItem(key);
                            await localforage.setItem(key, val);
                        }
                    }
                    await localforage.setItem('_migrated_from_ls', true);
                    console.log('✅ localStorage → localForage migration complete!');
                }
            } catch (e) {
                console.error('❌ localStorage migration failed:', e);
            }
        }

        console.log(`📦 StorageManager ready. Mode: ${this._useCloud ? '☁️ Cloud' : '💾 Local'}`);
        return true;
    },

    // Migrate existing localforage data to Firestore (one-time)
    _migrateToCloud: async function() {
        if (!this._useCloud || !this._uid) return;
        
        try {
            // Check if already migrated to cloud
            const migrationDoc = await db.collection('users').doc(this._uid).collection('meta').doc('migration').get();
            if (migrationDoc.exists && migrationDoc.data().done) {
                console.log('☁️ Cloud migration already done, skipping');
                this._migrated = true;
                return;
            }

            // Check if there's local data to migrate
            if (typeof localforage === 'undefined') return;
            
            const keys = await localforage.keys();
            const dataKeys = keys.filter(k => !k.startsWith('_'));
            
            if (dataKeys.length === 0) {
                console.log('☁️ No local data to migrate');
                // Mark as migrated anyway
                await db.collection('users').doc(this._uid).collection('meta').doc('migration').set({ done: true, date: new Date().toISOString() });
                this._migrated = true;
                return;
            }

            console.log(`☁️ Migrating ${dataKeys.length} keys from localForage → Firestore...`);
            
            // Use batched writes for efficiency (max 500 per batch)
            let batch = db.batch();
            let batchCount = 0;

            for (const key of dataKeys) {
                const value = await localforage.getItem(key);
                if (value !== null && value !== undefined) {
                    const docRef = db.collection('users').doc(this._uid).collection('data').doc(key);
                    batch.set(docRef, { value: value, updatedAt: new Date().toISOString() });
                    batchCount++;
                    
                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            // Mark migration as done
            await db.collection('users').doc(this._uid).collection('meta').doc('migration').set({ done: true, date: new Date().toISOString(), keyCount: dataKeys.length });
            this._migrated = true;

            console.log(`✅ Cloud migration complete! ${dataKeys.length} keys uploaded`);
            if (typeof showToast !== 'undefined') {
                showToast(`☁️ ${dataKeys.length} data berhasil disinkronkan ke cloud!`, 'success');
            }
        } catch (e) {
            console.error('❌ Cloud migration failed:', e);
            // Continue with cloud mode anyway — data will be written fresh
        }
    },

    /**
     * Safely sets an item — writes to Firestore (cloud) or localForage (local)
     */
    setItem: async function(key, value) {
        const newTimestamp = Date.now();
        if (this.lastModified[key] && newTimestamp - this.lastModified[key] < 100) {
            console.warn('⚠️ Possible concurrent modification detected for', key);
        }
        this.lastModified[key] = newTimestamp;

        try {
            if (this._useCloud && this._uid) {
                // Write to Firestore
                await db.collection('users').doc(this._uid).collection('data').doc(key).set({
                    value: value,
                    updatedAt: new Date().toISOString()
                });
                return true;
            } else {
                // Fallback: write to localForage
                await localforage.setItem(key, value);
                const verify = await localforage.getItem(key);
                if (verify !== value) throw new Error('Write verification failed');
                return true;
            }
        } catch (e) {
            console.error(`❌ [StorageManager] Error saving [${key}]:`, e);
            if (typeof showToast !== 'undefined') {
                showToast('⛔ Gagal menyimpan data.', 'error');
            }
            return false;
        }
    },

    /**
     * Gets an item — reads from Firestore (cloud) or localForage (local)
     */
    getItem: async function(key) {
        try {
            if (this._useCloud && this._uid) {
                // Read from Firestore
                const doc = await db.collection('users').doc(this._uid).collection('data').doc(key).get();
                if (doc.exists) {
                    return doc.data().value;
                }
                return null;
            } else {
                // Fallback: read from localForage
                return await localforage.getItem(key);
            }
        } catch (e) {
            console.error(`❌ [StorageManager] Error reading [${key}]:`, e);
            return null;
        }
    },

    /**
     * Removes an item
     */
    removeItem: async function(key) {
        try {
            if (this._useCloud && this._uid) {
                await db.collection('users').doc(this._uid).collection('data').doc(key).delete();
            } else {
                await localforage.removeItem(key);
            }
        } catch (e) {
            // ignore
        }
    },

    /**
     * Exports entire database as JSON
     */
    exportDatabase: async function() {
        try {
            const exportData = {};
            
            if (this._useCloud && this._uid) {
                const snapshot = await db.collection('users').doc(this._uid).collection('data').get();
                snapshot.forEach(doc => {
                    exportData[doc.id] = doc.data().value;
                });
            } else {
                const keys = await localforage.keys();
                for (const key of keys) {
                    exportData[key] = await localforage.getItem(key);
                }
            }
            
            return JSON.stringify(exportData, null, 2);
        } catch (e) {
            console.error('❌ [StorageManager] Failed to export database:', e);
            throw e;
        }
    },

    /**
     * Imports JSON data into database
     */
    importDatabase: async function(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (typeof parsed !== 'object' || parsed === null) throw new Error('Format Database Tidak Valid');

            if (this._useCloud && this._uid) {
                // Clear existing cloud data
                const existing = await db.collection('users').doc(this._uid).collection('data').get();
                let delBatch = db.batch();
                let delCount = 0;
                existing.forEach(doc => {
                    delBatch.delete(doc.ref);
                    delCount++;
                    if (delCount >= 450) {
                        delBatch.commit();
                        delBatch = db.batch();
                        delCount = 0;
                    }
                });
                if (delCount > 0) await delBatch.commit();

                // Write new data
                let batch = db.batch();
                let batchCount = 0;
                for (const key of Object.keys(parsed)) {
                    const docRef = db.collection('users').doc(this._uid).collection('data').doc(key);
                    batch.set(docRef, { value: parsed[key], updatedAt: new Date().toISOString() });
                    batchCount++;
                    if (batchCount >= 450) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }
                if (batchCount > 0) await batch.commit();
            } else {
                await localforage.clear();
                for (const key of Object.keys(parsed)) {
                    await localforage.setItem(key, parsed[key]);
                }
            }

            return true;
        } catch (e) {
            console.error('❌ [StorageManager] Failed to import database:', e);
            return false;
        }
    },

    /**
     * Force re-sync: re-detect auth state and switch mode
     */
    syncMode: function() {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof db !== 'undefined') {
            const user = firebase.auth().currentUser;
            if (user) {
                this._uid = user.uid;
                this._useCloud = true;
            } else {
                this._uid = null;
                this._useCloud = false;
            }
        }
    }
};
