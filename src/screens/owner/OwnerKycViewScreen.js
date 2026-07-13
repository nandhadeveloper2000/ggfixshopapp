import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import {
  ChevronLeft,
  ShieldCheck,
  XCircle,
  Clock,
  FileText,
  Pencil,
  CloudUpload,
  Trash2,
  Upload,
  CheckCircle2,
} from 'lucide-react-native';
import { listShopKycDocuments, deleteShopKycDocument } from '../../api/shops';
import { selectShopId } from '../../store/authSlice';
import { confirm, notify } from '../../components/confirm';

const BRAND_GREEN      = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.10,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
};

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const ORDER = ['aadharFront', 'aadharBack', 'pan', 'gst', 'udyam'];
const TITLES = {
  aadharFront: 'Aadhar Card Front',
  aadharBack:  'Aadhar Card Back',
  pan:         'PAN Card',
  gst:         'GST Certificate',
  udyam:       'Udyam Certificate',
};

function isPdf(url) {
  return typeof url === 'string' && url.toLowerCase().includes('.pdf');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_GRADIENT = {
  APPROVED:       [BRAND_GREEN, BRAND_GREEN_DARK],
  REJECTED:       ['#F87171', '#B91C1C'],
  PENDING_REVIEW: ['#F59E0B', '#B45309'],
  NONE:           ['#94A3B8', '#475569'],
};

export default function OwnerKycViewScreen({ route, navigation }) {
  const shopId = useSelector(selectShopId);
  const fromSubmit = !!route?.params?.fromSubmit;
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingType, setDeletingType] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const list = await listShopKycDocuments(shopId);
      setDocs(Array.isArray(list) ? list : []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byType = Object.fromEntries(docs.map((d) => [d.docType, d]));
  const orderedDocs = ORDER.map((key) => byType[key]).filter(Boolean);

  const overallStatus = (() => {
    if (orderedDocs.length === 0) return 'NONE';
    if (orderedDocs.some((d) => d.status === 'REJECTED')) return 'REJECTED';
    if (orderedDocs.every((d) => d.status === 'APPROVED')) return 'APPROVED';
    return 'PENDING_REVIEW';
  })();

  const onEdit = () => {
    navigation.navigate('OwnerKycUpload', { existing: byType });
  };

  const onDelete = async (doc) => {
    const ok = await confirm({
      title: 'Remove document?',
      message: `Remove ${doc.title || TITLES[doc.docType] || doc.docType} from your KYC submission?`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setDeletingType(doc.docType);
    try {
      await deleteShopKycDocument(shopId, doc.docType);
      await load(true);
    } catch (e) {
      notify('Failed', e?.message || 'Please try again.', { preset: 'error', haptic: 'error' });
    } finally {
      setDeletingType(null);
    }
  };

  const HeroIcon =
    overallStatus === 'APPROVED' ? ShieldCheck
      : overallStatus === 'REJECTED' ? XCircle
        : overallStatus === 'NONE' ? FileText
          : Clock;

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: 6,
            paddingBottom: 14,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-surface-muted"
            >
              <ChevronLeft size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text className="flex-1 text-text text-[17px] font-extrabold" numberOfLines={1}>
              KYC Documents
            </Text>
            {orderedDocs.length > 0 ? (
              <Pressable
                onPress={onEdit}
                className="px-2.5 py-1 rounded-full flex-row items-center bg-surface-muted"
                hitSlop={6}
              >
                <Pencil size={11} color="#0F172A" />
                <Text className="ml-1 text-text text-[10.5px] font-extrabold">EDIT</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {!shopId ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[14px] font-semibold" style={{ color: '#DC2626' }}>
            Please log in again.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={BRAND_GREEN_DARK}
              colors={[BRAND_GREEN_DARK]}
            />
          }
        >
          {/* Status hero card */}
          <View style={cardShadow}>
            <LinearGradient
              colors={STATUS_GRADIENT[overallStatus]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 16, overflow: 'hidden' }}
            >
              <View
                style={{
                  position: 'absolute', right: -30, top: -30,
                  width: 110, height: 110, borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                }}
              />
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 48, height: 48, borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.22)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
                    marginRight: 12,
                  }}
                >
                  <HeroIcon size={22} color="#FFFFFF" strokeWidth={2.3} />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-[15.5px] font-extrabold">
                    {overallStatus === 'APPROVED' && 'KYC Approved'}
                    {overallStatus === 'REJECTED' && 'KYC Rejected'}
                    {overallStatus === 'PENDING_REVIEW' && 'Under Review'}
                    {overallStatus === 'NONE' && 'No documents yet'}
                  </Text>
                  <Text className="text-white/85 text-[11.5px] mt-1 leading-4">
                    {fromSubmit && overallStatus === 'PENDING_REVIEW'
                      ? 'Thank you! Your documents are being reviewed by admin.'
                      : overallStatus === 'APPROVED' ? 'All documents have been verified.'
                        : overallStatus === 'REJECTED' ? 'One or more documents need attention. Tap Edit to fix.'
                          : overallStatus === 'NONE' ? 'Upload your KYC documents to start verification.'
                            : `${orderedDocs.length} document${orderedDocs.length === 1 ? '' : 's'} awaiting admin review.`}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color={BRAND_GREEN_DARK} />
            </View>
          ) : orderedDocs.length === 0 ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('OwnerKycUpload')}
              className="mt-4"
              style={cardShadow}
            >
              <LinearGradient
                colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 18,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloudUpload size={16} color="#FFFFFF" />
                <Text className="ml-2 text-white text-[14px] font-extrabold">
                  Upload KYC Documents
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <>
              {/* Section label */}
              <View className="mt-5 mb-2 ml-1 flex-row items-center">
                <Text
                  className="text-[11px] font-extrabold uppercase flex-1"
                  style={{ color: BRAND_GREEN_DARK, letterSpacing: 1.2 }}
                >
                  Uploaded Documents
                </Text>
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: '#DCFCE7' }}
                >
                  <Text
                    className="text-[10.5px] font-extrabold"
                    style={{ color: BRAND_GREEN_DARK }}
                  >
                    {orderedDocs.length} uploaded
                  </Text>
                </View>
              </View>

              {/* Doc grid */}
              <View className="flex-row flex-wrap -mx-1">
                {orderedDocs.map((doc) => {
                  const status = doc.status || 'PENDING';
                  const pillMeta =
                    status === 'APPROVED' ? { tint: '#DCFCE7', accent: BRAND_GREEN_DARK, Icon: CheckCircle2 }
                      : status === 'REJECTED' ? { tint: '#FEE2E2', accent: '#B91C1C', Icon: XCircle }
                        : { tint: '#FEF3C7', accent: '#B45309', Icon: Clock };
                  const PillIcon = pillMeta.Icon;
                  return (
                    <View key={doc.id || doc.docType} style={{ width: '50%', padding: 6 }}>
                      <View className="bg-white rounded-2xl p-3" style={softShadow}>
                        <View
                          className="flex-row items-center rounded-xl px-2 py-1.5 mb-2"
                          style={{ backgroundColor: '#F8FAFC' }}
                        >
                          <FileText size={12} color="#475569" />
                          <Text
                            className="flex-1 text-[11px] font-extrabold text-gray-800 ml-1.5"
                            numberOfLines={1}
                          >
                            {doc.title || TITLES[doc.docType] || doc.docType}
                          </Text>
                          {doc.required ? (
                            <Text className="text-[12px] font-extrabold" style={{ color: '#DC2626' }}>*</Text>
                          ) : null}
                        </View>

                        <View
                          className="rounded-xl overflow-hidden items-center justify-center"
                          style={{
                            backgroundColor: '#F0FDF4',
                            minHeight: 112,
                            borderWidth: 1, borderColor: '#DCFCE7',
                          }}
                        >
                          {isPdf(doc.url) ? (
                            <View className="flex-row items-center px-2.5 py-2 w-full">
                              <View
                                className="px-2 py-1 rounded mr-2"
                                style={{ backgroundColor: '#EF4444' }}
                              >
                                <Text className="text-white text-[10px] font-extrabold">PDF</Text>
                              </View>
                              <Text className="flex-1 text-[11px] font-semibold text-gray-700" numberOfLines={2}>
                                {(doc.title || doc.docType).toLowerCase().replace(/\s+/g, '-')}.pdf
                              </Text>
                            </View>
                          ) : (
                            <Image
                              source={{ uri: doc.url }}
                              style={{ width: '100%', height: 112 }}
                              resizeMode="cover"
                            />
                          )}
                        </View>

                        <View className="flex-row items-center mt-2">
                          <View
                            className="flex-row items-center px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: pillMeta.tint }}
                          >
                            <PillIcon size={9} color={pillMeta.accent} />
                            <Text
                              className="ml-1 text-[9.5px] font-extrabold"
                              style={{ color: pillMeta.accent, letterSpacing: 0.3 }}
                            >
                              {status}
                            </Text>
                          </View>
                          <Text
                            className="flex-1 ml-1 text-[9.5px] font-bold text-gray-400"
                            numberOfLines={1}
                          >
                            {fmtDate(doc.updatedAt || doc.createdAt)}
                          </Text>
                          <Pressable
                            onPress={() => onDelete(doc)}
                            hitSlop={6}
                            disabled={deletingType === doc.docType}
                            className="w-7 h-7 rounded-full items-center justify-center"
                            style={{ backgroundColor: '#FEE2E2' }}
                          >
                            {deletingType === doc.docType ? (
                              <ActivityIndicator size="small" color="#B91C1C" />
                            ) : (
                              <Trash2 size={12} color="#B91C1C" />
                            )}
                          </Pressable>
                        </View>

                        {status === 'REJECTED' && doc.rejectReason ? (
                          <Text
                            className="text-[10px] mt-2 italic leading-3"
                            style={{ color: '#B91C1C' }}
                          >
                            {doc.rejectReason}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* CTA */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onEdit}
                className="mt-4"
                style={cardShadow}
              >
                <LinearGradient
                  colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 18,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Upload size={16} color="#FFFFFF" />
                  <Text className="ml-2 text-white text-[14px] font-extrabold">
                    Edit Documents
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
