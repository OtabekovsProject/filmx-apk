import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MediaCard } from '../components/MediaCard';
import { useApp } from '../context/AppContext';
import { DownloadItem, DownloadTarget } from '../types';
import { openInGalleryOrShare } from '../services/downloadService';

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { favorites, downloads, removeDownload } = useApp();

  const [activeTab, setActiveTab] = useState<'favorites' | 'downloads'>('favorites');
  const [downloadFilter, setDownloadFilter] = useState<'all' | DownloadTarget>('all');

  const filteredDownloads = useMemo(() => {
    if (downloadFilter === 'all') return downloads;
    return downloads.filter((d) => d.target === downloadFilter);
  }, [downloads, downloadFilter]);

  const galleryCount = downloads.filter((d) => d.target === 'gallery').length;
  const serverCount = downloads.filter((d) => d.target === 'server').length;

  const handlePlayDownload = (item: DownloadItem) => {
    navigation.navigate('Player', {
      id: item.mediaId,
      episodeId: item.episodeId,
      offlineUri: item.localUri,
    });
  };

  const handleShareOrGallery = async (item: DownloadItem) => {
    if (item.localUri) {
      await openInGalleryOrShare(item.localUri, item.item.title);
    }
  };

  const renderDownloadCard = ({ item }: { item: DownloadItem }) => {
    const isGallery = item.target === 'gallery';
    const isDownloading = item.status === 'downloading';

    return (
      <View style={styles.downloadCard}>
        <Image source={{ uri: item.item.poster }} style={styles.downloadPoster} resizeMode="cover" />

        <View style={styles.downloadBody}>
          <View style={styles.badgeRow}>
            <View style={[styles.targetBadge, isGallery ? styles.galleryBadge : styles.serverBadge]}>
              <Ionicons
                name={isGallery ? 'phone-portrait' : 'cloud-done'}
                size={11}
                color={isGallery ? '#ff4d6d' : '#00f2fe'}
              />
              <Text style={[styles.targetBadgeText, isGallery ? styles.galleryText : styles.serverText]}>
                {isGallery ? 'Qurilmada (Oflayn)' : 'Serverda (0 MB)'}
              </Text>
            </View>
            <Text style={styles.metaYear}>{item.item.year}</Text>
          </View>

          <Text style={styles.downloadTitle} numberOfLines={1}>
            {item.item.title}
          </Text>

          {item.episodeTitle && (
            <Text style={styles.episodeText} numberOfLines={1}>
              {item.episodeTitle}
            </Text>
          )}

          {isDownloading ? (
            <View style={styles.cardProgressWrap}>
              <View style={styles.cardProgressBarBg}>
                <View style={[styles.cardProgressBarFill, { width: `${Math.round(item.progress * 100)}%` }]} />
              </View>
              <Text style={styles.cardProgressText}>Yuklanmoqda: {Math.round(item.progress * 100)}%</Text>
            </View>
          ) : (
            <Text style={styles.storageNote}>
              {isGallery ? 'Internetsiz tomosha qilish mumkin' : '0 MB telefon xotirasi band'}
            </Text>
          )}

          {/* Action buttons */}
          <View style={styles.downloadActionRow}>
            <TouchableOpacity
              style={styles.playCardBtn}
              onPress={() => handlePlayDownload(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={14} color="#fff" />
              <Text style={styles.playCardBtnText}>Tomosha qilish</Text>
            </TouchableOpacity>

            {isGallery && item.localUri && (
              <TouchableOpacity
                style={styles.galleryShareBtn}
                onPress={() => handleShareOrGallery(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={16} color="#cbd5e1" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteCardBtn}
              onPress={() => removeDownload(item.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Segmented Top Header */}
      <View style={styles.header}>
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'favorites' && styles.activeSegmentBtn]}
            onPress={() => setActiveTab('favorites')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'favorites' ? 'heart' : 'heart-outline'}
              size={18}
              color={activeTab === 'favorites' ? '#e50914' : '#94a3b8'}
            />
            <Text style={[styles.segmentText, activeTab === 'favorites' && styles.activeSegmentText]}>
              Sevimlilar
            </Text>
            {favorites.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'favorites' && styles.activeTabBadge]}>
                <Text style={styles.tabBadgeText}>{favorites.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'downloads' && styles.activeSegmentBtn]}
            onPress={() => setActiveTab('downloads')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'downloads' ? 'download' : 'download-outline'}
              size={18}
              color={activeTab === 'downloads' ? '#00f2fe' : '#94a3b8'}
            />
            <Text style={[styles.segmentText, activeTab === 'downloads' && styles.activeSegmentText]}>
              Yuklanganlar
            </Text>
            {downloads.length > 0 && (
              <View style={[styles.tabBadge, styles.downloadTabBadge]}>
                <Text style={styles.tabBadgeText}>{downloads.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'favorites' ? (
        /* Favorites Tab Content */
        favorites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="heart-outline" size={48} color="#64748b" />
            </View>
            <Text style={styles.emptyTitle}>Sevimli filmlar yo'q</Text>
            <Text style={styles.emptyDesc}>
              O'zingizga yoqqan kinolar va seriallarni keyinroq ko'rish uchun yurakchani bosing.
            </Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => navigation.navigate('CatalogTab')}
              activeOpacity={0.85}
            >
              <Ionicons name="film-outline" size={18} color="#fff" />
              <Text style={styles.exploreBtnText}>Katalogni ko'rish</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={favorites}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <MediaCard item={item} variant="grid" isFav={true} />}
          />
        )
      ) : (
        /* Downloads Tab Content */
        <View style={{ flex: 1 }}>
          {/* Download Category Chips */}
          <View style={styles.filterChipRow}>
            <TouchableOpacity
              style={[styles.filterChip, downloadFilter === 'all' && styles.activeFilterChip]}
              onPress={() => setDownloadFilter('all')}
            >
              <Text style={[styles.filterChipText, downloadFilter === 'all' && styles.activeFilterChipText]}>
                Barchasi ({downloads.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, downloadFilter === 'gallery' && styles.activeFilterChip]}
              onPress={() => setDownloadFilter('gallery')}
            >
              <Ionicons name="phone-portrait" size={12} color={downloadFilter === 'gallery' ? '#fff' : '#ff4d6d'} />
              <Text style={[styles.filterChipText, downloadFilter === 'gallery' && styles.activeFilterChipText]}>
                💾 Qurilmada ({galleryCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, downloadFilter === 'server' && styles.activeFilterChip]}
              onPress={() => setDownloadFilter('server')}
            >
              <Ionicons name="cloud-done" size={12} color={downloadFilter === 'server' ? '#fff' : '#00f2fe'} />
              <Text style={[styles.filterChipText, downloadFilter === 'server' && styles.activeFilterChipText]}>
                ☁️ Serverda ({serverCount})
              </Text>
            </TouchableOpacity>
          </View>

          {filteredDownloads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { borderColor: 'rgba(0, 242, 254, 0.2)' }]}>
                <Ionicons name="cloud-download-outline" size={48} color="#00f2fe" />
              </View>
              <Text style={styles.emptyTitle}>Yuklangan kinolar yo'q</Text>
              <Text style={styles.emptyDesc}>
                Istalgan kinoni ochib, "Yuklab olish" tugmasi orqali qurilma xotirasiga (oflayn) yoki serverga (0 MB) saqlashingiz mumkin.
              </Text>
              <TouchableOpacity
                style={[styles.exploreBtn, { backgroundColor: '#0f1422', borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.4)' }]}
                onPress={() => navigation.navigate('CatalogTab')}
                activeOpacity={0.85}
              >
                <Ionicons name="film-outline" size={18} color="#00f2fe" />
                <Text style={[styles.exploreBtnText, { color: '#00f2fe' }]}>Kinolar tanlash</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredDownloads}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.downloadListContent}
              renderItem={renderDownloadCard}
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f1422',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  activeSegmentBtn: {
    backgroundColor: '#1a2235',
  },
  segmentText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  activeSegmentText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeTabBadge: {
    backgroundColor: '#e50914',
  },
  downloadTabBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.25)',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginVertical: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f1422',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeFilterChip: {
    backgroundColor: '#1a2235',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  activeFilterChipText: {
    color: '#ffffff',
  },
  downloadListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  downloadCard: {
    flexDirection: 'row',
    backgroundColor: '#0f1422',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  downloadPoster: {
    width: 78,
    height: 112,
    borderRadius: 8,
    backgroundColor: '#131826',
  },
  downloadBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  galleryBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
  },
  serverBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
  },
  targetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  galleryText: {
    color: '#ff4d6d',
  },
  serverText: {
    color: '#00f2fe',
  },
  metaYear: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  downloadTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  episodeText: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardProgressWrap: {
    marginVertical: 4,
  },
  cardProgressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cardProgressBarFill: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 2,
  },
  cardProgressText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  storageNote: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 6,
  },
  downloadActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#e50914',
    paddingVertical: 6,
    borderRadius: 8,
  },
  playCardBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  galleryShareBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  deleteCardBtn: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0f1422',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
