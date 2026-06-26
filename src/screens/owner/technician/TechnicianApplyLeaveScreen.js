import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ticketApi } from '../../../api/client';
import { notify } from '../../../components/confirm';

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function TechnicianApplyLeaveScreen({ navigation }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(toISO(today));
  const [endDate, setEndDate] = useState(toISO(today));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!startDate.trim() || !endDate.trim()) {
      notify('Required', 'Start date and end date are required');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      notify('Invalid', 'End date must be on or after start date');
      return;
    }
    setSaving(true);
    try {
      await ticketApi.post('/technicians/me/leaves', {
        body: { startDate, endDate, reason: reason.trim() || null },
      });
      notify('Leave request sent to owner', 'Your leave request has been submitted. The owner will review and approve or deny it.', { preset: 'done' });
      navigation.navigate('TechnicianProfile');
    } catch (e) {
      notify('Error', e?.message ?? 'Failed to submit leave request', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Start date</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9CA3AF"
        />
        <Text style={styles.label}>End date</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9CA3AF"
        />
        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for leave"
          placeholderTextColor="#9CA3AF"
          multiline
        />
        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#202124' },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 14, color: '#9AA0A6', marginBottom: 6 },
  input: { backgroundColor: '#282A2D', borderWidth: 1, borderColor: '#3C4043', borderRadius: 8, padding: 12, fontSize: 16, color: '#F8FAFC', marginBottom: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#22C55E', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
