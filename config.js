// ========================================
// CONFIG MODULE
// Centralized configuration constants
// ========================================

const Config = {
    // Platform admin fees (percent)
    SHOPEE_ADMIN_FEE: 9.5,
    TIKTOK_ADMIN_FEE: 5.0,
    LAZADA_ADMIN_FEE: 8.0,

    // File limits
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

    // Date format
    DATE_FORMAT: 'YYYY-MM-DD',

    // Other constants
    DEFAULT_CURRENCY: 'IDR',
    DECIMAL_PLACES: 2,

    // UI settings
    ITEMS_PER_PAGE: 50,
    MAX_PRODUCT_VARIATIONS: 100
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}