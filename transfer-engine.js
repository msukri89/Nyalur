/**
 * Nyalur Transfer Engine v2 — Optimized
 *
 * Optimizations over v1:
 * - Chunk size: 64KB → 256KB (4x fewer messages)
 * - Backpressure via DataChannel bufferedAmount
 * - Pipeline sending (continuous, pause only when buffer full)
 * - Rolling speed average (smooth display)
 * - Per-file progress tracking
 * - Browser notification + vibration on complete
 */

const CHUNK_SIZE = 256 * 1024; // 256KB per chunk (was 64KB)
const HIGH_WATER_MARK = 2 * 1024 * 1024; // 2MB buffer threshold
const LOW_WATER_MARK = 512 * 1024; // 512KB resume threshold

/**
 * Wait for DataChannel buffer to drain below threshold
 */
async function waitForDrain(conn) {
  try {
    const dc = conn._dc || conn.dataChannel;
    if (!dc || dc.bufferedAmount <= HIGH_WATER_MARK) return;

    await new Promise(resolve => {
      const check = () => {
        if (!dc || dc.bufferedAmount <= LOW_WATER_MARK) {
          resolve();
        } else {
          setTimeout(check, 5);
        }
      };
      check();
    });
  } catch {
    // Fallback: simple yield
    await new Promise(r => setTimeout(r, 0));
  }
}

/**
 * Rolling speed calculator (smooth, averages over last 2 seconds)
 */
function createSpeedTracker() {
  const samples = [];

  return {
    add(totalBytes, timestamp) {
      samples.push({ bytes: totalBytes, ts: timestamp });
      // Keep only last 3 seconds of samples
      const cutoff = timestamp - 3000;
      while (samples.length > 2 && samples[0].ts < cutoff) {
        samples.shift();
      }
    },
    getSpeed() {
      if (samples.length < 2) return 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = (last.ts - first.ts) / 1000;
      return elapsed > 0 ? (last.bytes - first.bytes) / elapsed : 0;
    }
  };
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/**
 * Show completion notification + vibrate
 */
function notifyComplete(direction, fileCount, totalSize) {
  // Vibrate
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }

  // Browser notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const sizeStr = formatSizeCompact(totalSize);
    const title = direction === 'sent' ? 'Transfer Selesai!' : 'File Diterima!';
    const body = `${fileCount} file (${sizeStr}) berhasil ${direction === 'sent' ? 'dikirim' : 'diterima'}`;
    try {
      new Notification(title, { body, icon: '/Nyalur/icon-192.png', tag: 'nyalur-transfer' });
    } catch { /* ignore */ }
  }
}

function formatSizeCompact(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

/**
 * Send files over a PeerJS DataConnection.
 */
export function sendFiles(conn, files, onProgress) {
  return new Promise((resolve, reject) => {
    const fileList = Array.from(files).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream'
    }));
    const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);

    // Send offer
    conn.send({
      type: 'file-offer',
      files: fileList,
      totalSize,
      deviceName: localStorage.getItem('nyalur-device-name') || 'Unknown'
    });

    function handleError(err) {
      conn.off('data', handleResponse);
      conn.off('close', handleClose);
      reject(err || new Error('Koneksi terputus'));
    }

    function handleClose() {
      handleError(new Error('Koneksi terputus saat transfer'));
    }

    conn.on('close', handleClose);
    conn.on('error', handleError);

    async function handleResponse(data) {
      if (!data || !data.type) return;

      if (data.type === 'accept') {
        conn.off('data', handleResponse);

        try {
          let totalSent = 0;
          const startTime = Date.now();
          const speedTracker = createSpeedTracker();
          const fileProgress = fileList.map(() => ({ sent: 0, status: 'pending' }));

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            fileProgress[i].status = 'sending';

            // Signal file start
            conn.send({ type: 'file-start', index: i, name: file.name, size: file.size, mimeType: file.type });

            // Send chunks with backpressure
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let fileSent = 0;

            for (let c = 0; c < totalChunks; c++) {
              const start = c * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const slice = file.slice(start, end);
              const buffer = await slice.arrayBuffer();

              conn.send({ type: 'chunk', index: i, data: new Uint8Array(buffer) });

              const chunkLen = end - start;
              fileSent += chunkLen;
              totalSent += chunkLen;
              fileProgress[i].sent = fileSent;

              const now = Date.now();
              speedTracker.add(totalSent, now);

              if (onProgress) {
                onProgress({
                  fileIndex: i,
                  fileName: file.name,
                  fileProgress: fileSent / file.size,
                  totalProgress: totalSent / totalSize,
                  totalSent,
                  totalSize,
                  speed: speedTracker.getSpeed(),
                  elapsed: now - startTime,
                  files: fileProgress,
                  currentFileIndex: i,
                  totalFiles: files.length
                });
              }

              // Backpressure: wait if buffer is full
              await waitForDrain(conn);
            }

            fileProgress[i].status = 'done';
            conn.send({ type: 'file-end', index: i });
          }

          conn.send({ type: 'transfer-complete' });
          conn.off('close', handleClose);
          conn.off('error', handleError);

          const duration = Date.now() - startTime;
          notifyComplete('sent', files.length, totalSize);

          resolve({
            files: fileList,
            totalSize,
            duration,
            avgSpeed: duration > 0 ? totalSize / (duration / 1000) : 0
          });

        } catch (err) {
          reject(err);
        }

      } else if (data.type === 'reject') {
        conn.off('data', handleResponse);
        conn.off('close', handleClose);
        conn.off('error', handleError);
        reject(new Error('Transfer ditolak oleh penerima'));
      }
    }

    conn.on('data', handleResponse);
  });
}

