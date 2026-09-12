import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  if (!updateInfo) return null;

  const handleDownload = () => {
    if (updateInfo.downloadUrl) {
      Linking.openURL(updateInfo.downloadUrl);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="rocket" size={32} color="#00f2fe" />
          </View>

          <Text style={styles.title}>Yangi Yangilanish Chiqdi!</Text>
          <View style={styles.badgeRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>{updateInfo.latestVersion}</Text>
            </View>
            <Text style={styles.currentText}>(Hozirgi: {updateInfo.currentVersion})</Text>
          </View>

          {/* Release Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesHeading}>Yangiliklar va O'zgarishlar:</Text>
            <ScrollView style={styles.notesScroll}>
              <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
            </ScrollView>
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-download-outline" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>Yuklab Olish va O'rnatish</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissBtnText}>Keyinroq</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
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
    marginBottom: 14,
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
    marginBottom: 16,
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
  notesContainer: {
    width: '100%',
    backgroundColor: '#070a12',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notesHeading: {
    color: '#00f2fe',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  notesScroll: {
    maxHeight: 120,
  },
  notesText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
});
