import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getMediaById, getMovies, getSeries } from '../services/dataService';
import { EpisodeSelector } from '../components/EpisodeSelector';
import { MediaCard } from '../components/MediaCard';
import { DownloadModal } from '../components/DownloadModal';
import { useApp } from '../context/AppContext';
import { Series } from '../types';

const { width } = Dimensions.get('window');

export const DetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;

  const item = useMemo(() => getMediaById(id), [id]);
  const { isFavorite, toggleFavorite, getDownload } = useApp();
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const isSeries = item?.type === 'series';
  const favorite = item ? isFavorite(item.id) : false;
  const itemDownload = item ? getDownload(item.id) : undefined;

  const related = useMemo(() => {
    if (!item) return [];
    const pool = isSeries ? getSeries() : getMovies();
    const itemGenres = new Set((item.genres || []).map(g => g.toLowerCase()));
    
    // Smart fast matching: single-pass with early bounds
    const matches: Array<{ item: (typeof pool)[0]; score: number }> = [];
    for (let i = 0; i < pool.length; i++) {
      const m = pool[i];
      if (m.id === item.id) continue;
      const mGenres = m.genres || [];
      let overlap = 0;
      for (let j = 0; j < mGenres.length; j++) {
        if (itemGenres.has(mGenres[j].toLowerCase())) overlap++;
      }
      if (overlap > 0 || matches.length < 24) {
        matches.push({ item: m, score: overlap * 10 + (m.rating || 0) });
      }
    }
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(x => x.item);
  }, [item, isSeries]);

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>
          Asar topilmadi!
        </Text>
      </SafeAreaView>
    );
  }

  const bgImage = item.backdrop || item.poster;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Backdrop Banner */}
        <View style={styles.backdropWrap}>
          <Image source={{ uri: bgImage }} style={styles.backdrop} resizeMode="cover" fadeDuration={0} />
          <LinearGradient
            colors={['rgba(7, 10, 18, 0.4)', 'rgba(7, 10, 18, 0.85)', '#070a12']}
            style={styles.gradient}
          />

          {/* Top Bar Navigation */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.roundBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.roundBtn} onPress={() => toggleFavorite(item)}>
              <Ionicons
                name={favorite ? "heart" : "heart-outline"}
                size={22}
                color={favorite ? "#e50914" : "#fff"}
              />
            </TouchableOpacity>
          </View>

          {/* Center Play Button Overlay */}
          <TouchableOpacity
            style={styles.centerPlay}
            onPress={() => navigation.navigate('Player', { id: item.id })}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          <View style={styles.metaBadges}>
            <View style={[styles.typeBadge, isSeries ? styles.seriesBadge : styles.movieBadge]}>
              <Text style={styles.typeBadgeText}>{isSeries ? 'SERIAL' : 'KINO'}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#ffb703" />
              <Text style={styles.ratingText}>{(item.rating || 8.0).toFixed(1)}</Text>
            </View>
            <Text style={styles.metaYear}>{item.year}-yil</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaQuality}>1080p FHD</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          {item.rawTitle && item.rawTitle !== item.title && (
            <Text style={styles.rawTitle}>{item.rawTitle}</Text>
          )}

          {/* Genres Chips */}
          <View style={styles.genresRow}>
            {item.genres?.map((g, idx) => (
              <View key={idx} style={styles.genreChip}>
                <Text style={styles.genreChipText}>{g}</Text>
              </View>
            ))}
            {item.country && (
              <View style={[styles.genreChip, styles.countryChip]}>
                <Text style={styles.genreChipText}>{item.country}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons Row: Play and Download */}
          <View style={styles.actionBtnRow}>
            <TouchableOpacity
              style={styles.mainPlayBtn}
              onPress={() => navigation.navigate('Player', { id: item.id })}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.mainPlayBtnText}>
                {isSeries ? 'Serialni ko\'rish' : 'Filmni ko\'rish'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadBtn, itemDownload && styles.activeDownloadBtn]}
              onPress={() => setShowDownloadModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={itemDownload ? (itemDownload.target === 'server' ? 'cloud-done' : 'checkmark-circle') : 'download-outline'}
                size={20}
                color={itemDownload ? '#00f2fe' : '#ffffff'}
              />
              <Text style={[styles.downloadBtnText, itemDownload && styles.activeDownloadBtnText]}>
                {itemDownload
                  ? itemDownload.target === 'server'
                    ? 'Serverda'
                    : 'Yuklangan'
                  : 'Yuklab olish'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionHeading}>Mazmuni:</Text>
            <Text style={styles.descText}>{item.description}</Text>
          </View>

          {/* Cast */}
          {item.actors && item.actors.length > 0 && (
            <View style={styles.infoSection}>
              <Text style={styles.sectionHeading}>Bosh rollarda:</Text>
              <Text style={styles.actorsText}>{item.actors.join(', ')}</Text>
            </View>
          )}

          {/* Series Episodes Navigator */}
          {isSeries && (
            <EpisodeSelector
              seasons={(item as Series).seasons}
              activeSeasonIndex={0}
              activeEpisodeId={(item as Series).seasons?.[0]?.episodes?.[0]?.id || ''}
              onSelectEpisode={(sIdx, ep) => {
                navigation.navigate('Player', { id: item.id, episodeId: ep.id });
              }}
            />
          )}

          {/* Related Recommendations */}
          {related.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.sectionHeading}>O'xshash Asarlar:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
                {related.map((rel) => (
                  <MediaCard key={rel.id} item={rel} variant="carousel" />
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Download Modal */}
      <DownloadModal
        visible={showDownloadModal}
        item={item}
        onClose={() => setShowDownloadModal(false)}
        onPlayOffline={(localUri) => {
          navigation.navigate('Player', { id: item.id, offlineUri: localUri });
        }}
      />
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
  backdropWrap: {
    width,
    height: 320,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width,
    height: 320,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 10, 18, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerPlay: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  body: {
    paddingHorizontal: 16,
    marginTop: -20,
  },
  metaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seriesBadge: {
    backgroundColor: '#8b5cf6',
  },
  movieBadge: {
    backgroundColor: '#e50914',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  metaYear: {
    color: '#94a3b8',
    fontSize: 12,
  },
  metaDot: {
    color: '#64748b',
    fontSize: 10,
  },
  metaQuality: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    lineHeight: 30,
  },
  rawTitle: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 10,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  genreChip: {
    backgroundColor: '#0f1422',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  countryChip: {
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  genreChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 20,
  },
  mainPlayBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  mainPlayBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#131826',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  activeDownloadBtn: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  activeDownloadBtnText: {
    color: '#00f2fe',
  },
  infoSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  descText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  actorsText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  relatedSection: {
    marginTop: 20,
  },
  relatedScroll: {
    paddingTop: 10,
  },
});
