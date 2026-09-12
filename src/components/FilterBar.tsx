import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface FilterItem {
  label: string;
  value: string;
}

interface FilterBarProps {
  items: FilterItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ items, selectedValue, onSelect }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {items.map((item) => {
        const active = selectedValue === item.value;
        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onSelect(item.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, active && styles.activeChipText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#0f1422',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeChip: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  chipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
