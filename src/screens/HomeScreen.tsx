import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Header } from "../components/Header";
import { HeroSlider } from "../components/HeroSlider";
import { ContinueWatching } from "../components/ContinueWatching";
import { MediaCard } from "../components/MediaCard";
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
  getDataStats,
} from "../services/dataService";
import { MediaItem } from "../types";
import { useApp } from "../context/AppContext";

const QUICK_CATEGORIES = [
  { name: "🔥 Seriallar", type: "series" },
  { name: "🐱‍🏍 Multfilmlar", genre: "multfilm" },
  { name: "🎭 Dorama", genre: "dorama" },
  { name: "⚡ 2025-2026", year: "2025" },
  { name: "🎬 Kinolar", type: "movie" },
  { name: "💥 Jangari", genre: "jangari" },
  { name: "🚀 Fantastika", genre: "fantastika" },
  { name: "😂 Komediya", genre: "komediya" },
  { name: "🔪 Triller", genre: "triller" },
  { name: "🌟 Hind", genre: "hind" },
  { name: "🥋 Koreya", genre: "koreya" },
];

interface MediaSectionProps {
  title: string;
  indicatorColor: string;
  items: MediaItem[];
  moreText?: string;
  onMorePress?: () => void;
}

const MediaSection: React.FC<MediaSectionProps> = React.memo(
  ({ title, indicatorColor, items, moreText, onMorePress }) => {
    const renderItem = useCallback(
      ({ item }: { item: MediaItem }) => <MediaCard item={item} variant="carousel" />,
      []
    );

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
              <Text style={styles.moreText}>{moreText || "Barchasi"}</Text>
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
          initialNumToRender={4}
          maxToRenderPerBatch={4}
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
  }
);

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { dataVersion, syncData } = useApp();
  const [loadBelowFold, setLoadBelowFold] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Staggered load to ensure instant 60fps initial paint without jank
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadBelowFold(true);
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncData(true);
    } finally {
      setRefreshing(false);
    }
  }, [syncData]);

  // Precomputed collections reactive to real-time live data updates
  const featured = useMemo(() => getFeaturedMedia(), [dataVersion]);
  const trendingSeries = useMemo(() => getTrendingSeries(), [dataVersion]);
  const topMultfilms = useMemo(() => getMultfilms(), [dataVersion]);
  const topDoramas = useMemo(() => getDoramas(), [dataVersion]);
  const topPremieres = useMemo(() => getLatestPremieres(), [dataVersion]);
  const latestMovies = useMemo(() => getLatestMovies(), [dataVersion]);
  const topRated = useMemo(() => getTopRatedMedia(), [dataVersion]);
  const hindMovies = useMemo(() => getHindMovies(), [dataVersion]);
  const thrillers = useMemo(() => getThrillers(), [dataVersion]);
  const stats = useMemo(() => getDataStats(), [dataVersion]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Header />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e50914"
            colors={["#e50914", "#00f2fe"]}
          />
        }
      >
        {/* Featured Hero Slider */}
        <HeroSlider items={featured.length > 0 ? featured : trendingSeries.slice(0, 5)} />

        {/* Continue Watching */}
        <ContinueWatching />

        {/* Quick Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {QUICK_CATEGORIES.map((cat, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.catChip}
              onPress={() => {
                if (cat.type) {
                  navigation.navigate("CatalogTab", { type: cat.type });
                } else if (cat.genre) {
                  navigation.navigate("CatalogTab", { genre: cat.genre });
                } else if (cat.year) {
                  navigation.navigate("CatalogTab", { year: cat.year });
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.catChipText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 1. Trending Series */}
        <MediaSection
          title="📺 Ommabop Seriallar"
          indicatorColor="#8b5cf6"
          items={trendingSeries}
          moreText="Barcha seriallar"
          onMorePress={() => navigation.navigate("CatalogTab", { type: "series" })}
        />

        {/* 2. Top Multfilms */}
        <MediaSection
          title="🐱‍🏍 Multfilmlar & Animatsiya"
          indicatorColor="#f59e0b"
          items={topMultfilms}
          moreText="Barchasi"
          onMorePress={() => navigation.navigate("CatalogTab", { genre: "multfilm" })}
        />

        {/* 3. Doramas & Asian Drama */}
        <MediaSection
          title="🎭 Koreys Doramalari"
          indicatorColor="#ec4899"
          items={topDoramas}
          moreText="Barchasi"
          onMorePress={() => navigation.navigate("CatalogTab", { genre: "dorama" })}
        />

        {/* Staggered load for heavy below-fold sections */}
        {loadBelowFold && (
          <>
            {/* 4. Latest 2024-2026 Premieres */}
            <MediaSection
              title="⚡ Yangi Premyeralar (2024-2026)"
              indicatorColor="#10b981"
              items={topPremieres}
              moreText="Premyeralar"
              onMorePress={() => navigation.navigate("CatalogTab", { sort: "newest" })}
            />

            {/* 5. Latest Movies */}
            <MediaSection
              title="🎬 Yangi Tarjima Kinolar"
              indicatorColor="#00f2fe"
              items={latestMovies}
              moreText="Kinolar"
              onMorePress={() => navigation.navigate("CatalogTab", { type: "movie" })}
            />

            {/* 6. Top Rated Media */}
            <MediaSection
              title="⭐ Eng Yuqori Baholanganlar"
              indicatorColor="#ffb703"
              items={topRated}
              moreText="Top 100"
              onMorePress={() => navigation.navigate("CatalogTab", { sort: "rating" })}
            />

            {/* 7. Hind Cinema */}
            {hindMovies.length > 0 && (
              <MediaSection
                title="🌟 Hind Kinolari"
                indicatorColor="#f97316"
                items={hindMovies}
                moreText="Barchasi"
                onMorePress={() => navigation.navigate("CatalogTab", { genre: "hind" })}
              />
            )}

            {/* 8. Thrillers & Action */}
            {thrillers.length > 0 && (
              <MediaSection
                title="🔪 Triller & Jangari"
                indicatorColor="#ef4444"
                items={thrillers}
                moreText="Barchasi"
                onMorePress={() => navigation.navigate("CatalogTab", { genre: "triller" })}
              />
            )}

            {/* Presentation & Live Stats Banner */}
            <View style={styles.banner}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>
                  {stats.totalCount}+ KINO VA SERIAL · 5,000+ QISM · AVTO-YANGILANISH
                </Text>
              </View>
              <Text style={styles.bannerTitle}>
                FilmX — Jonli Yangilanuvchi Kinoportal
              </Text>
              <Text style={styles.bannerDesc}>
                Yangi seriallar va kinolar ilovaga avtomatik tarzda qo\x27shiladi.
                Ilovani qayta o\x27rnatmasdan eng so\x27nggi premyeralarni 60fps tezlikda tomosha qiling.
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
    backgroundColor: "#070a12",
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
    backgroundColor: "#0f1422",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  catChipText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicator: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#e50914",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  moreText: {
    color: "#e50914",
    fontSize: 13,
    fontWeight: "700",
  },
  hScroll: {
    paddingHorizontal: 16,
  },
  banner: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#0f1422",
    borderWidth: 1,
    borderColor: "rgba(229, 9, 20, 0.3)",
  },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(229, 9, 20, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  bannerBadgeText: {
    color: "#ff4d6d",
    fontSize: 10,
    fontWeight: "900",
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  bannerDesc: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
  },
});
