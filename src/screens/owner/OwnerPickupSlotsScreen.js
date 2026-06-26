import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { confirm, notify } from '../../components/confirm';
import {
  getShopPickupSlots,
  addShopPickupSlot,
  updateShopPickupSlot,
  deleteShopPickupSlot,
} from '../../api/shops';
import { selectShopId } from '../../store/authSlice';

// ISO-8601 day codes — matches the backend ShopPickupSlotRequest convention.
// dayOfWeek=null on existing rows represents the legacy "any day" semantics.
const DAYS = [
  { code: 1, short: 'Mon', long: 'Monday' },
  { code: 2, short: 'Tue', long: 'Tuesday' },
  { code: 3, short: 'Wed', long: 'Wednesday' },
  { code: 4, short: 'Thu', long: 'Thursday' },
  { code: 5, short: 'Fri', long: 'Friday' },
  { code: 6, short: 'Sat', long: 'Saturday' },
  { code: 7, short: 'Sun', long: 'Sunday' },
];

// Display order for the circle picker — Sunday-first (calendar convention).
// Each circle shows a single letter; double 'S'/'T' matches the standard
// abbreviation scheme used in calendar UIs.
const DAY_CIRCLES = [
  { code: 7, letter: 'S' }, // Sun
  { code: 1, letter: 'M' }, // Mon
  { code: 2, letter: 'T' }, // Tue
  { code: 3, letter: 'W' }, // Wed
  { code: 4, letter: 'T' }, // Thu
  { code: 5, letter: 'F' }, // Fri
  { code: 6, letter: 'S' }, // Sat
];

function dayLabel(code) {
  // Older rows may still carry NULL from the previous "Any day" support.
  if (code == null) return 'Any day (legacy)';
  return DAYS.find((d) => d.code === code)?.long ?? `Day ${code}`;
}

// Render the user's current multi-day selection as "Mon to Sat", "All days",
// or "Mon, Wed, Fri". Empty when nothing picked.
function daysSummary(days) {
  if (!days || days.length === 0) return '';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'All days';
  const consecutive = sorted.every((c, i) => i === 0 || c === sorted[i - 1] + 1);
  const dayShort = (c) => DAYS.find((d) => d.code === c)?.short ?? `?`;
  if (consecutive && sorted.length > 1) {
    return `${dayShort(sorted[0])} to ${dayShort(sorted[sorted.length - 1])}`;
  }
  return sorted.map(dayShort).join(', ');
}

