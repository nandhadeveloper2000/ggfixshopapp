import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authApi, ticketApi } from '../../api/client';
import { uploadMedia } from '../../api/masterData';
import { selectShopId } from '../../store/authSlice';
import { confirm, notify } from '../../components/confirm';

const ROLES = ['Technician', 'Staff', 'Pickup Person'];
const SALARY_PERIODS = ['Monthly', 'Weekly'];

export default function OwnerEmployeeDetailScreen({ route, navigation }) {
  const shopId = useSelector(selectShopId);
  const employee = route.params?.employee;
  const mode = route.params?.mode || (employee ? 'view' : 'add');
  const isAdd = mode === 'add';
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (isEdit) navigation.setOptions?.({ title: 'Edit Profile' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (!isEdit || !employee?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const fresh = await ticketApi.get(`/technicians/${employee.id}`);
        if (cancelled || !fresh) return;
        setForm((p) => ({
          ...p,
          name: fresh.name ?? p.name,
          phone: fresh.phone ?? p.phone,
          email: fresh.email ?? p.email,
          roleLabel: fresh.roleLabel ?? p.roleLabel,
          salaryAmount: fresh.salaryAmount ?? p.salaryAmount,
          salaryPeriod: fresh.salaryPeriod ?? p.salaryPeriod,
          dateOfBirth: fresh.dateOfBirth ?? p.dateOfBirth,
          dateOfJoin: fresh.dateOfJoin ?? p.dateOfJoin,
          defaultCheckIn: fresh.defaultCheckIn ?? p.defaultCheckIn,
          defaultCheckOut: fresh.defaultCheckOut ?? p.defaultCheckOut,
          photoUrl: fresh.photoUrl ?? p.photoUrl,
          dailyWage: fresh.dailyWage ?? p.dailyWage,
          aadharNumber: fresh.aadharNumber ?? p.aadharNumber,
          aadharFrontUrl: fresh.aadharFrontUrl ?? p.aadharFrontUrl,
          aadharBackUrl: fresh.aadharBackUrl ?? p.aadharBackUrl,
          panNumber: fresh.panNumber ?? p.panNumber,
          panFrontUrl: fresh.panFrontUrl ?? p.panFrontUrl,
          panBackUrl: fresh.panBackUrl ?? p.panBackUrl,
        }));
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, employee?.id]);

  const [active, setActive] = useState(employee?.isAvailable !== false);
  const [saving, setSaving] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    password: '',
    roleLabel: employee?.roleLabel ?? '',
    salaryAmount: employee?.salaryAmount ?? '',
    salaryPeriod: employee?.salaryPeriod ?? 'Monthly',
    dateOfBirth: employee?.dateOfBirth ?? '',
    dateOfJoin: employee?.dateOfJoin ?? '',
    defaultCheckIn: employee?.defaultCheckIn ?? '09:30',
    defaultCheckOut: employee?.defaultCheckOut ?? '18:30',
    photoUrl: employee?.photoUrl ?? '',
    dailyWage: employee?.dailyWage ?? '',
    aadharNumber: employee?.aadharNumber ?? '',
    aadharFrontUrl: employee?.aadharFrontUrl ?? '',
    aadharBackUrl: employee?.aadharBackUrl ?? '',
    panNumber: employee?.panNumber ?? '',
    panFrontUrl: employee?.panFrontUrl ?? '',
    panBackUrl: employee?.panBackUrl ?? '',
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [uploading, setUploading] = useState({});

  const FOLDER_FOR = {
    photoUrl: 'employees',
    aadharFrontUrl: 'employee-ids',
    aadharBackUrl: 'employee-ids',
    panFrontUrl: 'employee-ids',
    panBackUrl: 'employee-ids',
  };

  const pickImage = async (field, fromCamera) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', `Please allow ${fromCamera ? 'camera' : 'photo library'} access to upload an image.`);
        return;
      }
      const opts = {
        quality: 0.7,
        mediaTypes: ['images'],
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      // Show preview immediately, then upload in background and swap in the hosted URL.
      set(field, asset.uri);
      setUploading((p) => ({ ...p, [field]: true }));
      try {
        const hostedUrl = await uploadMedia(asset, FOLDER_FOR[field] || 'employees');
        if (hostedUrl) set(field, hostedUrl);
        else throw new Error('Server returned no URL');
      } catch (uploadErr) {
        set(field, '');
        notify('Upload failed', uploadErr?.message || 'Could not upload image. Please try again.', { preset: 'error', haptic: 'error' });
      } finally {
        setUploading((p) => ({ ...p, [field]: false }));
      }
    } catch (e) {
      notify('Could not pick image', e?.message || 'Please try again.', { preset: 'error' });
    }
  };

  const promptImageSource = (field) => {
    // RN Web's Alert.alert collapses to window.alert and ignores multi-button menus,
    // so the Take Photo / Choose from Library sheet never fires the picker on web.
    // Go straight to the library picker on web; show the action sheet on native.
    if (Platform.OS === 'web') {
      pickImage(field, false);
      return;
    }
    Alert.alert('Add image', '', [
      { text: 'Take Photo', onPress: () => pickImage(field, true) },
      { text: 'Choose from Library', onPress: () => pickImage(field, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSaveNew = async () => {
    if (!form.name?.trim()) {
      notify('Required', 'Enter employee name');
      return;
    }
    const withLogin = form.email?.trim() && form.password?.trim();
    if (withLogin && form.password.length < 4) {
      notify('Validation', 'Password must be at least 4 characters');
      return;
    }
    setSaving(true);
    try {
      let userId = null;
      if (withLogin) {
        if (!shopId) {
          notify('Error', 'Session expired. Please log in again.', { preset: 'error', haptic: 'error' });
          setSaving(false);
          return;
        }
        try {
          const authRes = await authApi.post(`/auth/shops/${shopId}/technicians`, {
            body: {
              email: form.email.trim(),
              password: form.password,
              name: form.name.trim(),
              roleLabel: (form.roleLabel && form.roleLabel.trim()) || null,
            },
          });
          userId = authRes?.userId;
        } catch (authErr) {
          const msg = authErr?.message || authErr?.payload?.message || '';
          const isShopNotFound = msg.includes('Shop not found') || (authErr?.status === 400 && String(msg).toLowerCase().includes('shop'));
          if (isShopNotFound) {
            const ok = await confirm({
              title: 'Shop not found',
              message: 'Your session may be from another server or the shop was reset. You can add this employee without app login now, or log out and log in again to fix the session.',
              confirmText: 'Add without login',
              cancelText: 'Cancel',
            });
            if (!ok) {
              setSaving(false);
            } else {
              setSaving(true);
              await doCreateEmployee(null);
            }
            return;
          }
          throw authErr;
        }
      }
      await doCreateEmployee(userId);
    } catch (e) {
      notify('Error', e.message || 'Failed to add employee', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const doCreateEmployee = async (userId) => {
    try {
      // If any image upload is still in progress, block save and ask the user to wait.
      if (Object.values(uploading).some(Boolean)) {
        notify('Please wait', 'An image is still uploading.');
        setSaving(false);
        return;
      }
      const photoUrl = form.photoUrl;

      const withLogin = !!userId;
      const body = {
        name: form.name.trim(),
        phone: (form.phone && form.phone.trim()) || null,
        email: (form.email && form.email.trim()) || null,
        roleLabel: (form.roleLabel && form.roleLabel.trim()) || null,
        salaryAmount: (form.salaryAmount && form.salaryAmount.trim()) || null,
        salaryPeriod: (form.salaryPeriod && form.salaryPeriod.trim()) || null,
        dateOfBirth: (form.dateOfBirth && form.dateOfBirth.trim()) || null,
        dateOfJoin: (form.dateOfJoin && form.dateOfJoin.trim()) || null,
        defaultCheckIn: (form.defaultCheckIn && form.defaultCheckIn.trim()) || null,
        defaultCheckOut: (form.defaultCheckOut && form.defaultCheckOut.trim()) || null,
        photoUrl: (photoUrl && photoUrl.trim()) || null,
        dailyWage: (form.dailyWage && String(form.dailyWage).trim()) || null,
        aadharNumber: (form.aadharNumber && form.aadharNumber.trim()) || null,
        aadharFrontUrl: (form.aadharFrontUrl && form.aadharFrontUrl.trim()) || null,
        aadharBackUrl: (form.aadharBackUrl && form.aadharBackUrl.trim()) || null,
        panNumber: (form.panNumber && form.panNumber.trim().toUpperCase()) || null,
        panFrontUrl: (form.panFrontUrl && form.panFrontUrl.trim()) || null,
        panBackUrl: (form.panBackUrl && form.panBackUrl.trim()) || null,
      };
      if (userId) body.userId = userId;
      const created = await ticketApi.post('/technicians', {
        body,
      });
      setSaving(false);
      const message = withLogin
        ? 'Employee added. They can log in with email and password.'
        : 'Employee added.';
      requestAnimationFrame(() => {
        navigation.navigate('OwnerEmployeeCreated', {
          employee: created || { name: form.name.trim(), roleLabel: form.roleLabel },
          message,
        });
      });
    } catch (e) {
      notify('Error', e.message || 'Failed to add employee', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!employee?.id) return;
    if (!form.name?.trim()) {
      notify('Required', 'Enter employee name');
      return;
    }
    if (Object.values(uploading).some(Boolean)) {
      notify('Please wait', 'An image is still uploading.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: (form.phone && form.phone.trim()) || null,
        email: (form.email && form.email.trim()) || null,
        roleLabel: (form.roleLabel && form.roleLabel.trim()) || null,
        salaryAmount: (form.salaryAmount && String(form.salaryAmount).trim()) || null,
        salaryPeriod: (form.salaryPeriod && form.salaryPeriod.trim()) || null,
        dateOfBirth: (form.dateOfBirth && form.dateOfBirth.trim()) || null,
        dateOfJoin: (form.dateOfJoin && form.dateOfJoin.trim()) || null,
        defaultCheckIn: (form.defaultCheckIn && form.defaultCheckIn.trim()) || null,
        defaultCheckOut: (form.defaultCheckOut && form.defaultCheckOut.trim()) || null,
        photoUrl: (form.photoUrl && form.photoUrl.trim()) || null,
        dailyWage: (form.dailyWage && String(form.dailyWage).trim()) || null,
        aadharNumber: (form.aadharNumber && form.aadharNumber.trim()) || null,
        aadharFrontUrl: (form.aadharFrontUrl && form.aadharFrontUrl.trim()) || null,
        aadharBackUrl: (form.aadharBackUrl && form.aadharBackUrl.trim()) || null,
        panNumber: (form.panNumber && form.panNumber.trim().toUpperCase()) || null,
        panFrontUrl: (form.panFrontUrl && form.panFrontUrl.trim()) || null,
        panBackUrl: (form.panBackUrl && form.panBackUrl.trim()) || null,
      };
      await ticketApi.patch(`/technicians/${employee.id}`, { body });
      notify('Saved', 'Profile updated.', { preset: 'done' });
      navigation.goBack();
    } catch (e) {
      notify('Error', e.message || 'Failed to update employee', { preset: 'error', haptic: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (value) => {
    if (!employee?.id) return;
    setActive(value);
    try {
      await ticketApi.patch(`/technicians/${employee.id}`, {
        body: { isAvailable: value },
      });
    } catch (e) {
      setActive(!value);
      notify('Error', e.message || 'Failed to update', { preset: 'error', haptic: 'error' });
    }
  };

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const loadProfileData = useCallback(async () => {
    if (!employee?.id) return;
    try {
      const now = new Date();
      const [att, adv, leaves] = await Promise.all([
        ticketApi.get(`/technicians/${employee.id}/attendance`, { query: { month: now.getMonth() + 1, year: now.getFullYear() } }).catch(() => null),
        ticketApi.get(`/technicians/${employee.id}/advances`).catch(() => []),
        ticketApi.get(`/technicians/${employee.id}/leaves`, { query: { month: now.getMonth() + 1, year: now.getFullYear() } }).catch(() => []),
      ]);
      setAttendanceSummary(att || null);
      setAdvances(Array.isArray(adv) ? adv : []);
      setRecentLeaves(Array.isArray(leaves) ? leaves : []);
    } catch (_) {}
  }, [employee?.id]);
  useEffect(() => {
    if (employee?.id && !isAdd) loadProfileData();
  }, [employee?.id, isAdd, loadProfileData]);
  useFocusEffect(useCallback(() => {
    if (employee?.id && !isAdd) loadProfileData();
  }, [employee?.id, isAdd, loadProfileData]));

  const formatTime = (t) => (t ? (typeof t === 'string' ? t.slice(0, 5) : t) : '—');
  const empId = employee?.id ? `EM-${String(employee.id).slice(0, 8).toUpperCase()}` : '—';
  const recentAdvance = advances[0];
  const recentLeave = recentLeaves[0];
  const formatAdvanceDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const formatLeaveDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  if (isAdd || isEdit) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.addContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Basic Information */}
            <View style={styles.addCard}>
              <View style={styles.addSectionHeader}>
                <Ionicons name="person-circle-outline" size={16} color="#3B4FD7" />
                <Text style={styles.addSectionTitle}>Basic Information</Text>
              </View>

              <View style={styles.addTwoCol}>
                <View style={styles.addColMain}>
                  <Text style={styles.addLabel}>
                    Employee Name <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.addInput}
                    placeholder="Enter name"
                    placeholderTextColor="#9CA3AF"
                    value={form.name}
                    onChangeText={(v) => set('name', v)}
                  />
                  <Text style={styles.addLabel}>Employee Email</Text>
                  <TextInput
                    style={styles.addInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#9CA3AF"
                    value={form.email}
                    onChangeText={(v) => set('email', v)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.addColPhoto}>
                  <Text style={styles.addLabel}>
                    Photo <Text style={styles.req}>*</Text>
                  </Text>
                  <View style={styles.photoBox}>
                    {form.photoUrl ? (
                      <Image source={{ uri: form.photoUrl }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoAvatar}>
                        <Ionicons name="person" size={26} color="#9CA3AF" />
                      </View>
                    )}
                    {uploading.photoUrl && (
                      <View style={styles.photoUploadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.takePhotoBtnSm}
                      activeOpacity={0.85}
                      onPress={() => promptImageSource('photoUrl')}
                      disabled={!!uploading.photoUrl}
                    >
                      <Ionicons name="camera" size={11} color="#FFFFFF" />
                      <Text style={styles.takePhotoTextSm}>
                        {uploading.photoUrl ? 'Uploading…' : form.photoUrl ? 'Change' : 'Take Photo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.addLabel}>
                Mobile Number <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={styles.addInput}
                placeholder="Enter mobile number"
                placeholderTextColor="#9CA3AF"
                value={form.phone}
                onChangeText={(v) => set('phone', v)}
                keyboardType="phone-pad"
              />

              <Text style={styles.addLabel}>
                Employee Role <Text style={styles.req}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.addInputRow, roleOpen && styles.addInputRowOpen]}
                onPress={() => setRoleOpen((o) => !o)}
                activeOpacity={0.7}
              >
                <Text style={styles.addInputRowText}>{form.roleLabel || 'Select role'}</Text>
                <Ionicons
                  name={roleOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#6B7280"
                />
              </TouchableOpacity>
              {roleOpen && (
                <View style={styles.roleDropdown}>
                  {ROLES.map((r, i) => {
                    const selected = form.roleLabel === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.roleOption,
                          i < ROLES.length - 1 && styles.roleOptionDivider,
                          selected && styles.roleOptionSelected,
                        ]}
                        onPress={() => {
                          set('roleLabel', r);
                          setRoleOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            selected && styles.roleOptionTextSelected,
                          ]}
                        >
                          {r}
                        </Text>
                        {selected && (
                          <Ionicons name="checkmark" size={16} color="#3B4FD7" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Dates + Shift */}
            <View style={styles.addCard}>
              <View style={styles.addRow}>
                <View style={styles.addRowItem}>
                  <Text style={styles.addLabel}>Date of Birth</Text>
                  <View style={styles.addInputRow}>
                    <Ionicons name="calendar-outline" size={13} color="#3B4FD7" />
                    <TextInput
                      style={styles.addInputInline}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                      value={form.dateOfBirth}
                      onChangeText={(v) => set('dateOfBirth', v)}
                    />
                  </View>
                </View>
                <View style={styles.addRowItem}>
                  <Text style={styles.addLabel}>Date of Join</Text>
                  <View style={styles.addInputRow}>
                    <Ionicons name="calendar-outline" size={13} color="#3B4FD7" />
                    <TextInput
                      style={styles.addInputInline}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                      value={form.dateOfJoin}
                      onChangeText={(v) => set('dateOfJoin', v)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.addRow}>
                <View style={styles.addRowItem}>
                  <Text style={styles.addLabel}>Check In</Text>
                  <View style={styles.addInputRow}>
                    <Ionicons name="time-outline" size={13} color="#22C55E" />
                    <TextInput
                      style={styles.addInputInline}
                      placeholder="09:30"
                      placeholderTextColor="#9CA3AF"
                      value={form.defaultCheckIn}
                      onChangeText={(v) => set('defaultCheckIn', v)}
                    />
                  </View>
                </View>
                <View style={styles.addRowItem}>
                  <Text style={styles.addLabel}>Check Out</Text>
                  <View style={styles.addInputRow}>
                    <Ionicons name="time-outline" size={13} color="#DC2626" />
                    <TextInput
                      style={styles.addInputInline}
                      placeholder="18:30"
                      placeholderTextColor="#9CA3AF"
                      value={form.defaultCheckOut}
                      onChangeText={(v) => set('defaultCheckOut', v)}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* ID Verification */}
            <View style={styles.addCard}>
              <View style={styles.addSectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#3B4FD7" />
                <Text style={styles.addSectionTitle}>ID Verification</Text>
              </View>

              {[
                {
                  label: 'Aadhar Card',
                  numberField: 'aadharNumber',
                  frontField: 'aadharFrontUrl',
                  backField: 'aadharBackUrl',
                  placeholder: 'Aadhar number (optional)',
                  keyboardType: 'number-pad',
                  maxLength: 12,
                },
                {
                  label: 'PAN Card',
                  numberField: 'panNumber',
                  frontField: 'panFrontUrl',
                  backField: 'panBackUrl',
                  placeholder: 'PAN number (optional)',
                  keyboardType: 'default',
                  maxLength: 10,
                },
              ].map((doc) => (
                <View key={doc.label} style={styles.idDocBlock}>
                  <Text style={styles.idDocLabel}>{doc.label}</Text>
                  <View style={styles.idUploadRow}>
                    <TouchableOpacity
                      style={styles.idUploadTile}
                      activeOpacity={0.85}
                      onPress={() => promptImageSource(doc.frontField)}
                      disabled={!!uploading[doc.frontField]}
                    >
                      {form[doc.frontField] ? (
                        <>
                          <Image
                            source={{ uri: form[doc.frontField] }}
                            style={styles.idUploadPreview}
                          />
                          <View style={styles.idUploadBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={20} color="#9CA3AF" />
                          <Text style={styles.idUploadText}>Upload Front</Text>
                        </>
                      )}
                      {uploading[doc.frontField] && (
                        <View style={styles.idUploadingOverlay}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.idUploadingText}>Uploading…</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.idUploadTile}
                      activeOpacity={0.85}
                      onPress={() => promptImageSource(doc.backField)}
                      disabled={!!uploading[doc.backField]}
                    >
                      {form[doc.backField] ? (
                        <>
                          <Image
                            source={{ uri: form[doc.backField] }}
                            style={styles.idUploadPreview}
                          />
                          <View style={styles.idUploadBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={20} color="#9CA3AF" />
                          <Text style={styles.idUploadText}>Upload Back</Text>
                        </>
                      )}
                      {uploading[doc.backField] && (
                        <View style={styles.idUploadingOverlay}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.idUploadingText}>Uploading…</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  {(form[doc.frontField] || form[doc.backField]) && (
                    <View style={styles.idUploadedRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                      <Text style={styles.idUploadedText}>
                        {doc.label} uploaded successfully
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          set(doc.frontField, '');
                          set(doc.backField, '');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TextInput
                    style={[styles.addInput, { marginTop: 4 }]}
                    placeholder={doc.placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={form[doc.numberField]}
                    onChangeText={(v) => set(doc.numberField, v)}
                    keyboardType={doc.keyboardType}
                    maxLength={doc.maxLength}
                    autoCapitalize={doc.label === 'PAN Card' ? 'characters' : 'none'}
                  />
                </View>
              ))}
            </View>

            {/* Salary Package */}
            <View style={styles.addCard}>
              <View style={styles.addSectionHeader}>
                <Ionicons name="cash-outline" size={16} color="#3B4FD7" />
                <Text style={styles.addSectionTitle}>Salary Package</Text>
              </View>

              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>1. Monthly Salary</Text>
                <View style={styles.salaryInputWrap}>
                  <Text style={styles.salaryCurrency}>₹</Text>
                  <TextInput
                    style={styles.salaryInput}
                    placeholder="Enter amount"
                    placeholderTextColor="#C7CDDB"
                    value={form.salaryAmount}
                    onChangeText={(v) => {
                      set('salaryAmount', v);
                      set('salaryPeriod', 'Monthly');
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>2. Daily Wage</Text>
                <View style={styles.salaryInputWrap}>
                  <Text style={styles.salaryCurrency}>₹</Text>
                  <TextInput
                    style={styles.salaryInput}
                    placeholder="Enter amount"
                    placeholderTextColor="#C7CDDB"
                    value={form.dailyWage}
                    onChangeText={(v) => set('dailyWage', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* App Login (optional) */}
            <View style={styles.addCard}>
              <View style={styles.addSectionHeader}>
                <Ionicons name="lock-closed-outline" size={16} color="#3B4FD7" />
                <Text style={styles.addSectionTitle}>App Login (optional)</Text>
              </View>
              <Text style={styles.addLabel}>Password</Text>
              <TextInput
                style={styles.addInput}
                placeholder="Min 4 characters"
                placeholderTextColor="#9CA3AF"
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secureTextEntry
              />
              <View style={styles.otpHint}>
                <Ionicons name="information-circle-outline" size={13} color="#3B4FD7" />
                <Text style={styles.otpHintText}>
                  Employee can sign in with email or mobile + password, or with mobile + OTP (default
                  OTP: 123456).
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky footer */}
          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.footerCancel}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.footerCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerCreate, saving && styles.saveBtnDisabled]}
              onPress={isEdit ? handleSaveEdit : handleSaveNew}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.footerCreateText}>
                    {isEdit ? 'Save Changes' : 'Create Employee'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.error}>Employee not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const presentDays = attendanceSummary?.presentDays ?? 0;
  const presentPct = Math.max(0, Math.min(1, presentDays / daysInMonth));

  // Role-gated reports:
  //   Technician    → Task Report (repair-booking tasks)
  //   Pickup Person → Pickup Report (pickup assignments)
  //   Employee      → neither
  const role = (employee?.roleLabel || '').trim().toLowerCase();
  const showTaskReport = role === 'technician';
  const showPickupReport = role === 'pickup person';
  const CATEGORIES = [
    { key: 'shift',    icon: 'time-outline',      label: 'Daily Shift\nSchedule', route: 'OwnerEmployeeShiftDetails' },
    { key: 'monthly',  icon: 'calendar-outline',  label: 'Monthly\nSummary',      route: 'OwnerEmployeeAttendance' },
    { key: 'leave',    icon: 'briefcase-outline', label: 'Leave\nReport',         route: 'OwnerEmployeeLeave' },
    ...(showTaskReport
      ? [{ key: 'task',   icon: 'laptop-outline', label: 'Task\nReport',          route: 'OwnerEmployeeWorkingRecord' }]
      : []),
    ...(showPickupReport
      ? [{ key: 'pickup', icon: 'car-outline',    label: 'Pickup\nReport',        route: 'OwnerEmployeePickupReport' }]
      : []),
    { key: 'salary',   icon: 'receipt-outline',   label: 'Salary\nReport',        route: 'OwnerEmployeeSalaryReport' },
    { key: 'edit',     icon: 'create-outline',    label: 'Edit\nProfile',         route: 'OwnerEmployeeDetail', params: { employee, mode: 'edit' } },
  ];

  const confirmToggleActive = async () => {
    const ok = await confirm({
      title: active ? 'Mark as Inactive?' : 'Mark as Active?',
      message: active
        ? 'Employee will not be available for new assignments.'
        : 'Employee will be available for assignments.',
      confirmText: active ? 'Mark Inactive' : 'Mark Active',
      destructive: !!active,
    });
    if (ok) handleToggleActive(!active);
  };

  const advanceStatus = (recentAdvance?.status || '').toUpperCase();
  const isPaid = advanceStatus === 'PAID';
  const leaveStatus = (recentLeave?.status || '').toUpperCase();
  const isApproved = leaveStatus === 'APPROVED';
  const isRejected = leaveStatus === 'REJECTED';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.viewContent}>
        {/* Hero header */}
        <View style={styles.heroCard}>
          <TouchableOpacity style={styles.heroStatus} onPress={confirmToggleActive} activeOpacity={0.7}>
            <Text style={styles.heroStatusLabel}>Status: </Text>
            <Text style={[styles.heroStatusValue, active ? styles.statusOk : styles.statusOff]}>
              {active ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
          <View style={styles.heroAvatarWrap}>
            {employee.photoUrl ? (
              <Image source={{ uri: employee.photoUrl }} style={styles.heroAvatar} />
            ) : (
              <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                <Ionicons name="person" size={36} color="#9CA3AF" />
              </View>
            )}
          </View>
          <Text style={styles.heroName}>{employee.name}</Text>
          <Text style={styles.heroId}>ID: {empId}</Text>
        </View>

        {/* Check-in / Check-out */}
        <View style={styles.viewCheckRow}>
          <View style={[styles.viewCheckCard, styles.viewCheckCardLeft]}>
            <Ionicons name="partly-sunny" size={28} color="#FACC15" />
            <View style={styles.viewCheckTextWrap}>
              <Text style={styles.viewCheckLabel}>CHECK IN</Text>
              <Text style={[styles.viewCheckTime, { color: '#15803D' }]}>
                {formatTime(employee.defaultCheckIn) || '—'}
              </Text>
            </View>
          </View>
          <View style={[styles.viewCheckCard, styles.viewCheckCardRight]}>
            <Ionicons name="cloudy-night" size={28} color="#F97316" />
            <View style={styles.viewCheckTextWrap}>
              <Text style={styles.viewCheckLabel}>CHECK OUT</Text>
              <Text style={[styles.viewCheckTime, { color: '#DC2626' }]}>
                {formatTime(employee.defaultCheckOut) || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Categories grid */}
        <Text style={styles.viewSectionHeader}>Categories</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={styles.catItem}
              onPress={() => navigation.push(c.route, c.params || { employee })}
              activeOpacity={0.8}
            >
              <View style={styles.catIconWrap}>
                <Ionicons name={c.icon} size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.catLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* This Month */}
        <View style={styles.monthCard}>
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>This Month</Text>
            <View style={styles.monthPill}>
              <Ionicons name="calendar-outline" size={13} color="#3B4FD7" />
              <Text style={styles.monthPillText}>{monthLabel}</Text>
              <Ionicons name="chevron-down" size={12} color="#3B4FD7" />
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${presentPct * 100}%` }]} />
          </View>
          <View style={styles.progressLegend}>
            <Text style={styles.progressLegendOn}>{presentDays} Present</Text>
            <Text style={styles.progressLegendOff}>{presentDays}/{daysInMonth}</Text>
          </View>

          <View style={styles.statTilesRow}>
            <View style={[styles.statTile, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={16} color="#3B4FD7" />
              <Text style={styles.statTileValue}>{presentDays}</Text>
              <Text style={styles.statTileLabel}>Present</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="briefcase-outline" size={16} color="#F97316" />
              <Text style={styles.statTileValue}>{String(attendanceSummary?.leaveDays ?? 0).padStart(2, '0')}</Text>
              <Text style={styles.statTileLabel}>Leave</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={16} color="#3B4FD7" />
              <Text style={styles.statTileValue}>{String(attendanceSummary?.permissionCount ?? 0).padStart(2, '0')}</Text>
              <Text style={styles.statTileLabel}>Permission</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="time-outline" size={16} color="#3B4FD7" />
              <Text style={styles.statTileValue}>{attendanceSummary?.lateHours ?? '0'}</Text>
              <Text style={styles.statTileLabel}>Late Hrs</Text>
            </View>
          </View>
        </View>

        {/* Recent Salary Advance */}
        <View style={styles.recentHeaderRow}>
          <Text style={styles.viewSectionHeader}>Recent Salary Advance</Text>
          <TouchableOpacity onPress={() => navigation.navigate('OwnerEmployeeAddAdvance', { employee })}>
            <Text style={styles.recentAddLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {recentAdvance ? (
          <View style={styles.recentItemCard}>
            <View style={styles.recentAccent} />
            <View style={styles.recentInner}>
              <View style={styles.recentTopRow}>
                <Text style={styles.recentDate}>{formatAdvanceDate(recentAdvance.advanceDate)}</Text>
                <View style={styles.statusPillRow}>
                  <View style={[styles.statusPill, isPaid ? styles.statusPillOn : styles.statusPillDimGreen]}>
                    <Text style={[styles.statusPillText, isPaid ? styles.statusPillTextOn : styles.statusPillTextDim]}>
                      Paid
                    </Text>
                  </View>
                  <View style={[styles.statusPill, !isPaid ? styles.statusPillOnRed : styles.statusPillDimRed]}>
                    <Text style={[styles.statusPillText, !isPaid ? styles.statusPillTextOn : styles.statusPillTextDim]}>
                      Not Paid
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.recentBottomRow}>
                <View style={styles.recentBottomCol}>
                  <Text style={styles.recentBigValue}>₹ {recentAdvance.amount ?? 0}</Text>
                  <Text style={styles.recentSubLabel}>Advance Amount</Text>
                </View>
                <View style={styles.recentBottomCol}>
                  <Text style={styles.recentBigValue}>
                    {recentAdvance.requestedAt
                      ? new Date(recentAdvance.requestedAt).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : '—'}
                  </Text>
                  <Text style={styles.recentSubLabel}>Request Date &amp; Time</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No advances</Text>
        )}

        {/* Recent Leave Request */}
        <Text style={styles.viewSectionHeader}>Recent Leave Request</Text>
        {recentLeave ? (
          <View style={styles.recentItemCard}>
            <View style={styles.recentAccent} />
            <View style={styles.recentInner}>
              <View style={styles.recentTopRow}>
                <Text style={styles.recentDate}>{formatLeaveDate(recentLeave.startDate)}</Text>
                <View style={styles.statusPillRow}>
                  <View style={[styles.statusPill, isApproved ? styles.statusPillOn : styles.statusPillDimGreen]}>
                    <Text style={[styles.statusPillText, isApproved ? styles.statusPillTextOn : styles.statusPillTextDim]}>
                      Approved
                    </Text>
                  </View>
                  <View style={[styles.statusPill, isRejected ? styles.statusPillOnRed : styles.statusPillDimRed]}>
                    <Text style={[styles.statusPillText, isRejected ? styles.statusPillTextOn : styles.statusPillTextDim]}>
                      Rejected
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.recentBottomRow}>
                <View style={styles.recentBottomCol}>
                  <Text style={styles.recentBigValue}>{recentLeave.reason || 'Leave'}</Text>
                  <Text style={styles.recentSubLabel}>Leave Reason</Text>
                </View>
                <View style={styles.recentBottomCol}>
                  <Text style={styles.recentBigValue}>{recentLeave.appliedDaysLabel || '—'}</Text>
                  <Text style={styles.recentSubLabel}>Applied Days</Text>
                </View>
                <View style={styles.recentBottomCol}>
                  <Text style={styles.recentBigValue}>
                    {recentLeave.requestedAt
                      ? new Date(recentLeave.requestedAt).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : '—'}
                  </Text>
                  <Text style={styles.recentSubLabel}>Request Date &amp; Time</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No leave requests</Text>
        )}

        {/* Compact contact footer */}
        <View style={styles.viewFooterCard}>
          <View style={styles.footerRow}>
            <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
            <Text style={styles.footerText}>{employee.roleLabel || 'Technician'}</Text>
          </View>
          <View style={styles.footerRow}>
            <Ionicons name="call-outline" size={14} color="#6B7280" />
            <Text style={styles.footerText}>{employee.phone || '—'}</Text>
          </View>
          <View style={styles.footerRow}>
            <Ionicons name="mail-outline" size={14} color="#6B7280" />
            <Text style={styles.footerText}>{employee.email || '—'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E5ECFF' },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addLinkText: { fontSize: 14, color: '#3B4FD7', fontWeight: '600' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  roleChipActive: { backgroundColor: '#3B4FD7', borderColor: '#3B4FD7' },
  roleChipText: { fontSize: 12, color: '#6B7280' },
  roleChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: '#22C55E',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 13, color: '#4B5563', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  linkText: { fontSize: 15, color: '#111827', flex: 1 },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E5E7EB', marginBottom: 8 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  profileId: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CA3AF' },
  statusDotActive: { backgroundColor: '#22C55E' },
  statusBadgeText: { fontSize: 13, color: '#6B7280' },
  statusBadgeTextActive: { color: '#22C55E', fontWeight: '600' },
  checkInOutRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  checkCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, alignItems: 'center' },
  checkLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  checkTime: { fontSize: 16, fontWeight: '700', color: '#22C55E' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  miniStat: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10, alignItems: 'center' },
  miniStatValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  miniStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  recentCard: { marginTop: 8 },
  recentMeta: { fontSize: 13, color: '#374151', marginTop: 4 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEE2E2' },
  tagPaid: { backgroundColor: '#DCFCE7' },
  tagRejected: { backgroundColor: '#FEE2E2' },
  tagText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  photoPlaceholder: { alignItems: 'center', paddingVertical: 12, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 8 },
  takePhotoBtn: { marginTop: 8, backgroundColor: '#22C55E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  takePhotoText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  error: { fontSize: 14, color: '#DC2626' },

  // Compact add-mode styles
  addContent: { padding: 12, paddingBottom: 96 },
  addCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  addSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  addSectionTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  addLabel: { fontSize: 11, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 4 },
  req: { color: '#DC2626' },
  addInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  addInputRowText: { flex: 1, fontSize: 13, color: '#111827' },
  addInputInline: { flex: 1, fontSize: 13, color: '#111827', padding: 0 },
  addInputRowOpen: {
    borderColor: '#111827',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  roleDropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#111827',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  roleOptionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F4',
  },
  roleOptionSelected: { backgroundColor: '#EEF2FF' },
  roleOptionText: { fontSize: 13, color: '#111827' },
  roleOptionTextSelected: { color: '#3B4FD7', fontWeight: '700' },

  addTwoCol: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  addColMain: { flex: 1 },
  addColPhoto: { width: 108 },
  photoBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 6,
  },
  photoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E5E7EB' },
  photoUploadingOverlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 30,
    marginHorizontal: 24,
  },
  takePhotoBtnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  takePhotoTextSm: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  addRow: { flexDirection: 'row', gap: 10 },
  addRowItem: { flex: 1 },

  idDocBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F1F4',
  },
  idDocLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  idUploadRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  idUploadTile: {
    flex: 1,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  idUploadText: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  idUploadPreview: { ...StyleSheet.absoluteFillObject, borderRadius: 8 },
  idUploadBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },
  idUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
  },
  idUploadingText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  idUploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  idUploadedText: { flex: 1, fontSize: 11, color: '#15803D', fontWeight: '600' },

  otpHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  otpHintText: { flex: 1, fontSize: 11, color: '#3B4FD7', lineHeight: 15 },

  salaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  salaryLabel: { fontSize: 12, color: '#374151', fontWeight: '500', flexShrink: 0 },
  salaryInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    minWidth: 0,
  },
  salaryCurrency: { fontSize: 13, color: '#6B7280', marginRight: 4 },
  salaryInput: { flex: 1, fontSize: 13, color: '#111827', padding: 0, minWidth: 0 },

  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  footerCancelText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  footerCreate: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  footerCreateText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // ===== View-mode (mockup-matching) =====
  viewContent: { padding: 12, paddingBottom: 24 },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingTop: 14,
    paddingBottom: 14,
    alignItems: 'center',
    position: 'relative',
  },
  heroStatus: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatusLabel: { fontSize: 12, color: '#374151', fontWeight: '600' },
  heroStatusValue: { fontSize: 12, fontWeight: '700' },
  statusOk: { color: '#22C55E' },
  statusOff: { color: '#9CA3AF' },
  heroAvatarWrap: { marginBottom: 8, marginTop: 2 },
  heroAvatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#E5E7EB' },
  heroAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  heroId: { fontSize: 11, color: '#6B7280', marginTop: 2, letterSpacing: 0.4 },

  viewCheckRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  viewCheckCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  viewCheckCardLeft: {},
  viewCheckCardRight: {},
  viewCheckTextWrap: { flex: 1 },
  viewCheckLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', letterSpacing: 0.5 },
  viewCheckTime: { fontSize: 16, fontWeight: '800', marginTop: 1 },

  viewSectionHeader: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 14, marginBottom: 8 },

  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    rowGap: 12,
  },
  catItem: {
    width: '22%',
    alignItems: 'center',
  },
  catIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catLabel: { fontSize: 10, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 13 },

  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  monthPillText: { fontSize: 11, fontWeight: '700', color: '#3B4FD7' },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#3B4FD7' },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLegendOn: { fontSize: 12, color: '#3B4FD7', fontWeight: '700' },
  progressLegendOff: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

  statTilesRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statTile: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'flex-start',
  },
  statTileValue: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4 },
  statTileLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600', marginTop: 1 },

  recentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentAddLink: { fontSize: 12, color: '#3B4FD7', fontWeight: '700', marginTop: 14 },

  recentItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  recentAccent: { width: 3, backgroundColor: '#7C3AED' },
  recentInner: { flex: 1, padding: 10 },
  recentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentDate: { fontSize: 12, fontWeight: '700', color: '#111827' },
  statusPillRow: { flexDirection: 'row', gap: 6 },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillOn: { backgroundColor: '#22C55E' },
  statusPillOnRed: { backgroundColor: '#EF4444' },
  statusPillDimGreen: { backgroundColor: '#DCFCE7' },
  statusPillDimRed: { backgroundColor: '#FEE2E2' },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  statusPillTextOn: { color: '#FFFFFF' },
  statusPillTextDim: { color: '#9CA3AF' },

  recentBottomRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  recentBottomCol: { flex: 1 },
  recentBigValue: { fontSize: 12, fontWeight: '700', color: '#111827' },
  recentSubLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  emptyText: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingVertical: 16 },

  viewFooterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { fontSize: 12, color: '#374151' },
});
