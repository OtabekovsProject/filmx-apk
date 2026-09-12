import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const navigation = useNavigation<any>();
  const { favoritesCount } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/favicon.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
        <Text style={styles.brandText}>
          Film<Text style={styles.brandAccent}>X</Text>
        </Text>
        <View style={styles.liveDot} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('FavoritesTab')}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={20} color="#e50914" />
          {favoritesCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{favoritesCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(7, 10, 18, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#e50914',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00f2fe',
    marginLeft: 2,
    marginTop: -8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#e50914',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#070a12',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
