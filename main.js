const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "BizManager Desktop",
        icon: path.join(__dirname, 'icon.png'), // Opsional
        webPreferences: {
            nodeIntegration: false, // Aman
            contextIsolation: true, // Aman
            enableRemoteModule: false
        }
    });

    // Sembunyikan menu bawaan agar terlihat modern dan bersih
    Menu.setApplicationMenu(null);

    // Buka file utama
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
