import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MediaCard } from '../components/MediaCard';
import { filterMedia } from '../services/dataService';

const SUGGESTIONS = [
  'Jangari',
  "Taxtlar O'yini",
  'Hindiston',
  'Singam 3',
  'Forsaj',
  'Interstellar',
  "Qonxo'r Itlar",
  'AQSH',
  'Komediya',
  'Triller',
];

export const SearchScreen: React.FC = () => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return filterMedia({ query });
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#e50914" />
        <TextInput
          style={styles.searchInput}
          placeholder="Kino nomi, aktyor yoki janr..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {query.trim().length === 0 ? (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.suggestionsTitle}>🔥 Ommabop qidiruvlar:</Text>
          <View style={styles.chipsWrap}>
            {SUGGESTIONS.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                onPress={() => setQuery(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsText}>
              "{query}" bo'yicha <Text style={{ color: '#fff', fontWeight: '800' }}>{results.length}</Text> ta natija
            </Text>
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <MediaCard item={item} variant="list" />}
            initialNumToRender={10}
            windowSize={5}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1422',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    padding: 0,
  },
  suggestionsWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  suggestionsTitle: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
});
