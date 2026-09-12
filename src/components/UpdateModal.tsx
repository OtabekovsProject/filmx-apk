import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { UpdateInfo } from '../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  updateInfo,
  onClose,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState('0');
  const [totalMB, setTotalMB] = useState('0');
  const [installReady, setInstallReady] = useState(false);
  const [localApkUri, setLocalApkUri] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadResumableRef = React.useRef<FileSystem.DownloadResumable | null>(null);

  if (!updateInfo) return null;

  const handleStartInAppUpdate = async () => {
    if (!updateInfo.downloadUrl) return;
    try {
      setIsDownloading(true);
      setDownloadError(null);
      setDownloadProgress(0);
      setInstallReady(false);

      const cleanVer = updateInfo.latestVersion.replace(/^v/i, '');
      const filename = `FilmX-v${cleanVer}.apk`;
      const targetPath = `${FileSystem.cacheDirectory}${filename}`;

      // Check if file already exists
      const existing = await FileSystem.getInfoAsync(targetPath);
      if (existing.exists) {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      }

      downloadResumableRef.current = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        targetPath,
        {},
        (data) => {
          if (data.totalBytesExpectedToWrite > 0) {
            const prog = data.totalBytesWritten / data.totalBytesExpectedToWrite;
            setDownloadProgress(Math.min(1, Math.max(0, prog)));
            setDownloadedMB((data.totalBytesWritten / (1024 * 1024)).toFixed(1));
            setTotalMB((data.totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1));
          }
        }
      );

      const result = await downloadResumableRef.current.downloadAsync();
      if (!result || !result.uri) {
        throw new Error("Yangilanish faylini yuklab bo'lmadi");
      }

      setLocalApkUri(result.uri);
      setIsDownloading(false);
      setInstallReady(true);

      // Trigger Android native package installer
      await triggerInstallation(result.uri);
    } catch (err: any) {
      console.warn('In-app update download error:', err);
      setDownloadError(err.message || 'Yuklab olishda xatolik yuz berdi');
      setIsDownloading(false);
    }
  };

  const triggerInstallation = async (fileUri: string) => {
    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
      } else {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.android.package-archive',
        });
      }
    } catch (error) {
      console.warn('Intent launcher error, trying Sharing fallback:', error);
      try {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.android.package-archive',
          dialogTitle: "FilmX ilovasini o'rnatish",
        });
      } catch (err) {
        if (updateInfo.downloadUrl) {
          Linking.openURL(updateInfo.downloadUrl);
        }
      }
    }
  };

  const handleCancelDownload = async () => {
    try {
      if (downloadResumableRef.current) {
        await downloadResumableRef.current.pauseAsync();
      }
    } catch (e) {}
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  const percentText = `${Math.round(downloadProgress * 100)}%`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={isDownloading ? undefined : onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              installReady && styles.iconCircleSuccess,
              downloadError && styles.iconCircleError,
            ]}
          >
            <Ionicons
              name={
                installReady
                  ? 'checkmark-circle'
                  : downloadError
                  ? 'alert-circle'
                  : isDownloading
                  ? 'cloud-download'
                  : 'rocket'
              }
              size={34}
              color={
                installReady ? '#10b981' : downloadError ? '#ef4444' : '#00f2fe'
              }
            />
          </View>

          <Text style={styles.title}>
            {installReady
              ? "Yangilanish O'rnatishga Tayyor!"
              : isDownloading
              ? 'Ilova Ichida Yuklanmoqda...'
              : 'Yangi Versiya Mavjud!'}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>{updateInfo.latestVersion}</Text>
            </View>
            <Text style={styles.currentText}>
              (Hozirgi: {updateInfo.currentVersion})
            </Text>
          </View>

          {/* Downloading Progress Bar View */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressStatsRow}>
                <Text style={styles.progressPercent}>{percentText}</Text>
                <Text style={styles.progressMb}>
                  {downloadedMB} MB / {totalMB} MB
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(downloadProgress * 100)}%` },
                  ]}
                />
              </View>

              <Text style={styles.progressSubtext}>
                Yangilanish to'g'ridan-to'g'ri ilova ichida yuklanmoqda, kuting...
              </Text>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelDownload}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Bekor qilish</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Install Ready View */}
          {installReady && localApkUri && (
            <View style={styles.readyContainer}>
              <Text style={styles.readyDesc}>
                Yangi versiya to'liq yuklab olindi. Tizim o'rnatish oynasini oching va
                "O'rnatish" tugmasini bosing.
              </Text>
              <TouchableOpacity
                style={styles.installBtn}
                onPress={() => triggerInstallation(localApkUri)}
                activeOpacity={0.85}
              >
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
                <Text style={styles.installBtnText}>O'rnatishni Boshlash</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Normal View (Not downloading and not ready) */}
          {!isDownloading && !installReady && (
            <>
              {/* Permission & In-App Notice */}
              <View style={styles.inAppNoticeBox}>
                <Ionicons name="flash" size={16} color="#00f2fe" />
                <Text style={styles.inAppNoticeText}>
                  Yangilanish ilova ichida avtomatik yuklanadi va brauzerga
                  chiqmasdan o'rnatiladi.
                </Text>
              </View>

              {/* Release Notes */}
              <View style={styles.notesContainer}>
                <Text style={styles.notesHeading}>Yangi Imkoniyatlar:</Text>
                <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
                </ScrollView>
              </View>

              {downloadError && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{downloadError}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={handleStartInAppUpdate}
                  activeOpacity={0.85}
                >
                  <Ionicons name="download" size={20} color="#fff" />
                  <Text style={styles.downloadBtnText}>
                    Ruxsat Berish va Yangilash
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dismissBtnText}>Keyinroq</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f1422',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.4)',
    marginBottom: 12,
  },
  iconCircleSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  iconCircleError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  versionBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  versionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  currentText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  inAppNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    width: '100%',
  },
  inAppNoticeText: {
    flex: 1,
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#070a12',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notesHeading: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  notesScroll: {
    maxHeight: 110,
  },
  notesText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  btnRow: {
    width: '100%',
    gap: 10,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  dismissBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  progressStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  progressPercent: {
    color: '#00f2fe',
    fontSize: 18,
    fontWeight: '900',
  },
  progressMb: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#1e293b',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 5,
  },
  progressSubtext: {
    color: '#cbd5e1',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  readyContainer: {
    width: '100%',
    alignItems: 'center',
  },
  readyDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  installBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
