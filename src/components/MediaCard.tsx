import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MediaItem } from '../types';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

interface MediaCardProps {
  item: MediaItem;
  variant?: 'grid' | 'carousel' | 'list';
  isFav?: boolean;
}

const MediaCardComponent: React.FC<MediaCardProps> = ({ item, variant = 'grid', isFav }) => {
  const navigation = useNavigation<any>();
  const { isFavorite, toggleFavorite } = useApp();
  const favorite = isFav !== undefined ? isFav : isFavorite(item.id);

  const handlePress = React.useCallback(() => {
    navigation.navigate('Detail', { id: item.id });
  }, [navigation, item.id]);

  const isSeries = item.type === 'series';

  if (variant === 'list') {
    return (
      <TouchableOpacity
        style={styles.listContainer}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.poster }}
          style={styles.listPoster}
          resizeMode="cover"
          fadeDuration={0}
        />
        <View style={styles.listContent}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, isSeries ? styles.seriesBadge : styles.movieBadge]}>
              <Text style={styles.typeBadgeText}>{isSeries ? 'SERIAL' : 'KINO'}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#ffb703" />
              <Text style={styles.ratingText}>{(item.rating || 8.0).toFixed(1)}</Text>
            </View>
            <Text style={styles.yearText}>{item.year}</Text>
          </View>

          <Text style={styles.listTitle} numberOfLines={1}>
            {item.title}
          </Text>

          <Text style={styles.listGenres} numberOfLines={1}>
            {item.genres?.join(' • ') || 'Kino'}
          </Text>

          <Text style={styles.listDesc} numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.listFavBtn}
          onPress={() => toggleFavorite(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={20}
            color={favorite ? '#e50914' : 'rgba(255,255,255,0.4)'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  const containerStyle = variant === 'carousel' ? styles.carouselContainer : styles.gridContainer;
  const posterStyle = variant === 'carousel' ? styles.carouselPoster : styles.gridPoster;

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      activeOpacity={0.82}
    >
      <View style={styles.posterWrapper}>
        <Image
          source={{ uri: item.poster }}
          style={posterStyle}
          resizeMode="cover"
          fadeDuration={0}
        />
        <View style={styles.posterOverlay}>
          <View style={styles.topBadges}>
            <View style={[styles.typeBadge, isSeries ? styles.seriesBadge : styles.movieBadge]}>
              <Text style={styles.typeBadgeText}>{isSeries ? 'SERIAL' : 'KINO'}</Text>
            </View>
            <TouchableOpacity
              style={styles.favBadge}
              onPress={() => toggleFavorite(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={16}
                color={favorite ? '#e50914' : '#ffffff'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomBadges}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11} color="#ffb703" />
              <Text style={styles.ratingText}>{(item.rating || 8.0).toFixed(1)}</Text>
            </View>
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityText}>1080p</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.gridTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{item.year}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {item.genres?.[0] || 'Kino'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const MediaCard = React.memo(MediaCardComponent, (prev, next) => {
  return prev.item.id === next.item.id && prev.variant === next.variant && prev.isFav === next.isFav;
});

const cardWidth = (width - 44) / 2;

const styles = StyleSheet.create({
  gridContainer: {
    width: cardWidth,
    marginBottom: 16,
  },
  carouselContainer: {
    width: 140,
    marginRight: 12,
  },
  posterWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gridPoster: {
    width: '100%',
    height: cardWidth * 1.48,
  },
  carouselPoster: {
    width: 140,
    height: 205,
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  topBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 6,
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
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  favBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(7, 10, 18, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(7, 10, 18, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 3, 0.3)',
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  qualityBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  qualityText: {
    color: '#00f2fe',
    fontSize: 9,
    fontWeight: '800',
  },
  gridTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  metaDot: {
    color: '#64748b',
    fontSize: 10,
  },
  listContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f1422',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 12,
  },
  listPoster: {
    width: 80,
    height: 115,
    borderRadius: 8,
  },
  listContent: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  yearText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  listTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  listGenres: {
    color: '#00f2fe',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  listDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  listFavBtn: {
    alignSelf: 'center',
    padding: 6,
  },
});
