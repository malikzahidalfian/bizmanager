const XLSX = require('xlsx');
const workbook = XLSX.readFile('d:\\Aplikasi Saya\\Income.sudah dilepas.id.20251225_20260325.xlsx');
console.log(workbook.SheetNames);
for (let i = 0; i < workbook.SheetNames.length; i++) {
    if (workbook.SheetNames[i].toLowerCase().includes('order processing') || workbook.SheetNames[i].toLowerCase().includes('biaya proses')) {
        console.log('FOUND PRODUCT SHEET:', workbook.SheetNames[i]);
        const sheet = workbook.Sheets[workbook.SheetNames[i]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log('Rows 0-5:');
        for(let r=0; r<6; r++) console.log(data[r]);
    }
}