/**
 * Receive files over a PeerJS DataConnection.
 */
export function receiveFiles(conn, onOffer, onProgress, onFileComplete, onAllComplete) {
  let currentFile = null;
  let chunks = [];
  let receivedSize = 0;
  let totalReceived = 0;
  let totalSize = 0;
  let startTime = Date.now();
  const receivedFiles = [];
  const speedTracker = createSpeedTracker();
  const fileProgress = [];

  function handleData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'file-offer':
        totalSize = data.totalSize || 0;
        startTime = Date.now();
        // Initialize file progress
        if (data.files) {
          data.files.forEach(() => fileProgress.push({ received: 0, status: 'pending' }));
        }
        if (onOffer) onOffer(data);
        break;

      case 'file-start':
        currentFile = {
          index: data.index,
          name: data.name,
          size: data.size,
          mimeType: data.mimeType || 'application/octet-stream'
        };
        chunks = [];
        receivedSize = 0;
        if (fileProgress[data.index]) fileProgress[data.index].status = 'receiving';
        break;

      case 'chunk': {
        const chunkData = data.data;
        const len = chunkData.byteLength || chunkData.length || 0;
        chunks.push(chunkData);
        receivedSize += len;
        totalReceived += len;

        if (fileProgress[data.index]) fileProgress[data.index].received = receivedSize;

        const now = Date.now();
        speedTracker.add(totalReceived, now);

        if (onProgress) {
          onProgress({
            fileIndex: data.index,
            fileName: currentFile ? currentFile.name : '',
            fileProgress: currentFile ? receivedSize / currentFile.size : 0,
            totalProgress: totalSize > 0 ? totalReceived / totalSize : 0,
            totalReceived,
            totalSize,
            speed: speedTracker.getSpeed(),
            elapsed: now - startTime,
            files: fileProgress,
            currentFileIndex: data.index,
            totalFiles: fileProgress.length
          });
        }
        break;
      }

      case 'file-end': {
        const blob = new Blob(chunks, { type: currentFile ? currentFile.mimeType : '' });
        const fileInfo = { ...currentFile };
        receivedFiles.push({ ...fileInfo, blob });
        if (fileProgress[data.index]) fileProgress[data.index].status = 'done';
        if (onFileComplete) onFileComplete(fileInfo, blob);
        currentFile = null;
        chunks = [];
        receivedSize = 0;
        break;
      }

      case 'transfer-complete':
        conn.off('data', handleData);
        const duration = Date.now() - startTime;
        notifyComplete('received', receivedFiles.length, totalSize);

        if (onAllComplete) {
          onAllComplete({
            files: receivedFiles,
            totalSize,
            duration,
            avgSpeed: duration > 0 ? totalSize / (duration / 1000) : 0
          });
        }
        break;
    }
  }

  conn.on('data', handleData);

  return {
    accept: () => conn.send({ type: 'accept' }),
    reject: () => {
      conn.off('data', handleData);
      conn.send({ type: 'reject' });
    }
  };
}

/**
 * Trigger download file from Blob
 */
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
