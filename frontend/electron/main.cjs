const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')

let mainWindow
const defaultStartUrl = 'http://127.0.0.1:3000/'

function waitForVite(retries = 20, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get('http://127.0.0.1:3000', (res) => {
        if (res.statusCode === 200) resolve()
        else setTimeout(attempt, delay)
      }).on('error', () => {
        if (retries-- > 0) setTimeout(attempt, delay)
        else reject(new Error('Vite not ready'))
      })
    }
    attempt()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  })

  // Honor the existing desktop start URL hook while keeping the home screen as the default.
  mainWindow.loadURL(process.env.ELECTRON_START_URL || defaultStartUrl)
}

app.whenReady().then(async () => {
  console.log('Waiting for Vite...')
  try {
    await waitForVite()
    console.log('Vite ready!')
  } catch (e) {
    console.error('Vite not ready, opening anyway...')
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
