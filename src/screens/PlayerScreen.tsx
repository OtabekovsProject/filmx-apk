import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getMediaById } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { Series, Episode } from '../types';

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SLEEP_TIMERS = [15, 30, 45, 60];

export const PlayerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id, episodeId } = route.params;
  const { width, height } = useWindowDimensions();

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
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Fullscreen, Orientation & Aspect Ratio states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const [resizeToast, setResizeToast] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showLockPrompt, setShowLockPrompt] = useState(false);

  // Double tap feedback state
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const doubleTapAnim = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lockPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Clean up orientation when leaving Player
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (lockPromptTimeoutRef.current) clearTimeout(lockPromptTimeoutRef.current);
    };
  }, []);

  const triggerControls = useCallback(() => {
    if (isLocked) {
      setShowLockPrompt(true);
      if (lockPromptTimeoutRef.current) clearTimeout(lockPromptTimeoutRef.current);
      lockPromptTimeoutRef.current = setTimeout(() => {
        setShowLockPrompt(false);
      }, 3000);
      return;
    }

    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4500);
  }, [isLocked]);

  useEffect(() => {
    triggerControls();
  }, [triggerControls]);

  // Sleep timer handler
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

  // Toggle true fullscreen & landscape mode
  const toggleFullscreen = async () => {
    triggerControls();
    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      }
    } catch (e) {
      try {
        await videoRef.current?.presentFullscreenPlayer();
      } catch (err) {}
    }
  };

  // Cycle aspect ratio / resize mode
  const cycleResizeMode = () => {
    triggerControls();
    if (resizeMode === ResizeMode.CONTAIN) {
      setResizeMode(ResizeMode.COVER);
      showToastMessage("To'liq ekran (Qora hoshiyasiz)");
    } else if (resizeMode === ResizeMode.COVER) {
      setResizeMode(ResizeMode.STRETCH);
      showToastMessage("Cho'zilgan (100% ekran)");
    } else {
      setResizeMode(ResizeMode.CONTAIN);
      showToastMessage("Asl o'lcham (16:9)");
    }
  };

  const showToastMessage = (msg: string) => {
    setResizeToast(msg);
    setTimeout(() => {
      setResizeToast(null);
    }, 2000);
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis);
    setDurationMillis(status.durationMillis || 0);

    // Periodically record watch progress every 5 seconds
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
    setShowSpeedModal(false);
    await videoRef.current?.setRateAsync(spd, true);
    showToastMessage(`Tezlik: ${spd}x`);
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

  // Handle double-tap skip vs single-tap toggle
  const handleTouchScreen = (evt: any) => {
    const now = Date.now();
    const touchX = evt.nativeEvent.locationX;
    const timeDelta = now - lastTapRef.current.time;

    if (timeDelta < 320 && Math.abs(touchX - lastTapRef.current.x) < 120) {
      if (touchX < width / 2) {
        skipTime(-10);
        triggerDoubleTapAnim('left');
      } else {
        skipTime(10);
        triggerDoubleTapAnim('right');
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touchX };
      triggerControls();
    }
  };

  const triggerDoubleTapAnim = (side: 'left' | 'right') => {
    setDoubleTapSide(side);
    doubleTapAnim.setValue(0);
    Animated.sequence([
      Animated.timing(doubleTapAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(doubleTapAnim, {
        toValue: 0,
        duration: 350,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setDoubleTapSide(null));
  };

  const handleSeek = async (evt: any) => {
    const trackWidth = Math.max(100, width - 130);
    const clickX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, clickX / trackWidth));
    const targetMillis = ratio * durationMillis;
    await videoRef.current?.setPositionAsync(targetMillis);
    triggerControls();
  };

  const handleGoBack = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    navigation.goBack();
  };

  const formatTime = (millis: number) => {
    const totalSec = Math.floor(millis / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = durationMillis > 0 ? (positionMillis / durationMillis) * 100 : 0;

  if (!item) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Main Video Surface */}
      <TouchableOpacity
        style={styles.videoTouch}
        activeOpacity={1}
        onPress={handleTouchScreen}
      >
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={resizeMode}
          shouldPlay={true}
          rate={playbackSpeed}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
      </TouchableOpacity>

      {/* Double Tap Skip Animation Indicators */}
      {doubleTapSide === 'left' && (
        <Animated.View
          style={[
            styles.doubleTapOverlay,
            styles.doubleTapLeft,
            { opacity: doubleTapAnim },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="play-back" size={36} color="#fff" />
          <Text style={styles.doubleTapText}>-10 soniya</Text>
        </Animated.View>
      )}
      {doubleTapSide === 'right' && (
        <Animated.View
          style={[
            styles.doubleTapOverlay,
            styles.doubleTapRight,
            { opacity: doubleTapAnim },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="play-forward" size={36} color="#fff" />
          <Text style={styles.doubleTapText}>+10 soniya</Text>
        </Animated.View>
      )}

      {/* Resize Mode Toast Notification */}
      {resizeToast && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastCard}>
            <Ionicons name="scan" size={16} color="#00f2fe" />
            <Text style={styles.toastText}>{resizeToast}</Text>
          </View>
        </View>
      )}

      {/* Locked Screen Overlay (When screen lock is enabled) */}
      {isLocked && showLockPrompt && (
        <View style={styles.lockPromptOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={() => {
              setIsLocked(false);
              setShowLockPrompt(false);
              triggerControls();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={24} color="#e50914" />
            <Text style={styles.unlockBtnText}>Ekranni ochish</Text>
          </TouchableOpacity>
        </View>
      )}

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
      {!isLocked && showControls && (
        <View style={styles.controlsHud} pointerEvents="box-none">
          {/* Top Bar */}
          <View style={styles.topHud}>
            <TouchableOpacity
              style={styles.hudIconBtn}
              onPress={handleGoBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
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
              <TouchableOpacity
                style={styles.pillActionBtn}
                onPress={cycleResizeMode}
                activeOpacity={0.7}
              >
                <Ionicons name="resize-outline" size={14} color="#00f2fe" />
                <Text style={styles.pillActionText}>
                  {resizeMode === ResizeMode.CONTAIN
                    ? '16:9'
                    : resizeMode === ResizeMode.COVER
                    ? "To'liq"
                    : "Cho'zilgan"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hudIconBtnSmall}
                onPress={() => {
                  setIsLocked(true);
                  setShowControls(false);
                  setShowLockPrompt(true);
                  setTimeout(() => setShowLockPrompt(false), 2500);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="lock-open-outline" size={18} color="#fff" />
              </TouchableOpacity>

              {isSeries && (
                <TouchableOpacity
                  style={styles.episodesToggle}
                  onPress={() => setShowEpisodesModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="list" size={16} color="#fff" />
                  <Text style={styles.episodesToggleText}>Qismlar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Center Playback Controls */}
          <View style={styles.centerHud} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => skipTime(-10)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={26} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.skipLabel}>-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseBtn}
              onPress={togglePlayPause}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={34}
                color="#fff"
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => skipTime(10)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={26} color="#fff" />
              <Text style={styles.skipLabel}>+10s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom HUD: Scrubber, Timers, Speeds, Fullscreen */}
          <View style={styles.bottomHud} pointerEvents="box-none">
            {/* Scrubber Progress Bar */}
            <View style={styles.scrubberRow}>
              <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
              <TouchableOpacity
                style={styles.progressTrackWrap}
                onPress={handleSeek}
                activeOpacity={1}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFilled, { width: `${progressPercent}%` }]} />
                  <View style={[styles.progressThumb, { left: `${Math.max(0, Math.min(98, progressPercent))}%` }]} />
                </View>
              </TouchableOpacity>
              <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
            </View>

            {/* Bottom Actions Row */}
            <View style={styles.toolsRow} pointerEvents="box-none">
              <View style={styles.toolsLeft}>
                {/* Speed Selector Button */}
                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={() => setShowSpeedModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="speedometer-outline" size={16} color="#cbd5e1" />
                  <Text style={styles.toolBtnText}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                {/* Sleep Timer Button */}
                <TouchableOpacity
                  style={[styles.toolBtn, sleepTimer !== null && styles.activeToolBtn]}
                  onPress={() => setShowTimerModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="timer-outline"
                    size={16}
                    color={sleepTimer !== null ? '#fff' : '#cbd5e1'}
                  />
                  <Text style={[styles.toolBtnText, sleepTimer !== null && styles.activeToolBtnText]}>
                    {sleepTimer !== null ? `${sleepTimer} daq` : 'Taymer'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.qualityBadge}>
                  <Text style={styles.qualityBadgeText}>1080p FHD</Text>
                </View>
              </View>

              <View style={styles.toolsRight}>
                {/* Dedicated Fullscreen / Landscape Switcher Button */}
                <TouchableOpacity
                  style={styles.fullscreenBtn}
                  onPress={toggleFullscreen}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFullscreen ? 'contract' : 'scan'}
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.fullscreenBtnText}>
                    {isFullscreen ? 'Kichraytirish' : "To'liq ekran"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Speed Selector Modal */}
      <Modal
        visible={showSpeedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSpeedModal(false)}
        >
          <View style={styles.compactModalContent}>
            <Text style={styles.modalSheetTitle}>Ijro Tezligi</Text>
            <View style={styles.speedGrid}>
              {SPEED_OPTIONS.map((spd) => (
                <TouchableOpacity
                  key={spd}
                  style={[styles.speedOption, playbackSpeed === spd && styles.activeSpeedOption]}
                  onPress={() => handleSpeedChange(spd)}
                >
                  <Text style={[styles.speedOptionText, playbackSpeed === spd && styles.activeSpeedOptionText]}>
                    {spd}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sleep Timer Modal */}
      <Modal
        visible={showTimerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowTimerModal(false)}
        >
          <View style={styles.compactModalContent}>
            <Text style={styles.modalSheetTitle}>Avto-O'chirish Taymeri</Text>
            <View style={styles.timerOptionsRow}>
              {SLEEP_TIMERS.map((min) => (
                <TouchableOpacity
                  key={min}
                  style={[styles.timerOption, sleepTimer === min && styles.activeTimerOption]}
                  onPress={() => {
                    setSleepTimer(min);
                    setShowTimerModal(false);
                    showToastMessage(`Taymer: ${min} daqiqaga qo'yildi`);
                  }}
                >
                  <Text style={[styles.timerOptionText, sleepTimer === min && styles.activeTimerOptionText]}>
                    {min} daq
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {sleepTimer !== null && (
              <TouchableOpacity
                style={styles.clearTimerBtn}
                onPress={() => {
                  setSleepTimer(null);
                  setShowTimerModal(false);
                  showToastMessage("Taymer bekor qilindi");
                }}
              >
                <Text style={styles.clearTimerText}>Taymerni o'chirish</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Series Episodes Drawer Modal */}
      {seriesItem && (
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
                            name={isActive ? 'play' : 'videocam-outline'}
                            size={16}
                            color={isActive ? '#fff' : '#94a3b8'}
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
  doubleTapOverlay: {
    position: 'absolute',
    top: '35%',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 35,
  },
  doubleTapLeft: {
    left: '15%',
  },
  doubleTapRight: {
    right: '15%',
  },
  doubleTapText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 50,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7, 10, 18, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  lockPromptOverlay: {
    position: 'absolute',
    top: 30,
    right: 30,
    zIndex: 60,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7, 10, 18, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e50914',
  },
  unlockBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  controlsHud: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  hudIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 10, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hudIconBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(7, 10, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7, 10, 18, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  pillActionText: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '800',
  },
  episodesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e50914',
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    gap: 46,
  },
  playPauseBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(229, 9, 20, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  skipBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 10, 18, 0.75)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipLabel: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '800',
  },
  bottomHud: {
    paddingBottom: 4,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  timeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'center',
  },
  progressTrackWrap: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
  },
  progressFilled: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e50914',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7, 10, 18, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeToolBtn: {
    backgroundColor: '#ffb703',
    borderColor: '#ffb703',
  },
  toolBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  activeToolBtnText: {
    color: '#070a12',
    fontWeight: '900',
  },
  qualityBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  qualityBadgeText: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '800',
  },
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e50914',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fullscreenBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  nextOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 18, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
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
    fontSize: 58,
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  compactModalContent: {
    backgroundColor: '#070a12',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalSheetTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  speedOption: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0f1422',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeSpeedOption: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  speedOptionText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
  },
  activeSpeedOptionText: {
    color: '#fff',
  },
  timerOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  timerOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0f1422',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeTimerOption: {
    backgroundColor: '#ffb703',
    borderColor: '#ffb703',
  },
  timerOptionText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '800',
  },
  activeTimerOptionText: {
    color: '#070a12',
  },
  clearTimerBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearTimerText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  modalContent: {
    maxHeight: '75%',
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
    maxHeight: 400,
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
