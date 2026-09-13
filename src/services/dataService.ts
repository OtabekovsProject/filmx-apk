import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Movie, Series, MediaItem } from "../types";

// Load static curated bundled data for 0ms instant launch
const rawMovies: Movie[] = require("../../assets/data/movies.json");
const rawSeries: Series[] = require("../../assets/data/series.json");

const DATA_DIR = `${FileSystem.documentDirectory}filmx_data/`;
const MOVIES_FILE = `${DATA_DIR}movies.json`;
const SERIES_FILE = `${DATA_DIR}series.json`;
const SYNC_META_KEY = "@filmx_last_data_sync_meta_v1";

// Remote live sources (FilmX official web & raw repo data)
const REMOTE_MOVIES_URL = "https://raw.githubusercontent.com/OtabekovsProject/filmx-series/main/src/data/movies.json";
const REMOTE_SERIES_URL = "https://raw.githubusercontent.com/OtabekovsProject/filmx-series/main/src/data/series.json";
const BACKUP_MOVIES_URL = "https://raw.githubusercontent.com/OtabekovsProject/filmx-apk/main/assets/data/movies.json";
const BACKUP_SERIES_URL = "https://raw.githubusercontent.com/OtabekovsProject/filmx-apk/main/assets/data/series.json";

// In-memory collections
let cachedMovies: Movie[] = [];
let cachedSeries: Series[] = [];
let cachedAll: MediaItem[] = [];
let mediaMap = new Map<string, MediaItem>();

// Pre-computed collections for instant 60fps rendering without jank
let cachedFeatured: MediaItem[] = [];
let cachedMultfilms: MediaItem[] = [];
let cachedDoramas: MediaItem[] = [];
let cachedPremieres: MediaItem[] = [];
let cachedTopRated: MediaItem[] = [];
let cachedTrendingSeries: Series[] = [];
let cachedLatestMovies: Movie[] = [];
let cachedHind: MediaItem[] = [];
let cachedThrillers: MediaItem[] = [];
let lastSyncTimestamp = 0;

// Subscribers for real-time live in-app data updates
export type DataUpdateListener = (info: {
  updated: boolean;
  totalItems: number;
  newItemsCount: number;
  timestamp: number;
}) => void;

const updateListeners = new Set<DataUpdateListener>();

export function subscribeDataUpdates(listener: DataUpdateListener): () => void {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

function notifyDataListeners(newItemsCount: number) {
  const info = {
    updated: true,
    totalItems: cachedAll.length,
    newItemsCount,
    timestamp: Date.now(),
  };
  updateListeners.forEach((l) => {
    try {
      l(info);
    } catch (e) {
      console.warn("Listener error in dataService:", e);
    }
  });
}

function reindexCollections(movies: Movie[], series: Series[]) {
  const movieMap = new Map<string, Movie>();
  movies.forEach((m) => {
    if (m && m.id && !movieMap.has(m.id)) {
      movieMap.set(m.id, m);
    }
  });
  cachedMovies = Array.from(movieMap.values());

  const seriesMap = new Map<string, Series>();
  series.forEach((s) => {
    if (s && s.id && !seriesMap.has(s.id)) {
      seriesMap.set(s.id, s);
    }
  });
  cachedSeries = Array.from(seriesMap.values());

  cachedAll = [...cachedMovies, ...cachedSeries];
  mediaMap.clear();
  cachedAll.forEach((item) => {
    mediaMap.set(item.id, item);
  });

  // Pre-calculate all sections once to ensure 0ms render times
  cachedTrendingSeries = cachedSeries.slice(0, 14);
  cachedLatestMovies = cachedMovies.slice(0, 16);

  cachedFeatured = cachedAll.filter((item) => (item.rating || 0) >= 8.5).slice(0, 10);

  cachedTopRated = [...cachedAll]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 14);

  cachedMultfilms = cachedAll
    .filter(
      (item) =>
        item.genres?.some((g) => {
          const lg = g.toLowerCase();
          return lg.includes("mult") || lg.includes("anim") || lg.includes("anime");
        }) ||
        item.title.toLowerCase().includes("multfilm") ||
        item.title.toLowerCase().includes("anime")
    )
    .sort((a, b) => b.year - a.year || (b.rating || 0) - (a.rating || 0))
    .slice(0, 14);

  cachedDoramas = cachedAll
    .filter(
      (item) =>
        item.genres?.some((g) => g.toLowerCase().includes("dorama") || g.toLowerCase().includes("koreys")) ||
        (item.type === "series" && item.country?.toLowerCase().includes("koreya")) ||
        item.title.toLowerCase().includes("dorama")
    )
    .sort((a, b) => b.year - a.year || (b.rating || 0) - (a.rating || 0))
    .slice(0, 14);

  cachedPremieres = cachedAll
    .filter((item) => item.year >= 2024)
    .sort((a, b) => b.year - a.year || (b.rating || 0) - (a.rating || 0))
    .slice(0, 14);

  cachedHind = cachedMovies
    .filter(
      (m) =>
        m.country?.toLowerCase().includes("hind") ||
        m.genres?.some((g) => g.toLowerCase().includes("hind"))
    )
    .slice(0, 12);

  cachedThrillers = cachedAll
    .filter((m) => m.genres?.some((g) => g.toLowerCase().includes("triller")))
    .slice(0, 12);
}

