export interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  quality?: string;
  duration?: string;
  videoUrl: string;
  thumbnail?: string;
}

export interface Season {
  seasonNumber: number;
  seasonTitle: string;
  episodes: Episode[];
}

export interface BaseMedia {
  id: string;
  title: string;
  rawTitle?: string;
  url?: string;
  poster: string;
  backdrop?: string;
  quality?: string;
  year: number;
  country: string;
  genres: string[];
  actors?: string[];
  rating: number;
  description: string;
}

export interface Movie extends BaseMedia {
  type: 'movie';
  duration?: string;
  videoUrl: string;
}

export interface Series extends BaseMedia {
  type: 'series';
  totalSeasons: number;
  totalEpisodes: number;
  seasons: Season[];
}

export type MediaItem = Movie | Series;

export interface WatchHistoryItem {
  id: string;
  item: MediaItem;
  currentTime: number;
  duration: number;
  progressPercent: number;
  episodeId?: string;
  episodeTitle?: string;
  updatedAt: number;
}

export type DownloadTarget = 'gallery' | 'server';

export interface DownloadItem {
  id: string; // unique download id (e.g. movieId or movieId_episodeId)
  mediaId: string;
  item: MediaItem;
  target: DownloadTarget; // 'gallery' = internal device storage, 'server' = cloud server library (0 MB on phone)
  episodeId?: string;
  episodeTitle?: string;
  videoUrl: string;
  localUri?: string; // only if target === 'gallery' and completed
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number; // 0 to 1
  downloadedBytes: number;
  totalBytes: number;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
}
