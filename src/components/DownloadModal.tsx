import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaItem, Series, Episode, DownloadTarget } from '../types';
import { useApp } from '../context/AppContext';

interface DownloadModalProps {
  visible: boolean;
  item: MediaItem;
  initialEpisodeId?: string;
  onClose: () => void;
  onPlayOffline?: (localUri: string) => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  visible,
  item,
  initialEpisodeId,
  onClose,
  onPlayOffline,
}) => {
  const { downloadMovie, getDownload, cancelActiveDownload, removeDownload } = useApp();
  const isSeries = item.type === 'series';
  const seriesItem = isSeries ? (item as Series) : null;

  // Selected episode for series
  const [selectedEpId, setSelectedEpId] = useState<string>(() => {
    if (!isSeries || !seriesItem) return '';
    if (initialEpisodeId) return initialEpisodeId;
    return seriesItem.seasons[0]?.episodes[0]?.id || '';
  });

  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState('0');
  const [totalMB, setTotalMB] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Find selected episode object
  const currentEpisode: Episode | undefined = React.useMemo(() => {
    if (!seriesItem) return undefined;
    for (const season of seriesItem.seasons) {
      const found = season.episodes.find((e) => e.id === selectedEpId);
      if (found) return found;
    }
    return seriesItem.seasons[0]?.episodes[0];
  }, [seriesItem, selectedEpId]);

  // Current download record
  const currentDownload = getDownload(item.id, currentEpisode?.id);

  const handleStartDownload = async (target: DownloadTarget) => {
    try {
      setIsProcessing(true);
      setErrorNotice(null);
      setSuccessNotice(null);
      setDownloadProgress(0);

      if (target === 'server') {
        await downloadMovie(item, 'server', currentEpisode);
        setSuccessNotice('Kino serverdagi shaxsiy xotirangizga yuklandi! Telefoningizdan 0 MB joy olindi.');
      } else {
        await downloadMovie(
          item,
          'gallery',
          currentEpisode,
          (prog, dMB, tMB) => {
            setDownloadProgress(prog);
            setDownloadedMB(dMB.toFixed(1));
            setTotalMB(tMB.toFixed(1));
          }
        );
        setSuccessNotice('Kino muvaffaqiyatli yuklandi va qurilma xotirasiga saqlandi!');
      }
    } catch (err: any) {
      setErrorNotice(err?.message || "Yuklab olishda xatolik yuz berdi");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (currentDownload) {
      await cancelActiveDownload(currentDownload.id);
      setIsProcessing(false);
      setDownloadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (currentDownload) {
      await removeDownload(currentDownload.id);
      setSuccessNotice(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
              <View style={styles.headerTextWrap}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {currentEpisode && (
                  <Text style={styles.episodeSubtitle} numberOfLines={1}>
                    {currentEpisode.title || `${currentEpisode.episodeNumber}-Qism`}
                  </Text>
                )}
                <View style={styles.qualityTag}>
                  <Text style={styles.qualityText}>1080p FHD • Tas-IX</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Series Episode Selector (if series) */}
          {isSeries && seriesItem && (
            <View style={styles.seriesSelector}>
              <Text style={styles.selectorLabel}>Qismni tanlang:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.epScroll}>
                {seriesItem.seasons.map((s) =>
                  s.episodes.map((ep) => {
                    const isSelected = selectedEpId === ep.id;
                    const epDownload = getDownload(item.id, ep.id);
                    return (
                      <TouchableOpacity
                        key={ep.id}
                        style={[styles.epChip, isSelected && styles.activeEpChip]}
                        onPress={() => setSelectedEpId(ep.id)}
                      >
                        <Text style={[styles.epChipText, isSelected && styles.activeEpChipText]}>
                          {ep.episodeNumber}-qism
                        </Text>
                        {epDownload && (
                          <Ionicons
                            name={epDownload.target === 'server' ? 'cloud-done' : 'checkmark-circle'}
                            size={12}
                            color={epDownload.target === 'server' ? '#00f2fe' : '#10b981'}
                            style={{ marginLeft: 3 }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* Success or Error Notice */}
          {successNotice && (
            <View style={styles.noticeSuccess}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.noticeText}>{successNotice}</Text>
            </View>
          )}
          {errorNotice && (
            <View style={styles.noticeError}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.noticeText}>{errorNotice}</Text>
            </View>
          )}

          {/* Downloading Progress Bar View */}
          {currentDownload && currentDownload.status === 'downloading' ? (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={styles.downloadSpinnerRow}>
                  <ActivityIndicator size="small" color="#e50914" />
                  <Text style={styles.progressTitle}>Qurilma xotirasiga yuklanmoqda...</Text>
                </View>
                <Text style={styles.progressPercent}>{Math.round(downloadProgress * 100)}%</Text>
              </View>

              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.progressSize}>
                  {downloadedMB} MB / {totalMB} MB
                </Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                  <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                  <Text style={styles.cancelText}>Bekor qilish</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : currentDownload && currentDownload.status === 'completed' ? (
            /* Already downloaded status card */
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Ionicons
                  name={currentDownload.target === 'server' ? 'cloud-done' : 'phone-portrait'}
                  size={24}
                  color={currentDownload.target === 'server' ? '#00f2fe' : '#10b981'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>
                    {currentDownload.target === 'server'
                      ? 'Serverda saqlangan (0 MB)'
                      : 'Qurilma xotirasida (Oflayn)'}
                  </Text>
                  <Text style={styles.statusSub}>
                    {currentDownload.target === 'server'
                      ? 'Telefoningiz xotirasidan 0 bayt joy olingan. Istalgan vaqt serverdan ochiladi.'
                      : "Fayl to'liq yuklangan va internetsiz oflayn ko'rishga tayyor."}
                  </Text>
                </View>
              </View>

              <View style={styles.statusActions}>
                {currentDownload.localUri && onPlayOffline && (
                  <TouchableOpacity
                    style={styles.playOfflineBtn}
                    onPress={() => {
                      onClose();
                      onPlayOffline(currentDownload.localUri!);
                    }}
                  >
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.playOfflineText}>Oflayn ko'rish</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.deleteText}>O'chirish</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Download Options Choices */
            <View style={styles.optionsList}>
              {/* Option 1: Galereyaga / Qurilma xotirasiga */}
              <TouchableOpacity
                style={styles.optionCard}
                activeOpacity={0.8}
                onPress={() => handleStartDownload('gallery')}
                disabled={isProcessing}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(229, 9, 20, 0.15)' }]}>
                  <Ionicons name="phone-portrait-outline" size={24} color="#e50914" />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>Galereyaga yuklab olish</Text>
                    <View style={styles.galleryBadge}>
                      <Text style={styles.galleryBadgeText}>Oflayn xotira</Text>
                    </View>
                  </View>
                  <Text style={styles.optionDesc}>
                    Video telefon xotirasiga to'liq yuklanadi va galereyada saqlanadi. Internetsiz (oflayn) tomosha qilish mumkin.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </TouchableOpacity>

              {/* Option 2: Serverga yuklash (0 MB) */}
              <TouchableOpacity
                style={styles.optionCard}
                activeOpacity={0.8}
                onPress={() => handleStartDownload('server')}
                disabled={isProcessing}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(0, 242, 254, 0.15)' }]}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#00f2fe" />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>Serverga yuklash</Text>
                    <View style={styles.serverBadge}>
                      <Text style={styles.serverBadgeText}>0 MB Telefon xotirasi</Text>
                    </View>
                  </View>
                  <Text style={styles.optionDesc}>
                    Telefoningizdan 0 bayt joy olinadi! Kino shaxsiy server ro'yxatingizga saqlanadi va doimiy yuqori Tas-ix tezlikda ochiladi.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 16 }} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f1422',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  poster: {
    width: 48,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#131826',
  },
  headerTextWrap: {
    flex: 1,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  episodeSubtitle: {
    color: '#00f2fe',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  qualityTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualityText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  seriesSelector: {
    marginTop: 12,
    marginBottom: 8,
  },
  selectorLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  epScroll: {
    gap: 8,
  },
  epChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeEpChip: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderColor: '#e50914',
  },
  epChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  activeEpChipText: {
    color: '#ffffff',
  },
  noticeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  noticeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  noticeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  optionsList: {
    marginTop: 14,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131826',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  optionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  galleryBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  galleryBadgeText: {
    color: '#ff4d6d',
    fontSize: 10,
    fontWeight: '800',
  },
  serverBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serverBadgeText: {
    color: '#00f2fe',
    fontSize: 10,
    fontWeight: '800',
  },
  optionDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  progressCard: {
    backgroundColor: '#131826',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadSpinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  progressPercent: {
    color: '#e50914',
    fontSize: 14,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 3,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressSize: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  cancelText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: '#131826',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  playOfflineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  playOfflineText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
});
