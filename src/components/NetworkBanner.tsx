import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NetworkBannerProps {
  isOffline: boolean;
  isRestored: boolean;
}

export const NetworkBanner: React.FC<NetworkBannerProps> = ({
  isOffline,
  isRestored,
}) => {
  const insets = useSafeAreaInsets();

  if (!isOffline && !isRestored) return null;

  const isSuccess = isRestored && !isOffline;

  return (
    <View
      style={[
        styles.banner,
        { paddingTop: Math.max(insets.top, 8) },
        isSuccess ? styles.successBanner : styles.offlineBanner,
      ]}
      pointerEvents="none"
    >
      <View style={styles.contentRow}>
        <Ionicons
          name={isSuccess ? "checkmark-circle" : "cloud-offline"}
          size={18}
          color="#ffffff"
        />
        <Text style={styles.text}>
          {isSuccess
            ? "Internet aloqasi tiklandi!"
            : "Internet aloqasi yo'q. Tarmoqni tekshiring."}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  offlineBanner: {
    backgroundColor: '#dc2626',
  },
  successBanner: {
    backgroundColor: '#16a34a',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
