import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Season, Episode } from '../types';

interface EpisodeSelectorProps {
  seasons: Season[];
  activeSeasonIndex: number;
  activeEpisodeId: string;
  onSelectEpisode: (seasonIndex: number, episode: Episode) => void;
}

export const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({
  seasons,
  activeSeasonIndex,
  activeEpisodeId,
  onSelectEpisode,
}) => {
  const [selectedSeason, setSelectedSeason] = useState(activeSeasonIndex);

  if (!seasons || seasons.length === 0) return null;

  const currentSeason = seasons[selectedSeason] || seasons[0];

  return (
    <View style={styles.container}>
      {/* Seasons Tab */}
      {seasons.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonsScroll}>
          {seasons.map((s, idx) => {
            const active = idx === selectedSeason;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.seasonTab, active && styles.activeSeasonTab]}
                onPress={() => setSelectedSeason(idx)}
              >
                <Text style={[styles.seasonTabText, active && styles.activeSeasonTabText]}>
                  {s.seasonTitle || `${s.seasonNumber}-Mavsum`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Episodes List */}
      <View style={styles.episodesHeader}>
        <Text style={styles.episodesHeaderTitle}>
          {currentSeason.seasonTitle || 'Qismlar'} ({currentSeason.episodes.length} ta qism)
        </Text>
      </View>

      <View style={styles.episodesGrid}>
        {currentSeason.episodes.map((ep) => {
          const isActive = ep.id === activeEpisodeId;
          return (
            <TouchableOpacity
              key={ep.id}
              style={[styles.epCard, isActive && styles.activeEpCard]}
              onPress={() => onSelectEpisode(selectedSeason, ep)}
              activeOpacity={0.8}
            >
              <View style={styles.epNumWrap}>
                <Ionicons
                  name={isActive ? "play" : "videocam-outline"}
                  size={16}
                  color={isActive ? "#fff" : "#94a3b8"}
                />
                <Text style={[styles.epNumText, isActive && styles.activeEpText]}>
                  {ep.episodeNumber}-qism
                </Text>
              </View>

              <Text style={[styles.epTitle, isActive && styles.activeEpText]} numberOfLines={1}>
                {ep.title}
              </Text>

              <View style={styles.epMeta}>
                <Text style={styles.epDuration}>{ep.duration || '45 daq'}</Text>
                <Text style={styles.epQuality}>{ep.quality || '1080p'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 20,
  },
  seasonsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  seasonTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeSeasonTab: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  seasonTabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  activeSeasonTabText: {
    color: '#fff',
  },
  episodesHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  episodesHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  episodesGrid: {
    paddingHorizontal: 16,
    gap: 8,
  },
  epCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#0f1422',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  activeEpCard: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderColor: '#e50914',
  },
  epNumWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 90,
  },
  epNumText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  epTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  activeEpText: {
    color: '#fff',
    fontWeight: '800',
  },
  epMeta: {
    alignItems: 'flex-end',
  },
  epDuration: {
    color: '#64748b',
    fontSize: 11,
  },
  epQuality: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '700',
  },
});