// Backend returns "HH:MM:SS"; show the user "HH:MM". Submit also sends "HH:MM".
function normaliseTime(value) {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// Accept "9:5", "09:05", "9:05 am", "5pm" → normalize to 24h "HH:MM". Returns
// null when the input can't be parsed.
function parseTimeInput(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mi = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3];
  if (Number.isNaN(h) || Number.isNaN(mi) || mi < 0 || mi > 59) return null;
  if (ampm === 'AM') { if (h === 12) h = 0; }
  else if (ampm === 'PM') { if (h !== 12) h += 12; }
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

// `days` is an array of ISO codes (1=Mon..7=Sun). Multi-select in both modes.
// `capacity` is the legacy DB column name; the UI surfaces it as pickup-radius
// kilometres so the underlying schema stays untouched.
const EMPTY_FORM = { days: [1], startTime: '', endTime: '', capacity: '20' };

export default function OwnerPickupSlotsScreen({ navigation }) {
  const shopId = useSelector(selectShopId);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    try {
      const list = await getShopPickupSlots(shopId);
      setSlots(Array.isArray(list) ? list : []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setError(''); };

  const startEdit = (slot) => {
    setEditingId(slot.id);
    setForm({
      // Legacy NULL rows have no day; force user to pick one before update.
      days: slot.dayOfWeek != null ? [slot.dayOfWeek] : [],
      startTime: normaliseTime(slot.startTime),
      endTime: normaliseTime(slot.endTime),
      capacity: slot.capacity != null ? String(slot.capacity) : '10',
    });
    setError('');
  };

  const toggleDay = (code) => {
    // Multi-select in both add and edit modes. In edit mode any "extra" days
    // beyond the original turn into new slots on submit (see onSubmit below).
    setForm((f) => {
      const has = f.days.includes(code);
      return { ...f, days: has ? f.days.filter((d) => d !== code) : [...f.days, code] };
    });
  };

  const onSubmit = async () => {
    setError('');
    const start = parseTimeInput(form.startTime);
    const end = parseTimeInput(form.endTime);
    const cap = parseInt(String(form.capacity).replace(/[^0-9]/g, ''), 10);
    if (!form.days || form.days.length === 0) { setError('Pick at least one day.'); return; }
    if (!start) { setError('Enter a valid start time (HH:MM).'); return; }
    if (!end) { setError('Enter a valid end time (HH:MM).'); return; }
    if (start >= end) { setError('Start time must be before end time.'); return; }
    if (!Number.isFinite(cap) || cap < 1) { setError('Distance must be at least 1 km.'); return; }
    if (!shopId) { setError('Session expired. Please log in again.'); return; }

    setSubmitting(true);
    try {
      if (editingId) {
        // Each shop_pickup_slots row has a single day_of_week column, so multi-
        // day edit can't just PUT all days onto one row. Strategy: keep the
        // original row alive (preserves its id) updated to a "primary" day —
        // either the day it already had if still selected, otherwise the
        // first picked day — and then POST extras for the rest.
        const sortedDays = [...form.days].sort((a, b) => a - b);
        const originalSlot = slots.find((s) => s.id === editingId);
        const originalDay = originalSlot?.dayOfWeek;
        const primaryDay = originalDay != null && sortedDays.includes(originalDay)
          ? originalDay
          : sortedDays[0];
        const otherDays = sortedDays.filter((d) => d !== primaryDay);

        await updateShopPickupSlot(shopId, editingId, {
          dayOfWeek: primaryDay, startTime: start, endTime: end, capacity: cap,
        });

        const failed = [];
        for (const code of otherDays) {
          try {
            await addShopPickupSlot(shopId, { dayOfWeek: code, startTime: start, endTime: end, capacity: cap });
          } catch (e) {
            const short = DAYS.find((d) => d.code === code)?.short ?? `Day ${code}`;
            failed.push({ short, msg: e?.payload?.message || e?.message || 'failed' });
          }
        }
        if (failed.length === 0) {
          resetForm();
        } else {
          setError(`Updated, but skipped: ${failed.map((f) => f.short).join(', ')}.`);
        }
        await load();
      } else if (form.days.length === 1) {
        await addShopPickupSlot(shopId, {
          dayOfWeek: form.days[0], startTime: start, endTime: end, capacity: cap,
        });
        resetForm();
        await load();
      } else {
        // Multi-day add: one POST per day. Backend rejects overlaps individually,
        // so collect successes and failures and report both.
        const failed = [];
        let created = 0;
        const sortedDays = [...form.days].sort((a, b) => a - b);
        for (const code of sortedDays) {
          try {
            await addShopPickupSlot(shopId, { dayOfWeek: code, startTime: start, endTime: end, capacity: cap });
            created += 1;
          } catch (e) {
            const short = DAYS.find((d) => d.code === code)?.short ?? `Day ${code}`;
            failed.push({ short, msg: e?.payload?.message || e?.message || 'failed' });
          }
        }
        if (failed.length === 0) {
          resetForm();
        } else {
          setError(`Added ${created} of ${sortedDays.length}. Skipped: ${failed.map((f) => f.short).join(', ')}.`);
        }
        await load();
      }
    } catch (e) {
      setError(e?.payload?.message || e?.message || 'Could not save pickup slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (slot) => {
    const ok = await confirm({
      title: 'Remove slot?',
      message: `Remove ${dayLabel(slot.dayOfWeek)} ${normaliseTime(slot.startTime)}–${normaliseTime(slot.endTime)}?`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(slot.id);
    try {
      await deleteShopPickupSlot(shopId, slot.id);
      if (editingId === slot.id) resetForm();
      await load();
    } catch (e) {
      notify('Failed', e?.payload?.message || e?.message || 'Please try again.', { preset: 'error', haptic: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  if (!shopId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><Text style={styles.errorText}>Please log in again.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {editingId ? 'Edit pickup slot' : 'Add pickup slot'}
          </Text>
          <Text style={styles.cardSub}>
            Define the time window and how many pickups you can handle in it.
          </Text>

          <Text style={styles.label}>Days</Text>
          {daysSummary(form.days) ? (
            <Text style={styles.daysSummary}>{daysSummary(form.days)}</Text>
          ) : null}
          <View style={styles.circleRow}>
            {DAY_CIRCLES.map((d) => {
              const active = form.days.includes(d.code);
              return (
                <TouchableOpacity
                  key={d.code}
                  style={[styles.dayCircle, active && styles.dayCircleActive]}
                  onPress={() => toggleDay(d.code)}
                  activeOpacity={0.8}
                  accessibilityLabel={DAYS.find((x) => x.code === d.code)?.long}
                >
                  <Text style={[styles.dayCircleText, active && styles.dayCircleTextActive]}>{d.letter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {form.days.length > 1 ? (
            <Text style={styles.hint}>
              {editingId
                ? 'Extra days will be added as new slots. Days that overlap an existing slot are skipped.'
                : 'One row will be created per selected day. Days that overlap an existing slot are skipped.'}
            </Text>
          ) : null}

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Start time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={form.startTime}
                onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))}
                placeholder="09:00"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>End time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={form.endTime}
                onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))}
                placeholder="12:00"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Text style={styles.label}>Distance (KM)</Text>
          <TextInput
            style={styles.input}
            value={form.capacity}
            onChangeText={(t) => setForm((f) => ({ ...f, capacity: t }))}
            placeholder="20"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actionRow}>
            {editingId ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name={editingId ? 'save-outline' : 'add-circle-outline'} size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    {editingId
                      ? form.days.length > 1
                        ? `Update + add ${form.days.length - 1}`
                        : 'Update slot'
                      : form.days.length > 1
                        ? `Add slots (${form.days.length})`
                        : 'Add slot'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Hide the saved-slots list while editing — the form already shows
            what's being edited, and surrounding cards just clutter the focus. */}
        {!editingId && <Text style={styles.sectionLabel}>Saved pickup slots</Text>}

        {editingId ? null : loading ? (
          <ActivityIndicator color="#15803D" style={{ marginTop: 20 }} />
        ) : slots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={28} color="#9CA3AF" />
            <Text style={styles.emptyText}>No pickup slots yet. Add one above to get started.</Text>
          </View>
        ) : (
          slots.map((slot) => {
            const beingDeleted = deletingId === slot.id;
            const beingEdited = editingId === slot.id;
            return (
              <View key={slot.id} style={[styles.slotCard, beingEdited && styles.slotCardEditing]}>
                <View style={styles.slotIconWrap}>
                  <Ionicons name="time" size={18} color="#15803D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotDay}>{dayLabel(slot.dayOfWeek)}</Text>
                  <Text style={styles.slotTime}>
                    {normaliseTime(slot.startTime)} – {normaliseTime(slot.endTime)}
                  </Text>
                  <Text style={styles.slotMeta}>
                    Distance: {slot.capacity ?? 10} km
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => startEdit(slot)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  disabled={beingDeleted}
                >
                  <Ionicons name="create-outline" size={18} color="#15803D" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => onDelete(slot)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  disabled={beingDeleted}
                >
                  {beingDeleted ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4FBF6' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  cardSub: { fontSize: 11, color: '#6B7280', marginTop: 2, marginBottom: 10 },

  label: { fontSize: 11, color: '#374151', fontWeight: '700', marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111827',
  },

  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  daysSummary: { fontSize: 13, color: '#15803D', fontWeight: '700', marginTop: 2, marginBottom: 6 },
  circleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: { backgroundColor: '#15803D' },
  dayCircleText: { fontSize: 13, color: '#6B7280', fontWeight: '800' },
  dayCircleTextActive: { color: '#FFFFFF' },

  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  hint: { fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },

  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  slotCardEditing: { borderWidth: 1, borderColor: '#15803D', backgroundColor: '#DCFCE7' },
  slotIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotDay: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  slotTime: { fontSize: 12, color: '#374151', marginTop: 1 },
  slotMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 6 },
});
