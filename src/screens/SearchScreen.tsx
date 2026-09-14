import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MediaCard } from '../components/MediaCard';
import { filterMedia, getFeaturedMedia } from '../services/dataService';
import { searchAndRank } from '../services/searchUtils';
import { MediaItem } from '../types';

const { width } = Dimensions.get('window');
const SEARCH_HISTORY_KEY = '@filmx_search_history_v1';

const QUICK_CATEGORIES = [
  { label: 'Barchasi', type: 'all', genre: 'all' },
  { label: '🎬 Kinolar', type: 'movie', genre: 'all' },
  { label: '📺 Seriallar', type: 'series', genre: 'all' },
  { label: '🐱‍🏍 Multfilmlar', type: 'all', genre: 'multfilm' },
  { label: '🎭 Doramalar', type: 'all', genre: 'dorama' },
  { label: '⚡ 2025 Premyera', type: 'all', genre: 'all', year: '2025' },
  { label: '💥 Jangari', type: 'all', genre: 'jangari' },
  { label: '😂 Komediya', type: 'all', genre: 'komediya' },
  { label: '🚀 Fantastika', type: 'all', genre: 'fantastika' },
];

const POPULAR_SEARCHES = [
  'Garri Potter',
  'Qasoskorlar',
  'Forsaj',
  'Avatar',
  'Taksi',
  'Jangari',
  'Multfilm',
  'Dorama',
  'Komediya',
  'Fantastika',
];

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // Load search history on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch (e) {}
    })();
  }, []);

  // Save new search query to history
  const saveToHistory = useCallback(
    async (searchTerm: string) => {
      const term = searchTerm.trim();
      if (!term || term.length < 2) return;
      try {
        const filtered = history.filter((h) => h.toLowerCase() !== term.toLowerCase());
        const updated = [term, ...filtered].slice(0, 10);
        setHistory(updated);
        await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {}
    },
    [history]
  );

  const removeHistoryItem = async (term: string) => {
    try {
      const updated = history.filter((h) => h !== term);
      setHistory(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const clearAllHistory = async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {}
  };

  // Debounce search input for ultra-smooth 60fps typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim().length >= 2) {
        saveToHistory(query);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [query, saveToHistory]);

  const activeCategory = QUICK_CATEGORIES[activeCategoryIdx];

  // Smart search: uses scoring engine when query is present, category filter otherwise
  const results = useMemo(() => {
    const hasQuery = debouncedQuery.trim().length > 0;
    const isFiltered = activeCategoryIdx > 0;

    if (!hasQuery && !isFiltered) {
      return [];
    }

    // When there's a text query: use smart searchAndRank for relevance scoring
    if (hasQuery) {
      const pool = filterMedia({
        type: activeCategory.type as any,
        genre: activeCategory.genre !== 'all' ? activeCategory.genre : undefined,
        year: activeCategory.year,
      });
      return searchAndRank(pool, debouncedQuery, 80);
    }

    // Category-only filter (no text)
    return filterMedia({
      type: activeCategory.type as any,
      genre: activeCategory.genre !== 'all' ? activeCategory.genre : undefined,
      year: activeCategory.year,
    });
  }, [debouncedQuery, activeCategory, activeCategoryIdx]);

  const featured = useMemo(() => getFeaturedMedia().slice(0, 6), []);


  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    Keyboard.dismiss();
  };

  const canGoBack = navigation.canGoBack();

  const handleBack = () => {
    if (canGoBack) {
      navigation.goBack();
    } else {
      navigation.navigate('HomeTab');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Search Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color="#e50914" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Kino nomi, aktyor yoki janr..."
            placeholderTextColor="#64748b"
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (query.trim()) saveToHistory(query);
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.viewModeBtn}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={viewMode === 'grid' ? 'grid-outline' : 'list-outline'}
            size={20}
            color="#00f2fe"
          />
        </TouchableOpacity>
      </View>

      {/* Category Filter Chips Bar */}
      <View style={styles.categoriesBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {QUICK_CATEGORIES.map((cat, idx) => {
            const isActive = activeCategoryIdx === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.categoryChip, isActive && styles.activeCategoryChip]}
                onPress={() => setActiveCategoryIdx(idx)}
                activeOpacity={0.75}
              >
                <Text style={[styles.categoryChipText, isActive && styles.activeCategoryChipText]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {query.trim().length === 0 && activeCategoryIdx === 0 ? (
        <ScrollView
          style={styles.exploreScroll}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recent Searches Section */}
          {history.length > 0 && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🕒 So'nggi qidiruvlar</Text>
                <TouchableOpacity onPress={clearAllHistory}>
                  <Text style={styles.clearAllText}>Tozalash</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.historyChipsWrap}>
                {history.map((term, idx) => (
                  <View key={idx} style={styles.historyChip}>
                    <TouchableOpacity
                      style={styles.historyTextTouch}
                      onPress={() => handleSelectSuggestion(term)}
                    >
                      <Ionicons name="time-outline" size={14} color="#64748b" />
                      <Text style={styles.historyText} numberOfLines={1}>
                        {term}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeHistoryItem(term)}
                      style={styles.historyRemoveBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Popular Searches Section */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>🔥 Ommabop qidiruvlar</Text>
            <View style={styles.chipsWrap}>
              {POPULAR_SEARCHES.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.popularChip}
                  onPress={() => handleSelectSuggestion(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trending-up" size={14} color="#e50914" />
                  <Text style={styles.popularChipText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recommended Featured Movies */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>⭐ Siz uchun tavsiyalar</Text>
            <View style={styles.recommendGrid}>
              {featured.map((item) => (
                <MediaCard key={item.id} item={item} variant="grid" />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Results Summary Bar */}
          <View style={styles.resultsInfoRow}>
            <Text style={styles.resultsCountText}>
              {debouncedQuery.trim() ? (
                <>
                  "<Text style={{ color: '#fff', fontWeight: '800' }}>{debouncedQuery}</Text>" bo'yicha{' '}
                </>
              ) : (
                <>{activeCategory.label}: </>
              )}
              <Text style={{ color: '#e50914', fontWeight: '800' }}>{results.length}</Text> ta natija
            </Text>
          </View>

          {results.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="film-outline" size={54} color="#334155" />
              <Text style={styles.emptyTitle}>Hech narsa topilmadi</Text>
              <Text style={styles.emptyDesc}>
                Boshqa nom, aktyor yoki janr bo'yicha qidirib ko'ring.
              </Text>
            </View>
          ) : (
            <FlatList
              key={viewMode}
              data={results}
              keyExtractor={(item) => item.id}
              numColumns={viewMode === 'grid' ? 2 : 1}
              columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapper : undefined}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <MediaCard item={item} variant={viewMode === 'grid' ? 'grid' : 'list'} />
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: 'rgba(7, 10, 18, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1422',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 0,
  },
  viewModeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesBarWrap: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeCategoryChip: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  activeCategoryChipText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  exploreScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionWrap: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '800',
  },
  clearAllText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  historyChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1422',
    borderRadius: 18,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxWidth: '48%',
  },
  historyTextTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  historyText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  historyRemoveBtn: {
    padding: 4,
    marginLeft: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  popularChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  recommendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  resultsInfoRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsCountText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 60,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
