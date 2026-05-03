// Test data for Business Summary
const testOrders = [
    {
        noPesanan: "TEST001",
        tanggalOrder: "2024-01-15",
        namaProduk: "Produk A",
        namaVariasi: "Merah",
        jumlah: 2,
        revenue: 100000,
        status: "Selesai"
    },
    {
        noPesanan: "TEST002",
        tanggalOrder: "2024-01-20",
        namaProduk: "Produk B",
        namaVariasi: "Biru",
        jumlah: 1,
        revenue: 50000,
        status: "Selesai"
    },
    {
        noPesanan: "TEST003",
        tanggalOrder: "2024-02-10",
        namaProduk: "Produk A",
        namaVariasi: "Hijau",
        jumlah: 3,
        revenue: 150000,
        status: "Dikirim"
    }
];

// Save test data
if (typeof StorageManager !== 'undefined') {
    StorageManager.setItem('bizmanager_orders', JSON.stringify(testOrders));
    console.log('✅ Test data saved to bizmanager_orders');
}