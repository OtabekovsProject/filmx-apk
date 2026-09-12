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