// Initial synchronous load for instant 0ms app start
function initData() {
  if (cachedAll.length > 0) return;
  reindexCollections(rawMovies, rawSeries);
}

initData();

// Asynchronous background load of persistent local cache
(async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(DATA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
    }
    const [moviesInfo, seriesInfo] = await Promise.all([
      FileSystem.getInfoAsync(MOVIES_FILE),
      FileSystem.getInfoAsync(SERIES_FILE),
    ]);

    if (moviesInfo.exists && seriesInfo.exists) {
      const [savedMoviesStr, savedSeriesStr] = await Promise.all([
        FileSystem.readAsStringAsync(MOVIES_FILE),
        FileSystem.readAsStringAsync(SERIES_FILE),
      ]);
      const savedMovies: Movie[] = JSON.parse(savedMoviesStr);
      const savedSeries: Series[] = JSON.parse(savedSeriesStr);

      if (Array.isArray(savedMovies) && Array.isArray(savedSeries)) {
        if (savedMovies.length + savedSeries.length >= rawMovies.length + rawSeries.length) {
          reindexCollections(savedMovies, savedSeries);
          notifyDataListeners(0);
        }
      }
    }
  } catch (e) {
    // Fall back to bundled data
  }
})();

export interface SyncResult {
  success: boolean;
  updated: boolean;
  newItemsCount: number;
  totalItems: number;
  error?: string;
}

let isSyncing = false;

/**
 * Automatically syncs newest movies & series from GitHub/Web source in background.
 * Updates local cache and notifies UI listeners without prompting user to reinstall APK!
 */
export async function syncRemoteMediaData(force = false): Promise<SyncResult> {
  if (isSyncing) {
    return {
      success: true,
      updated: false,
      newItemsCount: 0,
      totalItems: cachedAll.length,
    };
  }

  isSyncing = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let moviesRes = await fetch(REMOTE_MOVIES_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    }).catch(() => null);

    let seriesRes = await fetch(REMOTE_SERIES_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    }).catch(() => null);

    // Fallback if primary endpoint fails
    if (!moviesRes || !moviesRes.ok) {
      moviesRes = await fetch(BACKUP_MOVIES_URL, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      }).catch(() => null);
    }

    if (!seriesRes || !seriesRes.ok) {
      seriesRes = await fetch(BACKUP_SERIES_URL, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      }).catch(() => null);
    }

    clearTimeout(timeout);

    if (!moviesRes || !moviesRes.ok || !seriesRes || !seriesRes.ok) {
      throw new Error("Tizim bilan bog\x27lanishda kechikish yuz berdi");
    }

    const [fetchedMovies, fetchedSeries] = await Promise.all([
      moviesRes.json() as Promise<Movie[]>,
      seriesRes.json() as Promise<Series[]>,
    ]);

    if (!Array.isArray(fetchedMovies) || !Array.isArray(fetchedSeries)) {
      throw new Error("Noto\x27g\x27ri ma\x27lumot formati");
    }

    const previousCount = cachedAll.length;
    const newCount = fetchedMovies.length + fetchedSeries.length;
    const diff = newCount - previousCount;

    if (diff > 0 || force || newCount !== previousCount) {
      reindexCollections(fetchedMovies, fetchedSeries);
      lastSyncTimestamp = Date.now();

      // Persist to local disk asynchronously
      try {
        const dirInfo = await FileSystem.getInfoAsync(DATA_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
        }
        await Promise.all([
          FileSystem.writeAsStringAsync(MOVIES_FILE, JSON.stringify(fetchedMovies)),
          FileSystem.writeAsStringAsync(SERIES_FILE, JSON.stringify(fetchedSeries)),
          AsyncStorage.setItem(
            SYNC_META_KEY,
            JSON.stringify({
              lastSync: lastSyncTimestamp,
              moviesCount: fetchedMovies.length,
              seriesCount: fetchedSeries.length,
            })
          ),
        ]);
      } catch (diskErr) {
        console.warn("Disk cache save warning:", diskErr);
      }

      // Notify UI reactively
      notifyDataListeners(Math.max(0, diff));

      isSyncing = false;
      return {
        success: true,
        updated: true,
        newItemsCount: Math.max(0, diff),
        totalItems: cachedAll.length,
      };
    }

    lastSyncTimestamp = Date.now();
    isSyncing = false;
    return {
      success: true,
      updated: false,
      newItemsCount: 0,
      totalItems: cachedAll.length,
    };
  } catch (err: any) {
    isSyncing = false;
    return {
      success: false,
      updated: false,
      newItemsCount: 0,
      totalItems: cachedAll.length,
      error: err?.message || "Sync failed",
    };
  }
}

export function getDataStats() {
  initData();
  return {
    moviesCount: cachedMovies.length,
    seriesCount: cachedSeries.length,
    totalCount: cachedAll.length,
    lastSyncTimestamp,
  };
}

