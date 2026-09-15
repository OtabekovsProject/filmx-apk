import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { MediaCard } from "../components/MediaCard";
import { FilterBar } from "../components/FilterBar";
import { filterMedia, getDataStats } from "../services/dataService";
import { searchAndRank } from "../services/searchUtils";
import { MediaItem } from "../types";
import { useApp } from "../context/AppContext";

const { width } = Dimensions.get("window");

const TYPE_FILTERS = [
  { label: "Barchasi", value: "all" },
  { label: "🎬 Kinolar", value: "movie" },
  { label: "📺 Seriallar", value: "series" },
];

const GENRE_FILTERS = [
  { label: "Barcha Janrlar", value: "all" },
  { label: "💥 Jangari", value: "jangari" },
  { label: "🚀 Fantastika", value: "fantastika" },
  { label: "🎭 Dorama", value: "dorama" },
  { label: "🐱‍🏍 Multfilm & Anime", value: "multfilm" },
  { label: "🎭 Drama", value: "drama" },
  { label: "⚡ Triller", value: "triller" },
  { label: "🗺️ Sarguzasht", value: "sarguzasht" },
  { label: "😂 Komediya", value: "komediya" },
  { label: "👻 Qo'rqinchli", value: "qorqinchli" },
  { label: "🥋 Melodrama", value: "melodrama" },
  { label: "⚔️ Tarixiy", value: "tarixiy" },
];

const COUNTRY_FILTERS = [
  { label: "Barcha Davlatlar", value: "all" },
  { label: "🇺🇸 AQSH", value: "aqsh" },
  { label: "🇺🇿 O\x27zbekiston", value: "ozbekiston" },
  { label: "🇰🇷 Koreya", value: "koreya" },
  { label: "🇮🇳 Hindiston", value: "hind" },
  { label: "🇹🇷 Turkiya", value: "turkiya" },
  { label: "🇷🇺 Rossiya", value: "rossiya" },
  { label: "🇨🇳 Xitoy", value: "xitoy" },
];

const SORT_OPTIONS = [
  { label: "Yangi yillar", value: "newest" },
  { label: "Reyting", value: "rating" },
  { label: "Ko\x27p qismli", value: "episodes" },
  { label: "A-Z", value: "alpha" },
];

export const CatalogScreen: React.FC = () => {
  const route = useRoute<any>();
  const { dataVersion, syncData } = useApp();

  const initialType = route.params?.type || "all";
  const initialGenre = route.params?.genre || "all";
  const initialSort = route.params?.sort || "newest";

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState(initialType);
  const [genre, setGenre] = useState(initialGenre);
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState(initialSort);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(24);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search: 300ms delay to avoid filtering 1500+ items on every keystroke
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setVisibleCount(24); // Reset pagination on new search
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const stats = useMemo(() => getDataStats(), [dataVersion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncData(true);
    } finally {
      setRefreshing(false);
    }
  }, [syncData]);

  const filteredItems = useMemo(() => {
    const hasQuery = debouncedQuery.trim().length > 0;
    if (hasQuery) {
      // Smart search with relevance scoring
      const pool = filterMedia({
        type: type as any,
        genre,
        country,
      });
      return searchAndRank(pool, debouncedQuery, 200);
    }
    return filterMedia({
      type: type as any,
      genre,
      country,
      sortBy: sort as any,
    });
  }, [debouncedQuery, type, genre, country, sort, dataVersion]);

  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  // Infinite scroll: auto-load more when user reaches bottom
  const handleEndReached = useCallback(() => {
    if (visibleCount < filteredItems.length) {
      setVisibleCount((prev) => Math.min(prev + 24, filteredItems.length));
    }
  }, [visibleCount, filteredItems.length]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <MediaCard item={item} variant={viewMode === "grid" ? "grid" : "list"} />
    ),
    [viewMode]
  );

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  const renderFooter = useCallback(() => {
    if (visibleCount >= filteredItems.length) return <View style={{ height: 40 }} />;
    return (
      <View style={styles.footerWrap}>
        <ActivityIndicator size="small" color="#e50914" style={{ marginVertical: 16 }} />
        <Text style={styles.loadMoreText}>
          {visibleCount} / {filteredItems.length} ko'rsatilmoqda
        </Text>
        <View style={{ height: 40 }} />
      </View>
    );
  }, [visibleCount, filteredItems.length]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Stable Header Area: Prevents keyboard lag & focus drop */}
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>FilmX Katalogi</Text>
        <Text style={styles.pageSubtitle}>
          {stats.totalCount}+ kinolar, seriallar va multfilmlar • Avto-yangilanuvchi baza
        </Text>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Nomi, janri yoki aktyori bo'yicha..."
            placeholderTextColor="#64748b"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Type Filters */}
        <FilterBar items={TYPE_FILTERS} selectedValue={type} onSelect={setType} />

        {/* Genre Filters */}
        <FilterBar items={GENRE_FILTERS} selectedValue={genre} onSelect={setGenre} />

        {/* Country Filters */}
        <FilterBar items={COUNTRY_FILTERS} selectedValue={country} onSelect={setCountry} />

        {/* Controls: Count, Sort, View mode */}
        <View style={styles.controlsRow}>
          <Text style={styles.countBadge}>
            Natija: <Text style={{ color: "#fff", fontWeight: "800" }}>{filteredItems.length}</Text> ta
          </Text>

          <View style={styles.rightControls}>
            {/* Sort pills */}
            <View style={styles.sortGroup}>
              {SORT_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.sortBtn, sort === s.value && styles.activeSortBtn]}
                  onPress={() => setSort(s.value)}
                >
                  <Text
                    style={[styles.sortBtnText, sort === s.value && styles.activeSortBtnText]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Grid/List toggle */}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            >
              <Ionicons
                name={viewMode === "grid" ? "list" : "grid"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Media FlatList */}
      <FlatList
        key={viewMode}
        data={displayedItems}
        keyExtractor={keyExtractor}
        numColumns={viewMode === "grid" ? 2 : 1}
        columnWrapperStyle={viewMode === "grid" ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={renderFooter}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e50914"
            colors={["#e50914", "#00f2fe"]}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070a12",
  },
  listContent: {
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1422",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  countBadge: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  rightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortGroup: {
    flexDirection: "row",
    backgroundColor: "#0f1422",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeSortBtn: {
    backgroundColor: "#e50914",
  },
  sortBtnText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  activeSortBtnText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0f1422",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  footerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  loadMoreBtn: {
    backgroundColor: "rgba(229, 9, 20, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(229, 9, 20, 0.4)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  loadMoreText: {
    color: "#ff4d6d",
    fontSize: 14,
    fontWeight: "800",
  },
});
