import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/Header';
import { HeroSlider } from '../components/HeroSlider';
import { ContinueWatching } from '../components/ContinueWatching';
import { MediaCard } from '../components/MediaCard';
import { 
  getFeaturedMedia, 
  getMultfilms, 
  getDoramas, 
  getLatestPremieres,
  getTopRatedMedia,
  getTrendingSeries,
  getLatestMovies,
  getHindMovies,
  getThrillers,
} from '../services/dataService';
import { MediaItem } from '../types';

const QUICK_CATEGORIES = [
  { name: '🔥 Seriallar', type: 'series' },
  { name: '🐱‍🏍 Multfilmlar', genre: 'multfilm' },
  { name: '🎭 Dorama', genre: 'dorama' },
  { name: '⚡ 2025-2026', year: '2025' },
  { name: '🎬 Kinolar', type: 'movie' },
  { name: '💥 Jangari', genre: 'jangari' },
  { name: '🚀 Fantastika', genre: 'fantastika' },
  { name: '😂 Komediya', genre: 'komediya' },
  { name: '🔪 Triller', genre: 'triller' },
  { name: '🌟 Hind', genre: 'hind' },
  { name: '🥋 Koreya', genre: 'koreya' },
];

interface MediaSectionProps {
  title: string;
  indicatorColor: string;
  items: MediaItem[];
  moreText?: string;
  onMorePress?: () => void;
}

const MediaSection: React.FC<MediaSectionProps> = React.memo(({
  title,
  indicatorColor,
  items,
  moreText,
  onMorePress,
}) => {
  const renderItem = useCallback(({ item }: { item: MediaItem }) => (
    <MediaCard item={item} variant="carousel" />
  ), []);

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {onMorePress && (
          <TouchableOpacity onPress={onMorePress} style={styles.moreBtn}>
            <Text style={styles.moreText}>{moreText || 'Barchasi'}</Text>
            <Ionicons name="chevron-forward" size={14} color="#e50914" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScroll}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        removeClippedSubviews={true}
        getItemLayout={(_, index) => ({
          length: 152,
          offset: 152 * index,
          index,
        })}
      />
    </View>
  );
});

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loadBelowFold, setLoadBelowFold] = useState(false);

  // Staggered load to ensure instant 60fps initial paint without jank
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadBelowFold(true);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  // Precomputed O(1) instant collections
  const featured = useMemo(() => getFeaturedMedia(), []);
  const trendingSeries = useMemo(() => getTrendingSeries(), []);
  const topMultfilms = useMemo(() => getMultfilms(), []);
  const topDoramas = useMemo(() => getDoramas(), []);
  const topPremieres = useMemo(() => getLatestPremieres(), []);
  const latestMovies = useMemo(() => getLatestMovies(), []);
  const topRated = useMemo(() => getTopRatedMedia(), []);
  const hindMovies = useMemo(() => getHindMovies(), []);
  const thrillers = useMemo(() => getThrillers(), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Featured Hero Slider */}
        <HeroSlider items={featured.length > 0 ? featured : trendingSeries.slice(0, 5)} />

        {/* Continue Watching */}
        <ContinueWatching />

        {/* Quick Category Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          {QUICK_CATEGORIES.map((cat, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.catChip}
              onPress={() => {
                if (cat.type) {
                  navigation.navigate('CatalogTab', { screen: 'Catalog', params: { type: cat.type } });
                } else if (cat.genre) {
                  navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: cat.genre } });
                } else if ((cat as any).year) {
                  navigation.navigate('CatalogTab', { screen: 'Catalog', params: { year: (cat as any).year } });
                }
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.catChipText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section 1: Mashhur Seriallar */}
        <MediaSection
          title="📺 Seriallar — Barcha Qismlar"
          indicatorColor="#8b5cf6"
          items={trendingSeries}
          moreText="Barchasi"
          onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { type: 'series' } })}
        />

        {/* Section 2: Multfilmlar & Animatsiya */}
        <MediaSection
          title="🐱‍🏍 Multfilmlar & Animatsiya"
          indicatorColor="#f59e0b"
          items={topMultfilms}
          moreText="Barchasi"
          onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'multfilm' } })}
        />

        {/* Section 3: Doramalar & Sharq Seriallari */}
        <MediaSection
          title="🎭 Dorama & Sharq Seriallari"
          indicatorColor="#ec4899"
          items={topDoramas}
          moreText="Barchasi"
          onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'dorama' } })}
        />

        {/* Below-the-fold sections loaded smoothly */}
        {loadBelowFold && (
          <>
            {/* Section 4: 2024-2026 Premyeralar */}
            <MediaSection
              title="⚡ 2024-2026 Yangi Premyeralar"
              indicatorColor="#10b981"
              items={topPremieres}
              moreText="Barchasi"
              onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { year: '2025' } })}
            />

            {/* Section 5: So'nggi Premyera Kinolar */}
            <MediaSection
              title="🎬 So'nggi Premyera Kinolar"
              indicatorColor="#00f2fe"
              items={latestMovies}
              moreText="Barchasi"
              onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { type: 'movie' } })}
            />

            {/* Section 6: Eng Yuqori Baholanganlar */}
            <MediaSection
              title="⭐ Eng Yuqori Reytingli"
              indicatorColor="#ffb703"
              items={topRated}
              moreText="Barchasi"
              onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { sort: 'rating' } })}
            />

            {/* Section 7: Hind Kinolari */}
            <MediaSection
              title="🌟 Hind Kinolari"
              indicatorColor="#f59e0b"
              items={hindMovies}
              moreText="Barchasi"
              onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'hind' } })}
            />

            {/* Section 8: Thrillers */}
            <MediaSection
              title="🔪 Shiddatli Trillerlar"
              indicatorColor="#ef4444"
              items={thrillers}
              moreText="Barchasi"
              onMorePress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'triller' } })}
            />

            {/* Presentation Banner */}
            <View style={styles.banner}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>1,170+ KINO · 300+ SERIAL · 5,000+ QISM · 1080P FHD</Text>
              </View>
              <Text style={styles.bannerTitle}>
                FilmX — O'zbek tilidagi kinolar, seriallar va multfilmlar olami
              </Text>
              <Text style={styles.bannerDesc}>
                Reklamasiz, yuqori Tas-ix tezlikda multfilmlar, seriallar, doramalar va barcha yangi premyeralarni tomosha qiling.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  scroll: {
    flex: 1,
  },
  catScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginVertical: 12,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#e50914',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  moreText: {
    color: '#e50914',
    fontSize: 13,
    fontWeight: '700',
  },
  hScroll: {
    paddingHorizontal: 16,
  },
  banner: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  bannerBadgeText: {
    color: '#ff4d6d',
    fontSize: 10,
    fontWeight: '900',
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  bannerDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
});
