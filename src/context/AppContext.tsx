import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MediaItem, WatchHistoryItem, DownloadItem, DownloadTarget, Episode } from "../types";
import { checkAppUpdate, UpdateInfo } from "../services/updateService";
import {
  subscribeDataUpdates,
  syncRemoteMediaData,
  registerAppRestarter,
  SyncResult,
} from "../services/dataService";
import {
  getStoredDownloads,
  saveToServerLibrary,
  startGalleryDownload as serviceStartGallery,
  deleteDownload as serviceDeleteDownload,
  cancelDownload as serviceCancelDownload,
  generateDownloadId,
} from "../services/downloadService";

const APP_VERSION = "1.7.0";

interface AppContextType {
  favorites: MediaItem[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: MediaItem) => void;
  favoritesCount: number;
  history: WatchHistoryItem[];
  recordProgress: (
    item: MediaItem,
    currentTime: number,
    duration: number,
    episodeId?: string,
    episodeTitle?: string
  ) => void;
  removeHistoryItem: (id: string) => void;
  clearHistory: () => void;
  isWatched: (id: string) => boolean;
  // Downloads
  downloads: DownloadItem[];
  downloadMovie: (
    item: MediaItem,
    target: DownloadTarget,
    episode?: Episode,
    onProgress?: (prog: number, dMB: number, tMB: number) => void
  ) => Promise<DownloadItem>;
  removeDownload: (id: string) => Promise<void>;
  cancelActiveDownload: (id: string) => Promise<void>;
  getDownload: (mediaId: string, episodeId?: string) => DownloadItem | undefined;
  refreshDownloads: () => Promise<void>;
  // Network connectivity status
  isOffline: boolean;
  isRestored: boolean;
  // In-app Dynamic Content OTA Sync
  dataVersion: number;
  syncData: (force?: boolean) => Promise<SyncResult>;
  syncToast: string | null;
  dismissSyncToast: () => void;
  restartApp: (message?: string) => void;
  // Native Engine Updates
  updateInfo: UpdateInfo | null;
  showUpdateModal: boolean;
  setShowUpdateModal: (show: boolean) => void;
  checkUpdates: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const FAVORITES_KEY = "@filmx_favorites_v1";
const HISTORY_KEY = "@filmx_watch_history_v1";

export const AppProvider: React.FC<{
  children: React.ReactNode;
  onAppRestart?: (message?: string) => void;
}> = ({ children, onAppRestart }) => {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  // Live Data Version & In-App Sync State
  const [dataVersion, setDataVersion] = useState(0);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Network State
  const [isOffline, setIsOffline] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const wasOfflineRef = useRef(false);

  // Auto-Update State (Only for major native engine rebuilds)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Initial fast background loads
    loadStorage();
    refreshDownloads();

    // Subscribe to live data changes (from local disk or remote sync)
    const unsubData = subscribeDataUpdates((info) => {
      setDataVersion((prev) => prev + 1);
      if (info.newItemsCount > 0) {
        setSyncToast(`⚡ +${info.newItemsCount} ta yangi kino va seriallar yangilandi!`);
        setTimeout(() => {
          setSyncToast((cur) => (cur?.includes(String(info.newItemsCount)) ? null : cur));
        }, 4500);
      }
    });

    // Automatic silent background data sync after app opens (1.5s pause to not block launch)
    const syncTimeout = setTimeout(() => {
      syncRemoteMediaData().catch(() => {});
    }, 1500);

    // Periodic lightweight background sync check every 5 minutes
    const periodicSyncInterval = setInterval(() => {
      syncRemoteMediaData().catch(() => {});
    }, 300000);

    // Check for native app updates without blocking popup
    const updateTimeout = setTimeout(() => {
      checkUpdates();
    }, 4000);

    // Lightweight network check every 30 seconds
    const netInterval = setInterval(checkConnectivity, 30000);

    return () => {
      unsubData();
      clearTimeout(syncTimeout);
      clearTimeout(updateTimeout);
      clearInterval(periodicSyncInterval);
      clearInterval(netInterval);
    };
  }, []);

  const checkConnectivity = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      await fetch("https://raw.githubusercontent.com/favicon.ico", {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setIsOffline(false);
        setIsRestored(true);
        setTimeout(() => setIsRestored(false), 3000);
        // Automatically sync fresh data once internet returns
        syncRemoteMediaData().catch(() => {});
      } else if (isOffline) {
        setIsOffline(false);
      }
    } catch (e) {
      if (!wasOfflineRef.current) {
        wasOfflineRef.current = true;
        setIsOffline(true);
        setIsRestored(false);
      }
    }
  };

  const restartApp = useCallback((customMsg?: string) => {
    setDataVersion((v) => v + 1);
    const msg = customMsg || "✨ GitHub yangilanishlari to'liq o'rnatildi! Ilova yangilandi.";
    setSyncToast(msg);
    setTimeout(() => setSyncToast(null), 5000);
    if (onAppRestart) {
      onAppRestart(msg);
    }
  }, [onAppRestart]);

  useEffect(() => {
    const unregister = registerAppRestarter(restartApp);
    return unregister;
  }, [restartApp]);

  const syncData = async (force = false): Promise<SyncResult> => {
    const result = await syncRemoteMediaData(force);
    if (result.updated && result.newItemsCount > 0) {
      restartApp(`✨ +${result.newItemsCount} ta yangi kino va seriallar o'rnatildi!`);
    }
    return result;
  };

  const dismissSyncToast = () => setSyncToast(null);

  const checkUpdates = async () => {
    try {
      const info = await checkAppUpdate(APP_VERSION);
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        // ONLY prompt for APK reinstallation if it is a true native binary upgrade!
        // Content updates are already seamlessly handled by syncRemoteMediaData.
        if (info.isNativeUpgrade) {
          setShowUpdateModal(true);
        }
      }
    } catch (e) {}
  };

  const loadStorage = async () => {
    try {
      const [storedFavs, storedHistory] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
      ]);
      if (storedFavs) setFavorites(JSON.parse(storedFavs));
      if (storedHistory) setHistory(JSON.parse(storedHistory));
    } catch (e) {
      console.error("Failed to load storage in AppContext", e);
    }
  };

  const refreshDownloads = async () => {
    try {
      const stored = await getStoredDownloads();
      setDownloads(stored);
    } catch (e) {
      console.error("Failed to refresh downloads", e);
    }
  };

  const downloadMovie = async (
    item: MediaItem,
    target: DownloadTarget,
    episode?: Episode,
    onProgress?: (prog: number, dMB: number, tMB: number) => void
  ): Promise<DownloadItem> => {
    if (target === "server") {
      const result = await saveToServerLibrary(item, episode);
      await refreshDownloads();
      return result;
    } else {
      try {
        const resultPromise = serviceStartGallery(item, episode, onProgress);
        setTimeout(refreshDownloads, 300);
        const res = await resultPromise;
        await refreshDownloads();
        return res;
      } catch (err) {
        await refreshDownloads();
        throw err;
      }
    }
  };

  const removeDownload = async (id: string) => {
    await serviceDeleteDownload(id);
    await refreshDownloads();
  };

  const cancelActiveDownload = async (id: string) => {
    await serviceCancelDownload(id);
    await refreshDownloads();
  };

  const getDownload = useCallback((mediaId: string, episodeId?: string): DownloadItem | undefined => {
    const targetId = generateDownloadId(mediaId, episodeId);
    return downloads.find((d) => d.id === targetId);
  }, [downloads]);

  const toggleFavorite = async (item: MediaItem) => {
    try {
      const exists = favorites.some((fav) => fav.id === item.id);
      let updated: MediaItem[];
      if (exists) {
        updated = favorites.filter((fav) => fav.id !== item.id);
      } else {
        updated = [item, ...favorites];
      }
      setFavorites(updated);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  };

  const isFavorite = useCallback((id: string): boolean => {
    return favorites.some((fav) => fav.id === id);
  }, [favorites]);

  const recordProgress = async (
    item: MediaItem,
    currentTime: number,
    duration: number,
    episodeId?: string,
    episodeTitle?: string
  ) => {
    if (!duration || duration <= 0) return;
    const progressPercent = Math.min(100, Math.round((currentTime / duration) * 100));

    const filtered = history.filter((h) => h.id !== item.id);
    const newEntry: WatchHistoryItem = {
      id: item.id,
      item,
      currentTime,
      duration,
      progressPercent,
      episodeId,
      episodeTitle,
      updatedAt: Date.now(),
    };

    const updated = [newEntry, ...filtered].slice(0, 20);
    setHistory(updated);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save watch history", e);
    }
  };

  const removeHistoryItem = async (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
  };

  const isWatched = (id: string): boolean => {
    const found = history.find((h) => h.id === id);
    return found ? found.progressPercent >= 90 : false;
  };

  return (
    <AppContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        favoritesCount: favorites.length,
        history,
        recordProgress,
        removeHistoryItem,
        clearHistory,
        isWatched,
        downloads,
        downloadMovie,
        removeDownload,
        cancelActiveDownload,
        getDownload,
        refreshDownloads,
        isOffline,
        isRestored,
        dataVersion,
        syncData,
        syncToast,
        dismissSyncToast,
        restartApp,
        updateInfo,
        showUpdateModal,
        setShowUpdateModal,
        checkUpdates,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