export function getMovies(): Movie[] {
  initData();
  return cachedMovies;
}

export function getSeries(): Series[] {
  initData();
  return cachedSeries;
}

export function getAllMedia(): MediaItem[] {
  initData();
  return cachedAll;
}

export function getMediaById(id: string): MediaItem | undefined {
  initData();
  return mediaMap.get(id);
}

export function getFeaturedMedia(): MediaItem[] {
  initData();
  return cachedFeatured;
}

export function getMultfilms(): MediaItem[] {
  initData();
  return cachedMultfilms;
}

export function getDoramas(): MediaItem[] {
  initData();
  return cachedDoramas;
}

export function getLatestPremieres(): MediaItem[] {
  initData();
  return cachedPremieres;
}

export function getTopRatedMedia(): MediaItem[] {
  initData();
  return cachedTopRated;
}

export function getTrendingSeries(): Series[] {
  initData();
  return cachedTrendingSeries;
}

export function getLatestMovies(): Movie[] {
  initData();
  return cachedLatestMovies;
}

export function getHindMovies(): MediaItem[] {
  initData();
  return cachedHind;
}

export function getThrillers(): MediaItem[] {
  initData();
  return cachedThrillers;
}

export interface FilterOptions {
  query?: string;
  type?: "all" | "movie" | "series";
  genre?: string;
  country?: string;
  year?: string;
  minRating?: number;
  sortBy?: "newest" | "rating" | "episodes" | "alpha" | "oldest";
}

export function filterMedia(options: FilterOptions): MediaItem[] {
  initData();
  let result = cachedAll.filter((item) => {
    // Type filter
    if (options.type && options.type !== "all" && item.type !== options.type) {
      return false;
    }

    // Genre filter
    if (options.genre && options.genre !== "all") {
      const lowerG = options.genre.toLowerCase();
      let matches = false;
      if (lowerG === "multfilm" || lowerG === "animatsiya") {
        matches = !!(
          item.genres?.some((g) => {
            const lg = g.toLowerCase();
            return lg.includes("mult") || lg.includes("anim") || lg.includes("anime");
          }) ||
          item.title.toLowerCase().includes("multfilm") ||
          item.title.toLowerCase().includes("anime")
        );
      } else if (lowerG === "dorama") {
        matches = !!(
          item.genres?.some((g) => g.toLowerCase().includes("dorama") || g.toLowerCase().includes("koreys")) ||
          (item.type === "series" && item.country?.toLowerCase().includes("koreya")) ||
          item.title.toLowerCase().includes("dorama")
        );
      } else {
        const genreMatch = item.genres?.some((g) => g.toLowerCase().includes(lowerG));
        const titleMatch = item.title?.toLowerCase().includes(lowerG);
        matches = !!(genreMatch || titleMatch);
      }
      if (!matches) return false;
    }

    // Country filter
    if (options.country && options.country !== "all") {
      const lowerC = options.country.toLowerCase();
      const countryMatch = item.country?.toLowerCase().includes(lowerC);
      const titleMatch = item.title?.toLowerCase().includes(lowerC);
      if (!countryMatch && !titleMatch) return false;
    }

    // Year filter
    if (options.year && options.year !== "all") {
      if (options.year === "2026" && item.year !== 2026) return false;
      if (options.year === "2025" && item.year !== 2025) return false;
      if (options.year === "2024" && item.year !== 2024) return false;
      if (options.year === "2020-2023" && (item.year < 2020 || item.year > 2023)) return false;
      if (options.year === "2010-2019" && (item.year < 2010 || item.year > 2019)) return false;
      if (options.year === "2000-2009" && (item.year < 2000 || item.year > 2009)) return false;
      if (options.year === "retro" && item.year >= 2000) return false;
    }

    // Rating filter
    if (options.minRating && options.minRating > 0) {
      if ((item.rating || 0) < options.minRating) return false;
    }

    // Query filter
    if (options.query && options.query.trim()) {
      const q = options.query.toLowerCase().trim();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const actorMatch = item.actors?.some((a) => a.toLowerCase().includes(q));
      const genreMatch = item.genres?.some((g) => g.toLowerCase().includes(q));
      const countryMatch = item.country?.toLowerCase().includes(q);
      if (!titleMatch && !actorMatch && !genreMatch && !countryMatch) {
        return false;
      }
    }

    return true;
  });

  // Sort
  const sort = options.sortBy || "newest";
  return result.sort((a, b) => {
    if (sort === "newest") {
      return b.year - a.year || (b.rating || 0) - (a.rating || 0);
    }
    if (sort === "oldest") {
      return a.year - b.year;
    }
    if (sort === "rating") {
      return (b.rating || 0) - (a.rating || 0) || b.year - a.year;
    }
    if (sort === "episodes") {
      const epsA = a.type === "series" ? (a as Series).totalEpisodes || 1 : 1;
      const epsB = b.type === "series" ? (b as Series).totalEpisodes || 1 : 1;
      return epsB - epsA;
    }
    if (sort === "alpha") {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });
}
