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
  ActivityIndicator,
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

/**
 * Optimizes and cleans video URL for Android ExoPlayer:
 * 1. Directly routes https://fayllar1.ru/XX/ to https://XX.fayllar1.ru/XX/ (bypasses 301 redirect delay).
 * 2. Safely encodes spaces (%20) and URL special characters without breaking path slashes.
 */
function optimizeVideoUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // Route directly to storage subdomain, avoiding 3-4s HTTP 301 redirect roundtrips
  url = url.replace(/^https?:\/\/fayllar1\.ru\/(\d+)\//i, 'https://$1.fayllar1.ru/$1/');

  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split('/')
      .map((part) => {
        try {
          return encodeURIComponent(decodeURIComponent(part))
            .replace(/%28/g, '(')
            .replace(/%29/g, ')')
            .replace(/%27/g, "'");
        } catch {
          return encodeURIComponent(part);
        }
      })
      .join('/');
    return parsed.toString();
  } catch {
    try {
      return encodeURI(decodeURI(url));
    } catch {
      return encodeURI(url);
    }
  }
}

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
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

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
  const rawVideoUrl = useMemo(() => {
    if (isSeries && currentEpisode?.videoUrl) {
      return currentEpisode.videoUrl;
    }
    if (item && 'videoUrl' in item && item.videoUrl) {
      return item.videoUrl;
    }
    return '';
  }, [item, isSeries, currentEpisode]);

  // Clean, high-performance optimized URL for Android ExoPlayer
  const videoUrl = useMemo(() => {
    return optimizeVideoUrl(rawVideoUrl);
  }, [rawVideoUrl]);

  // Reset states when URL or retryKey changes
  useEffect(() => {
    setIsBuffering(true);
    setPlaybackError(null);
    setHasLoaded(false);
  }, [videoUrl, retryKey]);

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
    if (!status.isLoaded) {
      if (status.error) {
        console.warn('Playback status error:', status.error);
        setPlaybackError(status.error);
        setIsBuffering(false);
      }
      return;
    }

    setHasLoaded(true);
    setPlaybackError(null);
    setIsBuffering(status.isBuffering);
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
        setHasLoaded(false);
        return;
      } else if (epIdx >= 0 && sIdx < seriesItem.seasons.length - 1) {
        setCurrentEpisode(seriesItem.seasons[sIdx + 1].episodes[0]);
        setHasLoaded(false);
        return;
      }
    }
  };

  const handleRetry = () => {
    setPlaybackError(null);
    setIsBuffering(true);
    setRetryKey((prev) => prev + 1);
    showToastMessage('Qayta ulanmoqda...');
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
          key={`video-${retryKey}-${videoUrl}`}
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={resizeMode}
          shouldPlay={true}
          usePoster={true}
          posterSource={{ uri: item.backdrop || item.poster }}
          posterStyle={{ resizeMode: 'cover' }}
          progressUpdateIntervalMillis={500}
          rate={playbackSpeed}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onLoadStart={() => {
            setIsBuffering(true);
            setPlaybackError(null);
          }}
          onLoad={() => {
            setIsBuffering(false);
            setHasLoaded(true);
            setPlaybackError(null);
          }}
          onError={(err) => {
            console.warn('Video load error:', err);
            setPlaybackError('Video oqimini yuklab bo‘lmadi');
            setIsBuffering(false);
          }}
        />
      </TouchableOpacity>

      {/* Instant Buffering & Loading Neon Spinner */}
      {isBuffering && !playbackError && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <View style={styles.bufferingCard}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.bufferingText}>Kino tezkor yuklanmoqda...</Text>
            <Text style={styles.bufferingSubText}>1080p Full HD • Tezkor Tas-IX</Text>
          </View>
        </View>
      )}

      {/* Real Error Recovery Card (Only shown if playback actually fails) */}
      {playbackError && (
        <View style={styles.errorOverlay} pointerEvents="box-none">
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={44} color="#e50914" />
            <Text style={styles.errorTitle}>Videoni yuklashda uzilish</Text>
            <Text style={styles.errorDesc}>
              Internet aloqasi yoki video serverida vaqtinchalik javob kechikishi yuz berdi.
            </Text>
            <View style={styles.errorButtonsRow}>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={handleRetry}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryBtnText}>Qayta Urinish</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleGoBack}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={18} color="#cbd5e1" />
                <Text style={styles.backBtnText}>Orqaga</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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

      {/* Screen Lock Overlay Prompter */}
      {isLocked && showLockPrompt && (
        <View style={styles.lockOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={() => {
              setIsLocked(false);
              showToastMessage('Ekran qulfdan chiqarildi');
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-open" size={24} color="#fff" />
            <Text style={styles.unlockText}>Qulfdan chiqarish</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Aspect Ratio / Action Toast */}
      {resizeToast && (
        <View style={styles.toastContainer} pointerEvents="none">
          <Text style={styles.toastText}>{resizeToast}</Text>
        </View>
      )}

      {/* Full Player HUD Controls Overlay */}
      {showControls && !isLocked && (
        <View style={styles.hudOverlay} pointerEvents="box-none">
          {/* Top Bar */}
          <View style={styles.topHud}>
            <TouchableOpacity style={styles.hudCircleBtn} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.hudTitleWrap}>
              <Text style={styles.hudTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {isSeries && currentEpisode && (
                <Text style={styles.hudSubTitle} numberOfLines={1}>
                  {currentEpisode.title || `Qism ${currentEpisode.episodeNumber}`}
                </Text>
              )}
            </View>

            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.pillActionBtn}
                onPress={() => {
                  setIsLocked(true);
                  showToastMessage('Ekran qulflandi');
                }}
              >
                <Ionicons name="lock-closed" size={16} color="#00f2fe" />
                <Text style={styles.pillActionText}>Qulf</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pillActionBtn} onPress={cycleResizeMode}>
                <Ionicons name="scan-outline" size={16} color="#00f2fe" />
                <Text style={styles.pillActionText}>O'lcham</Text>
              </TouchableOpacity>

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

          {/* Center Play/Pause & Fast-Forward / Rewind Controls */}
          <View style={styles.centerHud} pointerEvents="box-none">
            <TouchableOpacity style={styles.skipBtn} onPress={() => skipTime(-10)}>
              <Ionicons name="play-back" size={26} color="#ffffff" />
              <Text style={styles.skipLabel}>10s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={36}
                color="#ffffff"
                style={!isPlaying ? { marginLeft: 3 } : undefined}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => skipTime(10)}>
              <Ionicons name="play-forward" size={26} color="#ffffff" />
              <Text style={styles.skipLabel}>10s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Controls: Scrubber & Tools */}
          <View style={styles.bottomHud}>
            {/* Scrubber Time Bar */}
            <View style={styles.scrubberRow}>
              <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
              <TouchableOpacity
                style={styles.progressTrackWrap}
                activeOpacity={1}
                onPress={handleSeek}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFilled, { width: `${progressPercent}%` }]} />
                  <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
                </View>
              </TouchableOpacity>
              <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
            </View>

            {/* Bottom Actions Row */}
            <View style={styles.toolsRow}>
              <View style={styles.toolsLeft}>
                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={() => setShowSpeedModal(true)}
                >
                  <Ionicons name="speedometer-outline" size={16} color="#cbd5e1" />
                  <Text style={styles.toolBtnText}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolBtn, sleepTimer !== null && styles.activeToolBtn]}
                  onPress={() => setShowTimerModal(true)}
                >
                  <Ionicons
                    name="moon-outline"
                    size={16}
                    color={sleepTimer !== null ? '#070a12' : '#cbd5e1'}
                  />
                  <Text style={[styles.toolBtnText, sleepTimer !== null && styles.activeToolBtnText]}>
                    {sleepTimer ? `${sleepTimer}m` : 'Taymer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolBtn} onPress={handleRetry}>
                  <Ionicons name="refresh" size={15} color="#00f2fe" />
                  <Text style={[styles.toolBtnText, { color: '#00f2fe' }]}>Yangilash</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toolsRight}>
                <TouchableOpacity
                  style={styles.fullscreenBtn}
                  onPress={toggleFullscreen}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isFullscreen ? 'contract' : 'expand'}
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.fullscreenBtnText}>
                    {isFullscreen ? 'Kichraytirish' : "To'liq Ekran"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Next Episode Countdown Overlay */}
      {countdown !== null && (
        <View style={styles.nextOverlay}>
          <Text style={styles.nextLabel}>KEYINGI QISM</Text>
          <Text style={styles.nextCount}>{countdown}</Text>
          <View style={styles.nextBtnRow}>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextEpisode}>
              <Text style={styles.nextBtnText}>Hozir boshlash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCountdown(null)}>
              <Text style={styles.cancelBtnText}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Speed Modal */}
      <Modal visible={showSpeedModal} transparent animationType="fade">
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
                  <Text
                    style={[
                      styles.speedOptionText,
                      playbackSpeed === spd && styles.activeSpeedOptionText,
                    ]}
                  >
                    {spd}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sleep Timer Modal */}
      <Modal visible={showTimerModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowTimerModal(false)}
        >
          <View style={styles.compactModalContent}>
            <Text style={styles.modalSheetTitle}>Uyqu Taymeri</Text>
            <View style={styles.timerOptionsRow}>
              {SLEEP_TIMERS.map((min) => (
                <TouchableOpacity
                  key={min}
                  style={[styles.timerOption, sleepTimer === min && styles.activeTimerOption]}
                  onPress={() => {
                    setSleepTimer(min);
                    setShowTimerModal(false);
                    showToastMessage(`Taymer: ${min} daqiqa`);
                  }}
                >
                  <Text
                    style={[
                      styles.timerOptionText,
                      sleepTimer === min && styles.activeTimerOptionText,
                    ]}
                  >
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
                  showToastMessage('Taymer o‘chirildi');
                }}
              >
                <Text style={styles.clearTimerText}>Taymerni o‘chirish</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Series Episodes Selection Modal */}
      {seriesItem && (
        <Modal visible={showEpisodesModal} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowEpisodesModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Qismlar ro‘yxati</Text>
                <TouchableOpacity onPress={() => setShowEpisodesModal(false)}>
                  <Ionicons name="close" size={24} color="#cbd5e1" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                {seriesItem.seasons.map((season, sIdx) => (
                  <View key={sIdx} style={styles.seasonSection}>
                    <Text style={styles.seasonLabel}>{season.seasonTitle || `${sIdx + 1}-Mavsum`}</Text>
                    {season.episodes.map((ep) => {
                      const isActive = currentEpisode?.id === ep.id;
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
                            name={isActive ? 'play' : 'play-outline'}
                            size={18}
                            color={isActive ? '#e50914' : '#cbd5e1'}
                          />
                          <Text
                            style={[styles.modalEpText, isActive && styles.activeModalEpText]}
                            numberOfLines={1}
                          >
                            {ep.title || `${ep.episodeNumber}-Qism`}
                          </Text>
                          {ep.duration && (
                            <Text style={styles.modalEpDuration}>{ep.duration}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  videoTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  bufferingCard: {
    backgroundColor: 'rgba(7, 10, 18, 0.82)',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    gap: 8,
  },
  bufferingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  bufferingSubText: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '800',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    padding: 24,
  },
  errorCard: {
    backgroundColor: '#0f1422',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
    maxWidth: 360,
    width: '100%',
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e50914',
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  doubleTapOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 35,
  },
  doubleTapLeft: {
    left: 0,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
  },
  doubleTapRight: {
    right: 0,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderTopLeftRadius: 100,
    borderBottomLeftRadius: 100,
  },
  doubleTapText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  lockOverlay: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 60,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  unlockText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  toastContainer: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(7, 10, 18, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 70,
  },
  toastText: {
    color: '#00f2fe',
    fontSize: 12,
    fontWeight: '800',
  },
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 18, 0.5)',
    justifyContent: 'space-between',
    padding: 16,
    zIndex: 30,
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hudCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(7, 10, 18, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTitleWrap: {
    flex: 1,
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
