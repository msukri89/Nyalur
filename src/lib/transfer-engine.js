const CHUNK_SIZE = 64 * 1024; // 64KB per chunk

/**
 * Mengirim file melalui koneksi PeerJS DataConnection.
 * @param {DataConnection} conn - Koneksi PeerJS
 * @param {File[]} files - Array of File objects
 * @param {Function} onProgress - Callback progress
 * @returns {Promise} - Resolves when transfer complete
 */
export function sendFiles(conn, files, onProgress) {
  return new Promise((resolve, reject) => {
    const fileList = Array.from(files).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream'
    }));
    const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);

    conn.send({
      type: 'file-offer',
      files: fileList,
      totalSize: totalSize,
      deviceName: localStorage.getItem('nyalur-device-name') || 'Unknown'
    });

    function handleError(err) {
      conn.off('data', handleResponse);
      conn.off('close', handleClose);
      reject(err || new Error('Koneksi terputus'));
    }

    function handleClose() {
      handleError(new Error('Koneksi terputus saat menunggu respons'));
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

          for (let i = 0; i < files.length; i++) {
            const file = files[i];

            conn.send({ type: 'file-start', index: i, name: file.name, size: file.size, mimeType: file.type });

            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            for (let c = 0; c < totalChunks; c++) {
              const start = c * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const slice = file.slice(start, end);
              const buffer = await slice.arrayBuffer();

              conn.send({ type: 'chunk', index: i, data: new Uint8Array(buffer) });

              totalSent += (end - start);

              if (onProgress) {
                const elapsed = (Date.now() - startTime) / 1000;
                onProgress({
                  fileIndex: i,
                  fileName: file.name,
                  fileProgress: end / file.size,
                  totalProgress: totalSent / totalSize,
                  totalSent: totalSent,
                  totalSize: totalSize,
                  speed: elapsed > 0 ? totalSent / elapsed : 0,
                  elapsed: Date.now() - startTime
                });
              }

              if (c % 8 === 7) {
                await new Promise(r => setTimeout(r, 0));
              }
            }

            conn.send({ type: 'file-end', index: i });
          }

          conn.send({ type: 'transfer-complete' });

          conn.off('close', handleClose);
          conn.off('error', handleError);

          resolve({
            files: fileList,
            totalSize: totalSize,
            duration: Date.now() - startTime
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
 * Menerima file melalui koneksi PeerJS DataConnection.
 */
export function receiveFiles(conn, onOffer, onProgress, onFileComplete, onAllComplete) {
  let currentFile = null;
  let chunks = [];
  let receivedSize = 0;
  let totalReceived = 0;
  let totalSize = 0;
  let startTime = Date.now();
  const receivedFiles = [];

  function handleData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'file-offer':
        totalSize = data.totalSize || 0;
        startTime = Date.now();
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
        break;

      case 'chunk': {
        const chunkData = data.data;
        const len = chunkData.byteLength || chunkData.length || 0;
        chunks.push(chunkData);
        receivedSize += len;
        totalReceived += len;

        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          onProgress({
            fileIndex: data.index,
            fileName: currentFile ? currentFile.name : '',
            fileProgress: currentFile ? receivedSize / currentFile.size : 0,
            totalProgress: totalSize > 0 ? totalReceived / totalSize : 0,
            totalReceived: totalReceived,
            totalSize: totalSize,
            speed: elapsed > 0 ? totalReceived / elapsed : 0,
            elapsed: Date.now() - startTime
          });
        }
        break;
      }

      case 'file-end': {
        const blob = new Blob(chunks, { type: currentFile ? currentFile.mimeType : '' });
        const fileInfo = { ...currentFile };
        receivedFiles.push({ ...fileInfo, blob: blob });
        if (onFileComplete) onFileComplete(fileInfo, blob);
        currentFile = null;
        chunks = [];
        receivedSize = 0;
        break;
      }

      case 'transfer-complete':
        conn.off('data', handleData);
        if (onAllComplete) {
          onAllComplete({
            files: receivedFiles,
            totalSize: totalSize,
            duration: Date.now() - startTime
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
