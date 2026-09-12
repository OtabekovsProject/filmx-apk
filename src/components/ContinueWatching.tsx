import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

export const ContinueWatching: React.FC = () => {
  const navigation = useNavigation<any>();
  const { history, removeHistoryItem } = useApp();

  if (!history || history.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="time" size={18} color="#e50914" />
          <Text style={styles.title}>Tomoshani davom ettiring</Text>
        </View>
        <Text style={styles.countText}>{history.length} ta asar</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {history.map((h) => {
          const item = h.item;
          const bg = item.backdrop || item.poster;

          return (
            <View key={h.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardImageWrap}
                onPress={() => navigation.navigate('Player', { id: item.id, episodeId: h.episodeId })}
                activeOpacity={0.8}
              >
                <Image source={{ uri: bg }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.overlay}>
                  <View style={styles.playIconCircle}>
                    <Ionicons name="play" size={16} color="#fff" />
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, h.progressPercent)}%` }]} />
                </View>
              </TouchableOpacity>

              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {h.episodeTitle || `${h.progressPercent}% ko'rildi`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeHistoryItem(h.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  countText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 220,
    backgroundColor: '#0f1422',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardImageWrap: {
    width: '100%',
    height: 120,
    position: 'relative',
    backgroundColor: '#131826',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(229, 9, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  progressBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#00f2fe',
    fontSize: 11,
    marginTop: 2,
  },
});
