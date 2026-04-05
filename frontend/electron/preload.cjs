const { contextBridge } = require('electron')
const { exec } = require('child_process')

contextBridge.exposeInMainWorld('api', {
  startClient: () => {
    exec(`
      cd ../../ && \
      source .venv/bin/activate && \
      python3 distributed_client.py \
      --user-id student-1 \
      --server-url http://127.0.0.1:8000 \
      --camera-id 1 \
      --interval 1
    `, (err) => {
      if (err) console.error("Client error:", err)
    })
  }
})