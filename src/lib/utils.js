export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

export function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '— B/s';
  return formatFileSize(bytesPerSecond) + '/s';
}

export function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0 detik';
  if (seconds < 60) return Math.ceil(seconds) + ' detik';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.ceil(seconds % 60);
    return m + ' menit' + (s > 0 ? ' ' + s + ' detik' : '');
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return h + ' jam ' + m + ' menit';
}

export function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm lalu';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'j lalu';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'h lalu';

    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
