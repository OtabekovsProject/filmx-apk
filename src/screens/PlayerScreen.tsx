import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, ScrollView, StatusBar } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getMediaById } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { Series, Episode } from '../types';

const { width, height } = Dimensions.get('window');

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
const SLEEP_TIMERS = [15, 30, 45, 60];

export const PlayerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id, episodeId } = route.params;

  const item = useMemo(() => getMediaById(id), [id]);
  const { recordProgress } = useApp();

  const videoRef = useRef<Video>(null);
  const isSeries = item?.type === 'series';

  // Find initial episode if series
  const seriesItem = isSeries ? (item as Series) : null;
  const initialEp = useMemo(() => {
    if (!seriesItem) return null;
    if (episodeId) {
      for (const s of seriesItem.seasons) {
        const found = s.episodes.find((e) => e.id === episodeId);
        if (found) return found;
      }
    }
    return seriesItem.seasons[0]?.episodes[0] || null;
  }, [seriesItem, episodeId]);

  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(initialEp);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodesModal, setShowEpisodesModal] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine current video URL
  const videoUrl = useMemo(() => {
    if (isSeries && currentEpisode?.videoUrl) {
      return currentEpisode.videoUrl;
    }
    if (item && 'videoUrl' in item && item.videoUrl) {
      return item.videoUrl;
    }
    return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  }, [item, isSeries, currentEpisode]);

  const triggerControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4500);
  };

  useEffect(() => {
    triggerControls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Sleep timer interval
  useEffect(() => {
    if (sleepTimer === null) return;
    const timer = setTimeout(() => {
      videoRef.current?.pauseAsync();
      setSleepTimer(null);
    }, sleepTimer * 60 * 1000);
    return () => clearTimeout(timer);
  }, [sleepTimer]);

  // Next episode countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdown === 0) {
      setCountdown(null);
      handleNextEpisode();
    }
  }, [countdown]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis);
    setDurationMillis(status.durationMillis || 0);

    // Save progress periodically every 5 seconds
    if (item && status.durationMillis && Math.floor(status.positionMillis / 1000) % 5 === 0) {
      recordProgress(
        item,
        status.positionMillis / 1000,
        status.durationMillis / 1000,
        currentEpisode?.id,
        currentEpisode?.title
      );
    }

    if (status.didJustFinish) {
      if (isSeries) {
        setCountdown(5);
      }
    }
  };

  const togglePlayPause = async () => {
    triggerControls();
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
    }
  };

  const skipTime = async (seconds: number) => {
    triggerControls();
    const newPos = Math.max(0, Math.min(durationMillis, positionMillis + seconds * 1000));
    await videoRef.current?.setPositionAsync(newPos);
  };

  const handleSpeedChange = async (spd: number) => {
    setPlaybackSpeed(spd);
    await videoRef.current?.setRateAsync(spd, true);
  };

  const handleNextEpisode = () => {
    if (!seriesItem || !currentEpisode) return;
    for (let sIdx = 0; sIdx < seriesItem.seasons.length; sIdx++) {
      const season = seriesItem.seasons[sIdx];
      const epIdx = season.episodes.findIndex((e) => e.id === currentEpisode.id);
      if (epIdx >= 0 && epIdx < season.episodes.length - 1) {
        setCurrentEpisode(season.episodes[epIdx + 1]);
        return;
      } else if (epIdx >= 0 && sIdx < seriesItem.seasons.length - 1) {
        setCurrentEpisode(seriesItem.seasons[sIdx + 1].episodes[0]);
        return;
      }
    }
  };

  const formatTime = (millis: number) => {
    const totalSec = Math.floor(millis / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!item) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Video Player component */}
      <TouchableOpacity
        style={styles.videoTouch}
        activeOpacity={1}
        onPress={triggerControls}
      >
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={true}
          rate={playbackSpeed}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
      </TouchableOpacity>

      {/* Next Episode Countdown Overlay */}
      {countdown !== null && (
        <View style={styles.nextOverlay}>
          <Text style={styles.nextLabel}>KEYINGI QISM BOSHLANMOQDA:</Text>
          <Text style={styles.nextCount}>{countdown}</Text>
          <View style={styles.nextBtnRow}>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextEpisode}>
              <Text style={styles.nextBtnText}>Hozir o'tish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCountdown(null)}>
              <Text style={styles.cancelBtnText}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* On-Screen Controls HUD */}
      {showControls && (
        <View style={styles.controlsHud} pointerEvents="box-none">
          {/* Top Bar */}
          <View style={styles.topHud}>
            <TouchableOpacity style={styles.hudIconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.topTitles}>
              <Text style={styles.hudTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {currentEpisode && (
                <Text style={styles.hudSubTitle} numberOfLines={1}>
                  {currentEpisode.title}
                </Text>
              )}
            </View>

            <View style={styles.topActions}>
              <View style={styles.fhdBadge}>
                <Text style={styles.fhdText}>1080p FHD</Text>
              </View>
              {isSeries && (
                <TouchableOpacity
                  style={styles.episodesToggle}
                  onPress={() => setShowEpisodesModal(true)}
                >
                  <Ionicons name="list" size={18} color="#fff" />
                  <Text style={styles.episodesToggleText}>Qismlar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Center Playback Controls */}
          <View style={styles.centerHud}>
            <TouchableOpacity style={styles.skipBtn} onPress={() => skipTime(-10)}>
              <Ionicons name="play-back" size={28} color="#fff" />
              <Text style={styles.skipLabel}>-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => skipTime(10)}>
              <Ionicons name="play-forward" size={28} color="#fff" />
              <Text style={styles.skipLabel}>+10s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomHud}>
            {/* Scrubber progress */}
            <View style={styles.scrubberRow}>
              <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFilled,
                    {
                      width: durationMillis > 0 ? `${(positionMillis / durationMillis) * 100}%` : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
            </View>

            {/* Bottom Tools Row */}
            <View style={styles.toolsRow}>
              {/* Speeds */}
              <View style={styles.speedPills}>
                {SPEED_OPTIONS.map((spd) => (
                  <TouchableOpacity
                    key={spd}
                    style={[styles.speedPill, playbackSpeed === spd && styles.activeSpeedPill]}
                    onPress={() => handleSpeedChange(spd)}
                  >
                    <Text
                      style={[
                        styles.speedPillText,
                        playbackSpeed === spd && styles.activeSpeedPillText,
                      ]}
                    >
                      {spd}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sleep timer */}
              <TouchableOpacity
                style={[styles.timerBtn, sleepTimer !== null && styles.activeTimerBtn]}
                onPress={() => {
                  if (sleepTimer === null) setSleepTimer(30);
                  else if (sleepTimer === 30) setSleepTimer(60);
                  else setSleepTimer(null);
                }}
              >
                <Ionicons name="moon-outline" size={14} color="#fff" />
                <Text style={styles.timerBtnText}>
                  {sleepTimer ? `${sleepTimer}m` : 'Taymer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Series Episodes Drawer Modal */}
      {isSeries && seriesItem && (
        <Modal
          visible={showEpisodesModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowEpisodesModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Qismlar ro'yxati</Text>
                <TouchableOpacity onPress={() => setShowEpisodesModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                {seriesItem.seasons.map((season, sIdx) => (
                  <View key={sIdx} style={styles.seasonSection}>
                    <Text style={styles.seasonLabel}>{season.seasonTitle}</Text>
                    {season.episodes.map((ep) => {
                      const isActive = ep.id === currentEpisode?.id;
                      return (
                        <TouchableOpacity
                          key={ep.id}
                          style={[styles.modalEpCard, isActive && styles.activeModalEpCard]}
                          onPress={() => {
                            setCurrentEpisode(ep);
                            setShowEpisodesModal(false);
                          }}
                        >
                          <Ionicons
                            name={isActive ? "play" : "videocam-outline"}
                            size={16}
                            color={isActive ? "#fff" : "#94a3b8"}
                          />
                          <Text
                            style={[styles.modalEpText, isActive && styles.activeModalEpText]}
                            numberOfLines={1}
                          >
                            {ep.title}
                          </Text>
                          <Text style={styles.modalEpDuration}>{ep.duration || '45 daq'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  controlsHud: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    padding: 16,
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  hudIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 10, 18, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitles: {
    flex: 1,
    marginHorizontal: 12,
  },
  hudTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  hudSubTitle: {
    color: '#00f2fe',
    fontSize: 12,
    marginTop: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fhdBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  fhdText: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '800',
  },
  episodesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e50914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  episodesToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centerHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  skipBtn: {
    alignItems: 'center',
  },
  skipLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  bottomHud: {
    paddingBottom: 10,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  timeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 38,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  progressFilled: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(7, 10, 18, 0.8)',
    borderRadius: 8,
    padding: 2,
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeSpeedPill: {
    backgroundColor: '#e50914',
  },
  speedPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  activeSpeedPillText: {
    color: '#fff',
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7, 10, 18, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeTimerBtn: {
    backgroundColor: '#ffb703',
  },
  timerBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  nextOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 18, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    padding: 20,
  },
  nextLabel: {
    color: '#e50914',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  nextCount: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 20,
  },
  nextBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nextBtn: {
    backgroundColor: '#e50914',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '65%',
    backgroundColor: '#070a12',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalScroll: {
    maxHeight: 380,
  },
  seasonSection: {
    marginBottom: 16,
  },
  seasonLabel: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalEpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#0f1422',
    borderRadius: 10,
    marginBottom: 6,
  },
  activeModalEpCard: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderWidth: 1,
    borderColor: '#e50914',
  },
  modalEpText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 10,
  },
  activeModalEpText: {
    color: '#fff',
    fontWeight: '800',
  },
  modalEpDuration: {
    color: '#64748b',
    fontSize: 11,
  },
});
