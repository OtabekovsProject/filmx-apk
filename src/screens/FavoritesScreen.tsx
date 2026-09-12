import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MediaCard } from '../components/MediaCard';
import { useApp } from '../context/AppContext';

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { favorites } = useApp();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="heart" size={24} color="#e50914" />
        <Text style={styles.title}>Mening Sevimlilarim</Text>
        <Text style={styles.badge}>{favorites.length}</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="heart-outline" size={48} color="#64748b" />
          </View>
          <Text style={styles.emptyTitle}>Sevimli filmlar yo'q</Text>
          <Text style={styles.emptyDesc}>
            O'zingizga yoqqan kinolar va seriallarni keyinroq ko'rish uchun yurakchani bosing.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => navigation.navigate('CatalogTab')}
            activeOpacity={0.85}
          >
            <Ionicons name="film-outline" size={18} color="#fff" />
            <Text style={styles.exploreBtnText}>Katalogni ko'rish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <MediaCard item={item} variant="grid" />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  badge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    color: '#e50914',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '800',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0f1422',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
