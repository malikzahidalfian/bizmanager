// ========================================
// VALIDATORS MODULE
// Centralized validation functions
// ========================================

const Validators = {
    /**
     * Parse Rupiah string to number
     * @param {string|number} val
     * @returns {number}
     */
    parseRupiah: function(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Remove currency symbols and normalize separators
        let str = String(val).replace(/[Rp\s]/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(str) || 0;
    },

    /**
     * Parse date string consistently
     * @param {string|Date} val
     * @returns {Date|null}
     */
    parseDate: function(val) {
        if (val instanceof Date) return val;
        if (!val) return null;
        // Try various formats
        const date = new Date(val);
        return isNaN(date.getTime()) ? null : date;
    },

    /**
     * Validate email format
     * @param {string} val
     * @returns {boolean}
     */
    validateEmail: function(val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(val);
    },

    /**
     * Sanitize string input
     * @param {string} val
     * @returns {string}
     */
    sanitizeString: function(val) {
        if (!val) return '';
        return String(val).trim();
    },

    /**
     * Parse percentage string
     * @param {string|number} val
     * @returns {number}
     */
    parsePercent: function(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let str = String(val).replace('%', '');
        return parseFloat(str) || 0;
    }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
}