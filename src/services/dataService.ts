import { Movie, Series, MediaItem } from '../types';

// Load static curated data
const rawMovies: Movie[] = require('../../assets/data/movies.json');
const rawSeries: Series[] = require('../../assets/data/series.json');

// Initialize memoized collections
let cachedMovies: Movie[] = [];
let cachedSeries: Series[] = [];
let cachedAll: MediaItem[] = [];
let mediaMap = new Map<string, MediaItem>();

function initData() {
  if (cachedAll.length > 0) return;

  const movieMap = new Map<string, Movie>();
  rawMovies.forEach((m) => {
    if (!movieMap.has(m.id)) {
      movieMap.set(m.id, m);
    }
  });
  cachedMovies = Array.from(movieMap.values());

  const seriesMap = new Map<string, Series>();
  rawSeries.forEach((s) => {
    if (!seriesMap.has(s.id)) {
      seriesMap.set(s.id, s);
    }
  });
  cachedSeries = Array.from(seriesMap.values());

  cachedAll = [...cachedMovies, ...cachedSeries];
  cachedAll.forEach((item) => {
    mediaMap.set(item.id, item);
  });
}

initData();

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
  return cachedAll.filter((item) => (item.rating || 0) >= 8.5).slice(0, 10);
}

export interface FilterOptions {
  query?: string;
  type?: 'all' | 'movie' | 'series';
  genre?: string;
  country?: string;
  year?: string;
  minRating?: number;
  sortBy?: 'newest' | 'rating' | 'episodes' | 'alpha' | 'oldest';
}

export function filterMedia(options: FilterOptions): MediaItem[] {
  initData();
  let result = cachedAll.filter((item) => {
    // Type filter
    if (options.type && options.type !== 'all' && item.type !== options.type) {
      return false;
    }

    // Genre filter
    if (options.genre && options.genre !== 'all') {
      const lowerG = options.genre.toLowerCase();
      const genreMatch = item.genres?.some((g) => g.toLowerCase().includes(lowerG));
      const titleMatch = item.title?.toLowerCase().includes(lowerG);
      if (!genreMatch && !titleMatch) return false;
    }

    // Country filter
    if (options.country && options.country !== 'all') {
      const lowerC = options.country.toLowerCase();
      const countryMatch = item.country?.toLowerCase().includes(lowerC);
      const titleMatch = item.title?.toLowerCase().includes(lowerC);
      if (!countryMatch && !titleMatch) return false;
    }

    // Year filter
    if (options.year && options.year !== 'all') {
      if (options.year === '2026' && item.year !== 2026) return false;
      if (options.year === '2025' && item.year !== 2025) return false;
      if (options.year === '2024' && item.year !== 2024) return false;
      if (options.year === '2020-2023' && (item.year < 2020 || item.year > 2023)) return false;
      if (options.year === '2010-2019' && (item.year < 2010 || item.year > 2019)) return false;
      if (options.year === '2000-2009' && (item.year < 2000 || item.year > 2009)) return false;
      if (options.year === 'retro' && item.year >= 2000) return false;
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
  const sort = options.sortBy || 'newest';
  return result.sort((a, b) => {
    if (sort === 'newest') {
      return (b.year - a.year) || ((b.rating || 0) - (a.rating || 0));
    }
    if (sort === 'oldest') {
      return a.year - b.year;
    }
    if (sort === 'rating') {
      return ((b.rating || 0) - (a.rating || 0)) || (b.year - a.year);
    }
    if (sort === 'episodes') {
      const epsA = a.type === 'series' ? (a as Series).totalEpisodes || 1 : 1;
      const epsB = b.type === 'series' ? (b as Series).totalEpisodes || 1 : 1;
      return epsB - epsA;
    }
    if (sort === 'alpha') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });
}
