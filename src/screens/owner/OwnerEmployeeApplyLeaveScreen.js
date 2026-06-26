import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { CalendarDays, User, MessageSquare } from 'lucide-react-native';
import {
  AppHeader, Card, Input, FormField, Button, BottomActionBar, ScreenContainer,
  EmptyState, useBottomBarInset,
} from '../../components/rnr';
import { tokens } from '../../theme/colors';
import { ticketApi } from '../../api/client';
import { notify } from '../../components/confirm';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function OwnerEmployeeApplyLeaveScreen({ route, navigation }) {
  const employee = route.params?.employee;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const insetBottom = useBottomBarInset();

  const validate = () => {
    if (!startDate.trim() || !endDate.trim()) {
      notify('Required', 'Enter start and end date (YYYY-MM-DD)');
      return false;
    }
    if (!DATE_RE.test(startDate.trim()) || !DATE_RE.test(endDate.trim())) {
      notify('Invalid format', 'Dates must be in YYYY-MM-DD format');
      return false;
    }
    if (new Date(endDate) < new Date(startDate)) {
      notify('Invalid range', 'End date must be on or after start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !employee?.id) return;
    setSaving(true);
    try {
      await ticketApi.post(`/technicians/${employee.id}/leaves`, {
        body: { startDate: startDate.trim(), endDate: endDate.trim(), reason: reason.trim() || undefined },
      });
      notify('Submitted', 'Leave request submitted', { preset: 'done' });
      navigation.goBack();
    } catch (e) {
      notify('Error', e.message || 'Failed to submit leave', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!employee) {
    return (
      <ScreenContainer>
        <AppHeader title="Apply Leave" onBack={() => navigation.goBack()} />
        <EmptyState title="Employee not found" description="Open this from the employee list." />
      </ScreenContainer>
    );
  }

  const canSubmit = !!startDate.trim() && !!endDate.trim() && !saving;

  return (
    <ScreenContainer>
      <AppHeader title="Apply Leave" subtitle={employee.name || employee.fullName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insetBottom + 96 }}>
        <Card>
          <View className="flex-row items-center">
            <View className="h-11 w-11 rounded-2xl bg-primary-soft items-center justify-center mr-3">
              <User size={20} color={tokens.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-text-muted uppercase tracking-widest">Employee</Text>
              <Text className="text-[15px] font-extrabold text-text" numberOfLines={1}>
                {employee.name || employee.fullName || 'Employee'}
              </Text>
              {employee.role || employee.roleLabel ? (
                <Text className="text-[11px] text-text-muted mt-0.5">
                  {employee.role || employee.roleLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        <View className="h-4" />
        <FormField label="Start date">
          <Input
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-02-01"
            leftIcon={<CalendarDays size={16} color={tokens.textMuted} />}
            autoCapitalize="none"
          />
        </FormField>
        <FormField label="End date">
          <Input
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-02-03"
            leftIcon={<CalendarDays size={16} color={tokens.textMuted} />}
            autoCapitalize="none"
          />
        </FormField>
        <FormField label="Reason (optional)">
          <Input
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Personal work"
            multiline
            numberOfLines={4}
            leftIcon={<MessageSquare size={16} color={tokens.textMuted} />}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </FormField>
      </ScrollView>

      <BottomActionBar
        title={saving ? 'Submitting...' : 'Submit Leave Request'}
        onPress={handleSubmit}
        loading={saving}
        disabled={!canSubmit}
        insetBottom={insetBottom}
      />
    </ScreenContainer>
  );
}
