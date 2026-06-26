import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notify } from '../../../components/confirm';

export default function AddRepairNotesScreen({ route, navigation }) {
  const { ticketId } = route.params || {};
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      // POST /tickets/{id}/notes or similar - backend to define
      notify('Note added', 'Backend endpoint for notes to be wired.', { preset: 'done' });
      navigation.goBack();
    } catch (e) {
      notify('Error', e.message || 'Failed', { preset: 'error', haptic: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.label}>Repair note</Text>
      <TextInput style={styles.input} placeholder="Enter note" placeholderTextColor="#80868B" value={note} onChangeText={setNote} multiline numberOfLines={4} />
      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#202124', padding: 16 },
  label: { fontSize: 14, color: '#9AA0A6', marginBottom: 8 },
  input: { backgroundColor: '#282A2D', borderWidth: 1, borderColor: '#3C4043', borderRadius: 8, padding: 12, fontSize: 16, color: '#F8FAFC', minHeight: 100, textAlignVertical: 'top' },
  button: { backgroundColor: '#22C55E', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
