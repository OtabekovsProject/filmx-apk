import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MediaItem } from '../types';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 420;

interface HeroSliderProps {
  items: MediaItem[];
}

const HeroSliderComponent: React.FC<HeroSliderProps> = ({ items }) => {
  const navigation = useNavigation<any>();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!items || items.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 6000);
  }, [items]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== activeIndex && index >= 0 && items && index < items.length) {
      setActiveIndex(index);
      startTimer();
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {items.map((item) => {
          const isSeries = item.type === 'series';
          const bgImage = item.backdrop || item.poster;

          return (
            <View key={item.id} style={styles.slide}>
              <Image source={{ uri: bgImage }} style={styles.bgImage} resizeMode="cover" fadeDuration={0} />
              <LinearGradient
                colors={['transparent', 'rgba(7, 10, 18, 0.7)', '#070a12']}
                style={styles.gradient}
              />

              <View style={styles.content}>
                <View style={styles.tagRow}>
                  <View style={[styles.typeBadge, isSeries ? styles.seriesBadge : styles.movieBadge]}>
                    <Text style={styles.typeBadgeText}>
                      {isSeries ? 'PREMYERA SERIAL' : 'PREMYERA KINO'}
                    </Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#ffb703" />
                    <Text style={styles.ratingText}>{(item.rating || 8.5).toFixed(1)}</Text>
                  </View>
                  <Text style={styles.qualityText}>1080p Full HD</Text>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>

                <Text style={styles.genres} numberOfLines={1}>
                  {item.genres?.join(' • ')}{item.country ? ` • ${item.country}` : ''}
                </Text>

                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => navigation.navigate('Player', { id: item.id })}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={styles.playBtnText}>Tomosha qilish</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.infoBtn}
                    onPress={() => navigation.navigate('Detail', { id: item.id })}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#fff" />
                    <Text style={styles.infoBtnText}>Batafsil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dotsRow}>
        {items.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export const HeroSlider = React.memo(HeroSliderComponent);

const styles = StyleSheet.create({
  container: {
    height: HERO_HEIGHT,
    width,
    position: 'relative',
  },
  slide: {
    width,
    height: HERO_HEIGHT,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width,
    height: HERO_HEIGHT,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.85,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  qualityText: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 32,
  },
  genres: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  playBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  infoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  infoBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  activeDot: {
    width: 20,
    backgroundColor: '#e50914',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
