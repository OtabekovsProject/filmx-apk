import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/Header';
import { HeroSlider } from '../components/HeroSlider';
import { ContinueWatching } from '../components/ContinueWatching';
import { MediaCard } from '../components/MediaCard';
import { 
  getMovies, 
  getSeries, 
  getFeaturedMedia, 
  getMultfilms, 
  getDoramas, 
  getLatestPremieres 
} from '../services/dataService';

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

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const movies = useMemo(() => getMovies(), []);
  const series = useMemo(() => getSeries(), []);
  const featured = useMemo(() => getFeaturedMedia(), []);
  const multfilms = useMemo(() => getMultfilms(), []);
  const doramas = useMemo(() => getDoramas(), []);
  const latestPremieres = useMemo(() => getLatestPremieres(), []);

  const trendingSeries = series.slice(0, 10);
  const latestMovies = movies.slice(0, 12);
  const topRated = [...movies, ...series]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 10);
  const topMultfilms = multfilms.slice(0, 10);
  const topDoramas = doramas.slice(0, 10);
  const topPremieres = latestPremieres.slice(0, 10);
  const hindMovies = movies.filter(m => m.country?.toLowerCase().includes('hind') || m.genres?.some(g => g.toLowerCase().includes('hind'))).slice(0, 8);
  const thrillers = [...movies, ...series].filter(m => m.genres?.some(g => g.toLowerCase().includes('triller'))).slice(0, 8);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Featured Hero Slider */}
        <HeroSlider items={featured.length > 0 ? featured : series.slice(0, 5)} />

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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={[styles.indicator, { backgroundColor: '#8b5cf6' }]} />
              <Text style={styles.sectionTitle}>📺 Seriallar — Barcha Qismlar</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { type: 'series' } })}
              style={styles.moreBtn}
            >
              <Text style={styles.moreText}>Barchasi ({series.length})</Text>
              <Ionicons name="chevron-forward" size={14} color="#e50914" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {trendingSeries.map((item) => (
              <MediaCard key={item.id} item={item} variant="carousel" />
            ))}
          </ScrollView>
        </View>

        {/* Section 2: Multfilmlar & Animatsiya */}
        {topMultfilms.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <View style={[styles.indicator, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.sectionTitle}>🐱‍🏍 Multfilmlar & Animatsiya</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'multfilm' } })}
                style={styles.moreBtn}
              >
                <Text style={styles.moreText}>Barchasi ({multfilms.length})</Text>
                <Ionicons name="chevron-forward" size={14} color="#e50914" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {topMultfilms.map((item) => (
                <MediaCard key={item.id} item={item} variant="carousel" />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section 3: Doramalar & Sharq Seriallari */}
        {topDoramas.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <View style={[styles.indicator, { backgroundColor: '#ec4899' }]} />
                <Text style={styles.sectionTitle}>🎭 Dorama & Sharq Seriallari</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'dorama' } })}
                style={styles.moreBtn}
              >
                <Text style={styles.moreText}>Barchasi ({doramas.length})</Text>
                <Ionicons name="chevron-forward" size={14} color="#e50914" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {topDoramas.map((item) => (
                <MediaCard key={item.id} item={item} variant="carousel" />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section 4: 2024-2026 Premyeralar */}
        {topPremieres.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <View style={[styles.indicator, { backgroundColor: '#10b981' }]} />
                <Text style={styles.sectionTitle}>⚡ 2024-2026 Yangi Premyeralar</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { year: '2025' } })}
                style={styles.moreBtn}
              >
                <Text style={styles.moreText}>Barchasi ({latestPremieres.length})</Text>
                <Ionicons name="chevron-forward" size={14} color="#e50914" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {topPremieres.map((item) => (
                <MediaCard key={item.id} item={item} variant="carousel" />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section 5: So'nggi Premyera Kinolar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={[styles.indicator, { backgroundColor: '#00f2fe' }]} />
              <Text style={styles.sectionTitle}>🎬 So'nggi Premyera Kinolar</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { type: 'movie' } })}
              style={styles.moreBtn}
            >
              <Text style={styles.moreText}>Barchasi</Text>
              <Ionicons name="chevron-forward" size={14} color="#e50914" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {latestMovies.map((item) => (
              <MediaCard key={item.id} item={item} variant="carousel" />
            ))}
          </ScrollView>
        </View>

        {/* Section 6: Eng Yuqori Baholanganlar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={[styles.indicator, { backgroundColor: '#ffb703' }]} />
              <Text style={styles.sectionTitle}>⭐ Eng Yuqori Reytingli</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { sort: 'rating' } })}
              style={styles.moreBtn}
            >
              <Text style={styles.moreText}>Barchasi</Text>
              <Ionicons name="chevron-forward" size={14} color="#e50914" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {topRated.map((item) => (
              <MediaCard key={item.id} item={item} variant="carousel" />
            ))}
          </ScrollView>
        </View>

        {/* Section 7: Hind Kinolari */}
        {hindMovies.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <View style={[styles.indicator, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.sectionTitle}>🌟 Hind Kinolari</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'hind' } })}
                style={styles.moreBtn}
              >
                <Text style={styles.moreText}>Barchasi</Text>
                <Ionicons name="chevron-forward" size={14} color="#e50914" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {hindMovies.map((item) => (
                <MediaCard key={item.id} item={item} variant="carousel" />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section 8: Thrillers */}
        {thrillers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <View style={[styles.indicator, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.sectionTitle}>🔪 Shiddatli Trillerlar</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('CatalogTab', { screen: 'Catalog', params: { genre: 'triller' } })}
                style={styles.moreBtn}
              >
                <Text style={styles.moreText}>Barchasi</Text>
                <Ionicons name="chevron-forward" size={14} color="#e50914" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {thrillers.map((item) => (
                <MediaCard key={item.id} item={item} variant="carousel" />
              ))}
            </ScrollView>
          </View>
        )}

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
