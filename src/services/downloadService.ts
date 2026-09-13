import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadItem, MediaItem, Episode } from '../types';

const DOWNLOADS_KEY = '@filmx_downloads_v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;

// Keep active resumable downloads in memory
const activeDownloads = new Map<string, FileSystem.DownloadResumable>();

// Ensure local downloads directory exists
async function ensureDirExists() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('Failed to create downloads directory:', e);
  }
}

export function generateDownloadId(mediaId: string, episodeId?: string): string {
  return episodeId ? `${mediaId}_${episodeId}` : mediaId;
}

export async function getStoredDownloads(): Promise<DownloadItem[]> {
  try {
    const json = await AsyncStorage.getItem(DOWNLOADS_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to get stored downloads:', e);
    return [];
  }
}

export async function saveStoredDownloads(downloads: DownloadItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
  } catch (e) {
    console.error('Failed to save stored downloads:', e);
  }
}

/**
 * Serverga yuklash (Bulutli / Server xotirasi)
 * Foydalanuvchi telefon xotirasidan 0 bayt joy olinadi!
 */
export async function saveToServerLibrary(
  item: MediaItem,
  episode?: Episode
): Promise<DownloadItem> {
  const downloadId = generateDownloadId(item.id, episode?.id);
  const isSeries = item.type === 'series';

  let videoUrl = '';
  if (isSeries && episode) {
    videoUrl = episode.videoUrl;
  } else if ('videoUrl' in item && item.videoUrl) {
    videoUrl = item.videoUrl;
  }

  const downloads = await getStoredDownloads();
  const existingIdx = downloads.findIndex((d) => d.id === downloadId);

  const newEntry: DownloadItem = {
    id: downloadId,
    mediaId: item.id,
    item,
    target: 'server',
    episodeId: episode?.id,
    episodeTitle: episode?.title || (episode ? `${episode.episodeNumber}-Qism` : undefined),
    videoUrl,
    status: 'completed',
    progress: 1,
    downloadedBytes: 0,
    totalBytes: 0,
    createdAt: Date.now(),
    completedAt: Date.now(),
  };

  let updated: DownloadItem[];
  if (existingIdx >= 0) {
    updated = [...downloads];
    updated[existingIdx] = newEntry;
  } else {
    updated = [newEntry, ...downloads];
  }

  await saveStoredDownloads(updated);
  return newEntry;
}

/**
 * Galereyaga / Qurilma xotirasiga yuklab olish
 * Telefon diskiga to'liq yuklanadi, oflayn ko'rish mumkin.
 */
export async function startGalleryDownload(
  item: MediaItem,
  episode?: Episode,
  onProgress?: (progress: number, downloadedMB: number, totalMB: number) => void
): Promise<DownloadItem> {
  await ensureDirExists();
  const downloadId = generateDownloadId(item.id, episode?.id);
  const isSeries = item.type === 'series';

  let rawUrl = '';
  if (isSeries && episode) {
    rawUrl = episode.videoUrl;
  } else if ('videoUrl' in item && item.videoUrl) {
    rawUrl = item.videoUrl;
  }

  if (!rawUrl) {
    throw new Error('Video havolasi topilmadi');
  }

  // Generate a clean safe filename
  const safeTitle = (episode ? `${item.title}_${episode.title || `Qism_${episode.episodeNumber}`}` : item.title)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);
  const filename = `${safeTitle}_${Date.now()}.mp4`;
  const fileUri = `${DOWNLOAD_DIR}${filename}`;

  const downloads = await getStoredDownloads();
  const existingIdx = downloads.findIndex((d) => d.id === downloadId);

  const initialEntry: DownloadItem = {
    id: downloadId,
    mediaId: item.id,
    item,
    target: 'gallery',
    episodeId: episode?.id,
    episodeTitle: episode?.title || (episode ? `${episode.episodeNumber}-Qism` : undefined),
    videoUrl: rawUrl,
    localUri: fileUri,
    status: 'downloading',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    createdAt: Date.now(),
  };

  let updated: DownloadItem[];
  if (existingIdx >= 0) {
    updated = [...downloads];
    updated[existingIdx] = initialEntry;
  } else {
    updated = [initialEntry, ...downloads];
  }
  await saveStoredDownloads(updated);

  const downloadResumable = FileSystem.createDownloadResumable(
    rawUrl,
    fileUri,
    {},
    (downloadProgress) => {
      const total = downloadProgress.totalBytesExpectedToWrite;
      const written = downloadProgress.totalBytesWritten;
      const progress = total > 0 ? Math.min(1, Math.max(0, written / total)) : 0;
      const downloadedMB = written / (1024 * 1024);
      const totalMB = total / (1024 * 1024);

      if (onProgress) {
        onProgress(progress, downloadedMB, totalMB);
      }
    }
  );

  activeDownloads.set(downloadId, downloadResumable);

  try {
    const result = await downloadResumable.downloadAsync();
    activeDownloads.delete(downloadId);

    if (!result || !result.uri) {
      throw new Error("Yuklab olish yakunlanmadi");
    }

    const completedDownloads = await getStoredDownloads();
    const cIdx = completedDownloads.findIndex((d) => d.id === downloadId);
    if (cIdx >= 0) {
      completedDownloads[cIdx] = {
        ...completedDownloads[cIdx],
        status: 'completed',
        progress: 1,
        localUri: result.uri,
        completedAt: Date.now(),
      };
      await saveStoredDownloads(completedDownloads);
      return completedDownloads[cIdx];
    }
    return initialEntry;
  } catch (err: any) {
    activeDownloads.delete(downloadId);
    console.warn('Download error:', err);

    const errorDownloads = await getStoredDownloads();
    const eIdx = errorDownloads.findIndex((d) => d.id === downloadId);
    if (eIdx >= 0) {
      errorDownloads[eIdx] = {
        ...errorDownloads[eIdx],
        status: 'error',
        errorMessage: err?.message || "Yuklab olishda xatolik yuz berdi",
      };
      await saveStoredDownloads(errorDownloads);
    }
    throw err;
  }
}

export async function cancelDownload(id: string): Promise<void> {
  const resumable = activeDownloads.get(id);
  if (resumable) {
    try {
      await resumable.pauseAsync();
    } catch (e) {}
    activeDownloads.delete(id);
  }

  const downloads = await getStoredDownloads();
  const updated = downloads.filter((d) => d.id !== id);
  await saveStoredDownloads(updated);
}

export async function deleteDownload(id: string): Promise<void> {
  const resumable = activeDownloads.get(id);
  if (resumable) {
    try {
      await resumable.pauseAsync();
    } catch (e) {}
    activeDownloads.delete(id);
  }

  const downloads = await getStoredDownloads();
  const target = downloads.find((d) => d.id === id);

  if (target && target.localUri) {
    try {
      await FileSystem.deleteAsync(target.localUri, { idempotent: true });
    } catch (e) {
      console.warn('Failed to delete local download file:', e);
    }
  }

  const updated = downloads.filter((d) => d.id !== id);
  await saveStoredDownloads(updated);
}

export async function openInGalleryOrShare(localUri: string, title: string): Promise<void> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(localUri, {
        mimeType: 'video/mp4',
        dialogTitle: `${title} — Galereyada saqlash / Ulashish`,
      });
    } else {
      console.warn('Sharing is not available on this platform');
    }
  } catch (e) {
    console.warn('Failed to share/open video:', e);
  }
}
