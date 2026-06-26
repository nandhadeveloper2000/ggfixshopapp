import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OPTIONS = ['None', 'Pattern', 'PIN', 'Password'];

export default function DeviceSecurityScreen({ route, navigation }) {
  const { ticketId } = route.params || {};
  const [selected, setSelected] = useState('PIN');

  const handleContinue = () => {
    navigation.navigate('DeviceInformation', { ticketId });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Device Security</Text>
          <Text style={styles.subtitle}>Screen lock</Text>

          {OPTIONS.map((opt) => {
            const active = selected === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => setSelected(opt)}
              >
                <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                  {active ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.optionLabel}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E5ECFF' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optionRowActive: {
    backgroundColor: '#EEF2FF',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioOuterActive: {
    borderColor: '#4F46E5',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4F46E5',
  },
  optionLabel: { fontSize: 13, color: '#111827' },
  button: {
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});

