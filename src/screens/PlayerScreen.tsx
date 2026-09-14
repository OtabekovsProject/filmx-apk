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
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getMediaById } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { Series, Episode } from '../types';
import { DownloadModal } from '../components/DownloadModal';

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SLEEP_TIMERS = [15, 30, 45, 60];

const QUALITY_OPTIONS: Array<{ label: string; value: '1080p' | '720p' | '480p'; desc: string; icon: any }> = [
  { label: '1080p Full HD', value: '1080p', desc: 'Yuqori tiniqlik (Asl sifat)', icon: 'sparkles' },
  { label: '720p HD (Tavsiya)', value: '720p', desc: 'Tezkor va ravon (Qotmasdan)', icon: 'film' },
  { label: '480p Standart', value: '480p', desc: 'Eng tez, tejamkor (Mobil internet)', icon: 'flash' },
];

function optimizeVideoUrl(rawUrl?: string, selectedQuality: '1080p' | '720p' | '480p' = '720p'): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // If local file, return as is
  if (url.startsWith('file://')) {
    return url;
  }

  // Fix old unreachable internal IP to direct high-speed cluster
  url = url.replace(/^https?:\/\/83\.69\.139\.204\/hdd(\d+)\//i, (match, p1) => 'https://' + p1 + '.fayllar1.ru/' + p1 + '/');
  url = url.replace(/^https?:\/\/83\.69\.139\.204\/hdd\//i, 'https://15.fayllar1.ru/15/');

  // Route directly to storage subdomain, avoiding 3-4s HTTP 301 redirect roundtrips
  // Correctly captures both numeric and alphanumeric subdomains (2-1-h, 15, 11, 1-s-x, etc.)
  url = url.replace(/^https?:\/\/fayllar1\.ru\/([^/]+)\//i, (match, p1) => 'https://' + p1 + '.fayllar1.ru/' + p1 + '/');

  // Apply quality switch if stream supports standard quality naming
  if (selectedQuality === '720p') {
    url = url.replace(/1080p/gi, '720p');
  } else if (selectedQuality === '480p') {
    url = url.replace(/1080p|720p/gi, '480p');
  } else if (selectedQuality === '1080p') {
    url = url.replace(/720p|480p/gi, '1080p');
  }

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
  const { id, episodeId, offlineUri } = route.params;
  const { width, height } = useWindowDimensions();

  const item = useMemo(() => getMediaById(id), [id]);
  const { recordProgress, getDownload, history } = useApp();
  const [showDownloadModal, setShowDownloadModal] = useState(false);

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
  const [selectedQuality, setSelectedQuality] = useState<'1080p' | '720p' | '480p'>('720p');
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodesModal, setShowEpisodesModal] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Resume playback banner state
  const [resumePrompt, setResumePrompt] = useState<{ positionSec: number; formatted: string } | null>(null);
  const hasCheckedResumeRef = useRef(false);

  // High-performance refs: eliminates React Native bridge re-renders during playback
  const showControlsRef = useRef<boolean>(true);
  showControlsRef.current = showControls;
  const positionMillisRef = useRef<number>(0);
  const lastRecordedSecRef = useRef<number>(0);
  const lastBufferingRef = useRef<boolean>(true);
  const lastPlayingRef = useRef<boolean>(true);
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
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we have an offline local download
  const currentDownload = getDownload(id, currentEpisode?.id);
  const localOfflineFile = offlineUri || currentDownload?.localUri;

  // Determine current video URL
  const rawVideoUrl = useMemo(() => {
    if (localOfflineFile) {
      return localOfflineFile;
    }
    if (isSeries && currentEpisode?.videoUrl) {
      return currentEpisode.videoUrl;
    }
    if (item && 'videoUrl' in item && item.videoUrl) {
      return item.videoUrl;
    }
    return '';
  }, [item, isSeries, currentEpisode, localOfflineFile]);

  const videoUrl = useMemo(() => {
    return optimizeVideoUrl(rawVideoUrl, selectedQuality);
  }, [rawVideoUrl, selectedQuality]);

  // Reset states when URL or retryKey changes
  useEffect(() => {
    setIsBuffering(true);
    setPlaybackError(null);
    setHasLoaded(false);
  }, [videoUrl, retryKey]);

  // Audio session & orientation setup
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    // Unlock orientation for smooth fluid rotation (zero surface destruction jank on mount!)
    ScreenOrientation.unlockAsync().catch(() => {});

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (lockPromptTimeoutRef.current) clearTimeout(lockPromptTimeoutRef.current);
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Check if user previously watched and prompt to resume
  useEffect(() => {
    if (hasCheckedResumeRef.current || !item) return;
    hasCheckedResumeRef.current = true;
    const historyItem = history?.find(
      (h) => h.item.id === item.id && (!isSeries || h.episodeId === currentEpisode?.id)
    );
    if (historyItem && historyItem.currentTime > 15 && historyItem.currentTime < (historyItem.duration || 99999) - 30) {
      const posSec = Math.floor(historyItem.currentTime);
      const h = Math.floor(posSec / 3600);
      const m = Math.floor((posSec % 3600) / 60);
      const s = posSec % 60;
      const formatted = h > 0 ? `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}` : `${m}:${s < 10 ? '0' : ''}${s}`;
      setResumePrompt({ positionSec: posSec, formatted });
      setTimeout(() => {
        setResumePrompt(null);
      }, 7000);
    }
  }, [item, isSeries, currentEpisode, history]);

  const handleResume = async () => {
    if (!resumePrompt) return;
    const targetMs = resumePrompt.positionSec * 1000;
    setResumePrompt(null);
    showToastMessage(`Davom etilmoqda: ${resumePrompt.formatted}`);
    try {
      await videoRef.current?.setPositionAsync(targetMs);
    } catch (e) {}
  };

  // Auto-hide controls after 2.8 seconds of inactivity
  const scheduleControlsHide = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2800);
  }, []);

  // One-tap controls toggle (Immediate hide if visible, show if hidden)
  const toggleControls = useCallback(() => {
    if (isLocked) {
      setShowLockPrompt(true);
      if (lockPromptTimeoutRef.current) clearTimeout(lockPromptTimeoutRef.current);
      lockPromptTimeoutRef.current = setTimeout(() => {
        setShowLockPrompt(false);
      }, 2500);
      return;
    }

    setShowControls((prev) => {
      const next = !prev;
      if (next) {
        // Sync scrubber position state immediately when opening controls
        setPositionMillis(positionMillisRef.current);
        scheduleControlsHide();
      } else {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
      return next;
    });
  }, [isLocked, scheduleControlsHide]);

  // Initial controls auto-hide after 3 seconds
  useEffect(() => {
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  // Sleep timer handler
  useEffect(() => {
    if (sleepTimer === null) return;
    const timer = setTimeout(() => {
      videoRef.current?.pauseAsync();
      setSleepTimer(null);
      showToastMessage('Uyqu taymeri: Ijro to‘xtatildi');
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
    scheduleControlsHide();
    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
        showToastMessage("To'liq ekran rejimi");
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
        showToastMessage('Standart rejim');
      }
    } catch (e) {
      try {
        await videoRef.current?.presentFullscreenPlayer();
      } catch (err) {}
    }
  };

  // Toggle Mute
  const toggleMute = async () => {
    scheduleControlsHide();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    await videoRef.current?.setIsMutedAsync(nextMuted);
    showToastMessage(nextMuted ? '🔇 Ovoz o‘chirildi' : '🔊 Ovoz yoqildi');
  };

  // Cycle aspect ratio / resize mode
  const cycleResizeMode = () => {
    scheduleControlsHide();
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

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.warn('Playback status error:', status.error);
        if (selectedQuality !== '1080p') {
          setSelectedQuality('1080p');
          showToastMessage("Asl sifatga o'tildi (1080p)");
          return;
        }
        setPlaybackError(status.error);
        setIsBuffering(false);
      }
      return;
    }

    if (!hasLoaded) setHasLoaded(true);
    if (playbackError) setPlaybackError(null);

    const isBuff = status.isBuffering && !status.isPlaying;
    if (isBuff !== lastBufferingRef.current) {
      lastBufferingRef.current = isBuff;
      setIsBuffering(isBuff);
    }

    if (status.isPlaying !== lastPlayingRef.current) {
      lastPlayingRef.current = status.isPlaying;
      setIsPlaying(status.isPlaying);
    }

    positionMillisRef.current = status.positionMillis;
    // PERFORMANCE: Only trigger React state update if controls are currently open!
    if (showControlsRef.current) {
      setPositionMillis(status.positionMillis);
    }

    if (status.durationMillis && status.durationMillis !== durationMillis) {
      setDurationMillis(status.durationMillis);
    }

    // Throttled history save: record ONLY once every 20 seconds to keep 60fps UI thread!
    const currentSec = Math.floor(status.positionMillis / 1000);
    if (currentSec > 0 && currentSec % 20 === 0 && currentSec !== lastRecordedSecRef.current) {
      lastRecordedSecRef.current = currentSec;
      if (item && status.durationMillis) {
        recordProgress(
          item,
          currentSec,
          status.durationMillis / 1000,
          currentEpisode?.id,
          currentEpisode?.title
        );
      }
    }

    if (status.didJustFinish && isSeries) {
      setCountdown(5);
    }
  }, [hasLoaded, playbackError, durationMillis, item, currentEpisode, isSeries, recordProgress, selectedQuality]);

  const handleQualityChange = (q: '1080p' | '720p' | '480p') => {
    if (q === selectedQuality) {
      setShowQualityModal(false);
      return;
    }
    const currentPos = positionMillisRef.current || positionMillis;
    setShowQualityModal(false);
    setSelectedQuality(q);
    showToastMessage(`Sifat: ${q} o'rnatildi`);
    setTimeout(async () => {
      try {
        await videoRef.current?.setPositionAsync(currentPos);
      } catch (e) {}
    }, 450);
  };

  const togglePlayPause = async () => {
    scheduleControlsHide();
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
      scheduleControlsHide();
    }
  };

  const skipTime = async (seconds: number) => {
    scheduleControlsHide();
    const curPos = positionMillisRef.current || positionMillis;
    const newPos = Math.max(0, Math.min(durationMillis, curPos + seconds * 1000));
    positionMillisRef.current = newPos;
    setPositionMillis(newPos);
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

  // Handle double-tap skip vs single-tap toggle (debounced to eliminate controls flicker)
  const handleTouchScreen = (evt: any) => {
    const now = Date.now();
    const touchX = evt.nativeEvent.locationX;
    const timeDelta = now - lastTapRef.current.time;

    if (timeDelta < 280 && Math.abs(touchX - lastTapRef.current.x) < 140) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
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
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        toggleControls();
        singleTapTimerRef.current = null;
      }, 260);
    }
  };

  const triggerDoubleTapAnim = (side: 'left' | 'right') => {
    setDoubleTapSide(side);
    doubleTapAnim.setValue(0);
    Animated.sequence([
      Animated.timing(doubleTapAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(doubleTapAnim, {
        toValue: 0,
        duration: 250,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start(() => setDoubleTapSide(null));
  };

  const handleSeek = async (evt: any) => {
    scheduleControlsHide();
    const trackWidth = Math.max(100, width - 130);
    const clickX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, clickX / trackWidth));
    const targetMillis = ratio * durationMillis;
    positionMillisRef.current = targetMillis;
    setPositionMillis(targetMillis);
    await videoRef.current?.setPositionAsync(targetMillis);
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
  const showBufferingSpinner = (!hasLoaded || (isBuffering && !isPlaying)) && !playbackError;

  if (!item) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Main Video Touch Surface */}
      <TouchableOpacity
        style={styles.videoTouch}
        activeOpacity={1}
        onPress={handleTouchScreen}
      >
        <Video
          key={`video-${retryKey}-${videoUrl}`}
          ref={videoRef}
          source={{
            uri: videoUrl,
            headers: {
              'User-Agent': 'FilmX-Mobile-Player/1.7',
              'Accept': '*/*',
            },
          }}
          style={styles.video}
          resizeMode={resizeMode}
          shouldPlay={true}
          isMuted={isMuted}
          progressUpdateIntervalMillis={1000}
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
            if (selectedQuality !== '1080p') {
              setSelectedQuality('1080p');
              showToastMessage("Asl sifatga o'tildi (1080p)");
              return;
            }
            setPlaybackError('Video oqimini yuklab bo‘lmadi');
            setIsBuffering(false);
          }}
        />
      </TouchableOpacity>

      {/* Minimal, Completely Non-Obtrusive Transparent Buffering Spinner */}
      {showBufferingSpinner && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#00f2fe" />
        </View>
      )}

      {/* Resume Playback Floating Banner */}
      {resumePrompt && (
        <View style={styles.resumeBannerContainer} pointerEvents="box-none">
          <View style={styles.resumeBannerCard}>
            <Ionicons name="time" size={18} color="#00f2fe" />
            <Text style={styles.resumeBannerText}>
              {resumePrompt.formatted} da to'xtatilgan
            </Text>
            <TouchableOpacity style={styles.resumeActionBtn} onPress={handleResume}>
              <Ionicons name="play" size={14} color="#070a12" />
              <Text style={styles.resumeActionText}>Davom etish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeCloseBtn} onPress={() => setResumePrompt(null)}>
              <Ionicons name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error Recovery Card */}
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
          <Ionicons name="play-back" size={34} color="#fff" />
          <Text style={styles.doubleTapText}>-10s</Text>
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
          <Ionicons name="play-forward" size={34} color="#fff" />
          <Text style={styles.doubleTapText}>+10s</Text>
        </Animated.View>
      )}

      {/* Screen Lock Overlay Prompter */}
      {isLocked && showLockPrompt && (
        <View style={styles.lockOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={() => {
              setIsLocked(false);
              setShowControls(true);
              scheduleControlsHide();
              showToastMessage('🔓 Ekran qulfdan chiqarildi');
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-open" size={22} color="#fff" />
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

      {/* Pure Cinema Player HUD Controls Overlay */}
      {showControls && !isLocked && (
        <View style={styles.hudOverlay} pointerEvents="box-none">
          {/* Top Bar with gentle gradient backdrop */}
          <View style={styles.topHud}>
            <TouchableOpacity style={styles.hudCircleBtn} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
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
                  setShowControls(false);
                  showToastMessage('🔒 Ekran qulflandi');
                }}
              >
                <Ionicons name="lock-closed" size={15} color="#00f2fe" />
                <Text style={styles.pillActionText}>Qulf</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pillActionBtn} onPress={cycleResizeMode}>
                <Ionicons name="scan-outline" size={15} color="#00f2fe" />
                <Text style={styles.pillActionText}>O'lcham</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pillActionBtn}
                onPress={() => {
                  scheduleControlsHide();
                  setShowDownloadModal(true);
                }}
              >
                <Ionicons
                  name={currentDownload ? (currentDownload.target === 'server' ? 'cloud-done' : 'checkmark-circle') : 'download-outline'}
                  size={15}
                  color={currentDownload ? '#10b981' : '#00f2fe'}
                />
                <Text style={[styles.pillActionText, currentDownload && { color: '#10b981' }]}>
                  {currentDownload ? (currentDownload.target === 'server' ? 'Serverda' : 'Yuklangan') : 'Yuklash'}
                </Text>
              </TouchableOpacity>

              {isSeries && (
                <TouchableOpacity
                  style={styles.episodesToggle}
                  onPress={() => setShowEpisodesModal(true)}
                >
                  <Ionicons name="list" size={16} color="#fff" />
                  <Text style={styles.episodesToggleText}>Qismlar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Center Play/Pause & Fast-Forward / Rewind Controls */}
          <View style={styles.centerHud} pointerEvents="box-none">
            <TouchableOpacity style={styles.skipBtn} onPress={() => skipTime(-10)}>
              <Ionicons name="play-back" size={24} color="#ffffff" />
              <Text style={styles.skipLabel}>10s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={34}
                color="#ffffff"
                style={!isPlaying ? { marginLeft: 3 } : undefined}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => skipTime(10)}>
              <Ionicons name="play-forward" size={24} color="#ffffff" />
              <Text style={styles.skipLabel}>10s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Controls: Scrubber & Tools with gentle backdrop */}
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
                  style={[styles.toolBtn, { borderColor: 'rgba(0, 242, 254, 0.35)' }]}
                  onPress={() => setShowQualityModal(true)}
                >
                  <Ionicons name="sparkles-outline" size={15} color="#00f2fe" />
                  <Text style={[styles.toolBtnText, { color: '#00f2fe', fontWeight: '800' }]}>
                    {selectedQuality.toUpperCase()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={() => setShowSpeedModal(true)}
                >
                  <Ionicons name="speedometer-outline" size={15} color="#cbd5e1" />
                  <Text style={styles.toolBtnText}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolBtn} onPress={toggleMute}>
                  <Ionicons
                    name={isMuted ? 'volume-mute' : 'volume-high-outline'}
                    size={15}
                    color={isMuted ? '#ef4444' : '#cbd5e1'}
                  />
                  <Text style={[styles.toolBtnText, isMuted && { color: '#ef4444' }]}>
                    {isMuted ? "Ovoz o'chiq" : 'Ovoz'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolBtn, sleepTimer !== null && styles.activeToolBtn]}
                  onPress={() => setShowTimerModal(true)}
                >
                  <Ionicons
                    name="moon-outline"
                    size={15}
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
                    size={18}
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

      {/* Quality Modal */}
      <Modal visible={showQualityModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowQualityModal(false)}
        >
          <View style={styles.compactModalContent}>
            <Text style={styles.modalSheetTitle}>Video Sifati (Oqim)</Text>
            <View style={styles.qualityListWrap}>
              {QUALITY_OPTIONS.map((q) => {
                const isActive = selectedQuality === q.value;
                return (
                  <TouchableOpacity
                    key={q.value}
                    style={[styles.qualityOptionCard, isActive && styles.activeQualityCard]}
                    onPress={() => handleQualityChange(q.value)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.qualityLeftRow}>
                      <Ionicons
                        name={q.icon}
                        size={20}
                        color={isActive ? '#00f2fe' : '#94a3b8'}
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.qualityLabel, isActive && styles.activeQualityLabel]}>
                          {q.label}
                        </Text>
                        <Text style={styles.qualityDesc}>{q.desc}</Text>
                      </View>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={22} color="#00f2fe" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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

      {/* In-Player Download Modal */}
      {item && (
        <DownloadModal
          visible={showDownloadModal}
          item={item}
          initialEpisodeId={currentEpisode?.id}
          onClose={() => setShowDownloadModal(false)}
        />
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
    backgroundColor: 'transparent',
  },
  resumeBannerContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 80,
  },
  resumeBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 20, 34, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
    gap: 10,
  },
  resumeBannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  resumeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00f2fe',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  resumeActionText: {
    color: '#070a12',
    fontSize: 11,
    fontWeight: '900',
  },
  resumeCloseBtn: {
    padding: 2,
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
    width: '35%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 35,
  },
  doubleTapLeft: {
    left: 0,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 242, 254, 0.4)',
  },
  doubleTapRight: {
    right: 0,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderTopLeftRadius: 100,
    borderBottomLeftRadius: 100,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(229, 9, 20, 0.4)',
  },
  doubleTapText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  lockOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 60,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  unlockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  toastContainer: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(7, 10, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    zIndex: 70,
  },
  toastText: {
    color: '#00f2fe',
    fontSize: 12,
    fontWeight: '800',
  },
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 16,
    zIndex: 30,
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(7, 10, 18, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  hudCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTitleWrap: {
    flex: 1,
  },
  hudTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  hudSubTitle: {
    color: '#00f2fe',
    fontSize: 11,
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
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    gap: 5,
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  episodesToggleText: {
    color: '#fff',
    fontSize: 11,
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
    backgroundColor: 'rgba(7, 10, 18, 0.7)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  skipLabel: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '800',
  },
  bottomHud: {
    backgroundColor: 'rgba(7, 10, 18, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  timeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 38,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    gap: 5,
    backgroundColor: '#e50914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fullscreenBtnText: {
    color: '#ffffff',
    fontSize: 11,
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
    maxHeight: '85%',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#070a12',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
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
  qualityListWrap: {
    gap: 10,
    marginBottom: 10,
  },
  qualityOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeQualityCard: {
    borderColor: '#00f2fe',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  qualityLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  qualityLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
  },
  activeQualityLabel: {
    color: '#ffffff',
  },
  qualityDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
});
