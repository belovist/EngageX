const { contextBridge } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');

function resolvePythonExecutable() {
  const isWindows = process.platform === 'win32';
  const candidates = [
    path.join(repoRoot, '.venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
    path.join(repoRoot, 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return isWindows ? 'python' : 'python3';
}

let clientProcess = null;

contextBridge.exposeInMainWorld('api', {
  startClient: () => {
    if (clientProcess && !clientProcess.killed) {
      console.log("Already running");
      return;
    }

    const pythonExe = resolvePythonExecutable();

    clientProcess = spawn(
      pythonExe,
      ['-m', 'clients.desktop.run_virtual_cam', '--camera-id', '0'],
      { cwd: repoRoot }
    );

    clientProcess.stdout.on('data', (data) => {
      console.log(`[PYTHON] ${data}`);
    });

    clientProcess.stderr.on('data', (data) => {
      console.error(`[ERROR] ${data}`);
    });

    clientProcess.on('exit', (code) => {
      console.log(`Exited with ${code}`);
      clientProcess = null;
    });
  },

  stopClient: () => {
    if (clientProcess) {
      clientProcess.kill();
      clientProcess = null;
    }
  }
});
