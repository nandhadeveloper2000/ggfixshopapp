import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View, TouchableOpacity, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import {
  Smartphone,
  Clock,
  FileText,
  CalendarClock,
  CheckCircle2,
  Camera,
  PlayCircle,
  ShieldCheck,
  PackageX,
  UserCog,
  IndianRupee,
  ChevronLeft,
  Hash,
  Palette,
  Play,
  Pause,
} from 'lucide-react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { ticketApi } from '../../../api/client';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_DARK = '#15803D';
const ACCENT_GREEN = '#16A34A';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

function parseDevicePhotos(ticket) {
  if (ticket?.devicePhotosJson) {
    try {
      const p = JSON.parse(ticket.devicePhotosJson);
      if (p && typeof p === 'object') return p;
    } catch (_) {}
  }
  return {};
}

function parseTechnicianPhotos(ticket) {
  if (!ticket?.technicianPhotosJson) return [];
  try {
    const p = JSON.parse(ticket.technicianPhotosJson);
    if (!Array.isArray(p)) return [];
    return p
      .map((x) => (typeof x === 'string' ? x : (x?.url || x?.uri || x?.imageUrl || null)))
      .filter(Boolean);
  } catch (_) { return []; }
}

function parseMissingParts(ticket) {
  if (!ticket?.missingPartsJson) return [];
  try {
    const p = JSON.parse(ticket.missingPartsJson);
    if (Array.isArray(p)) return p.map((x) => (typeof x === 'string' ? x : (x?.name || x?.label))).filter(Boolean);
  } catch (_) {}
  return [];
}

function priceItemsFromTicket(ticket) {
  if (Array.isArray(ticket?.priceItems)) return ticket.priceItems;
  if (ticket?.priceItemsJson) {
    try {
      const parsed = JSON.parse(ticket.priceItemsJson);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return ticket?.services?.map?.((s) => ({ id: s.id, label: s.serviceName, amount: s.price })) || [];
}

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function SectionHeader({ icon: Icon, label, tint = '#DCFCE7', accent = BRAND_GREEN_DARK }) {
  return (
    <View className="flex-row items-center mb-3">
      <View
        className="w-7 h-7 rounded-full items-center justify-center mr-2"
        style={{ backgroundColor: tint }}
      >
        <Icon size={14} color={accent} />
      </View>
      <Text
        className="text-[11px] font-bold tracking-widest"
        style={{ color: accent, letterSpacing: 1.3 }}
      >
        {label}
      </Text>
    </View>
  );
}

function DetailRow({ icon: Icon, label, value, valueClassName = 'text-gray-900' }) {
  return (
    <View className="flex-row items-start py-2.5">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: '#F0FDF4' }}
      >
        <Icon size={14} color={ACCENT_GREEN} />
      </View>
      <View className="flex-1">
        <Text className="text-[10.5px] uppercase font-semibold text-gray-400 mb-0.5" style={{ letterSpacing: 0.6 }}>
          {label}
        </Text>
        <Text className={`text-[13.5px] font-semibold leading-5 ${valueClassName}`}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function PhotoSlot({ label, uri, icon: Icon }) {
  return (
    <View style={{ width: '33.333%' }} className="p-1">
      <Text className="text-[10px] font-bold text-gray-500 text-center mb-1" numberOfLines={1}>{label}</Text>
      <View
        className="rounded-xl overflow-hidden items-center justify-center"
        style={{
          aspectRatio: 1,
          backgroundColor: '#F0FDF4',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: '#86EFAC',
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Icon size={22} color={BRAND_GREEN} />
        )}
      </View>
    </View>
  );
}

// Plays a single voice note from the compliance-note card. Each row owns its
// own Audio.Sound; we still release on unmount so navigating away doesn't
// leak a player and block the next acquisition.
function VoiceNoteChip({ uri }) {
  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    try { soundRef.current?.unloadAsync?.(); } catch (_) {}
  }, []);

  const toggle = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => { if (s?.didJustFinish) setPlaying(false); });
      await sound.playAsync();
      setPlaying(true);
    } catch (_) { /* best-effort playback */ }
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      className="flex-row items-center rounded-full px-3 py-1.5 mt-2 self-start"
      style={{ borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }}
    >
      {playing ? <Pause size={12} color="#0F172A" /> : <Play size={12} color="#0F172A" />}
      <Text className="text-[11px] font-bold text-gray-900 ml-1.5">Voice note</Text>
    </TouchableOpacity>
  );
}

// "Issue Verified & Updated" card on the owner's Device Detail screen.
// Lists every compliance note the technician has submitted (from
// /tickets/{id}/notes) with the typed text, optional voice note, and the
// image attachments. Returns null when the technician hasn't submitted any.
function ComplianceNotesCard({ notes }) {
  const list = Array.isArray(notes) ? notes : [];
  if (list.length === 0) return null;
  return (
    <View className="px-4 mt-4">
      <View
        className="bg-white rounded-2xl p-4"
        style={cardShadow}
      >
        <SectionHeader icon={FileText} label="ISSUE VERIFIED & UPDATED" tint="#FEF3C7" accent="#B45309" />
        {list.map((n, idx) => {
          const imgs = Array.isArray(n.imageUrls) ? n.imageUrls : [];
          return (
            <View
              key={n.id || idx}
              className="flex-row mt-1"
              style={{
                paddingTop: idx > 0 ? 12 : 0,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: '#F1F5F9',
                marginTop: idx > 0 ? 12 : 0,
              }}
            >
              <View
                style={{ width: 3, borderRadius: 2, backgroundColor: '#F59E0B', marginRight: 10 }}
              />
              <View className="flex-1">
                {n.note ? (
                  <Text className="text-[13px] text-gray-900 leading-5">{n.note}</Text>
                ) : null}
                {n.audioUrl ? <VoiceNoteChip uri={n.audioUrl} /> : null}
                {imgs.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                    <View className="flex-row">
                      {imgs.map((u, j) => (
                        <Image
                          key={j}
                          source={{ uri: u }}
                          style={{ width: 72, height: 72, borderRadius: 8, marginRight: 6 }}
                        />
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
                {n.createdAt ? (
                  <Text className="text-[10px] text-gray-500 mt-1.5">
                    {formatDateTime(n.createdAt) || ''}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function DeviceDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { ticketId } = route.params || {};
  const [ticket, setTicket] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [complianceNotes, setComplianceNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ticketApi.get(`/tickets/${ticketId}`);
      setTicket(data);
      if (data?.assignedTechnicianId) {
        try {
          const list = await ticketApi.get('/technicians');
          const arr = Array.isArray(list) ? list : (list?.content || []);
          setTechnician(arr.find((x) => x.id === data.assignedTechnicianId) || null);
        } catch (_) { setTechnician(null); }
      } else {
        setTechnician(null);
      }
      // Compliance notes drive the "Issue Verified & Updated" card below.
      // Failure here shouldn't break the rest of the screen — leave the
      // section hidden if the call errors out.
      try {
        const notes = await ticketApi.get(`/tickets/${ticketId}/notes`);
        setComplianceNotes(Array.isArray(notes) ? notes : []);
      } catch (_) { setComplianceNotes([]); }
    } catch (e) {
      setError(e.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading && !ticket) return <Loader label="Loading device details..." />;
  if (error || !ticket) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          title="Booking not found"
          description={error || 'We could not load this booking.'}
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const trackingId = ticket.trackingId || ticket.id;
  const deviceName = ticket.deviceDisplayName || ticket.deviceModelName || ticket.modelName || 'Device';
  const lineItems = priceItemsFromTicket(ticket);
  const estimatedTotal = ticket.estimatedPrice != null
    ? ticket.estimatedPrice
    : lineItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const photos = parseDevicePhotos(ticket);
  const technicianPhotos = parseTechnicianPhotos(ticket);
  const missingParts = parseMissingParts(ticket);
  const readyAtText = formatDateTime(ticket.estimatedReadyAt);
  const deliveryAtText = formatDateTime(ticket.estimatedDeliveryAt);
  const approvalText = ticket.customerApproval === true ? 'Done'
    : ticket.customerApproval === false ? 'Pending' : null;
  const securityType = ticket.deviceSecurityType && ticket.deviceSecurityType !== 'NONE'
    ? ticket.deviceSecurityType : null;
  const securityValue = ticket.deviceSecurityValue || null;

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN_DARK} />

      {/* Hero gradient (slim — replaces native white header) */}
      <LinearGradient
        colors={[BRAND_GREEN, BRAND_GREEN_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 14,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="flex-1 text-white text-[17px] font-extrabold" numberOfLines={1}>
            Device Details
          </Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', maxWidth: 160 }}
          >
            <Text className="text-white text-[11px] font-extrabold" numberOfLines={1}>
              #{trackingId}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Floating device card */}
        <View className="px-4" style={{ marginTop: 12 }}>
          <View
            className="bg-white rounded-2xl p-4 flex-row items-center"
            style={cardShadow}
          >
            {ticket.deviceImageUrl ? (
              <Image
                source={{ uri: ticket.deviceImageUrl }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  backgroundColor: '#F1F5F9',
                  marginRight: 12,
                }}
              />
            ) : (
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mr-3"
                style={{ backgroundColor: '#DCFCE7' }}
              >
                <Smartphone size={28} color={BRAND_GREEN_DARK} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-[10.5px] uppercase font-bold text-gray-400" style={{ letterSpacing: 0.7 }}>
                Device
              </Text>
              <Text
                className="text-[15px] font-extrabold text-gray-900 mt-0.5"
                numberOfLines={2}
              >
                {deviceName}
              </Text>
              {ticket.color ? (
                <View className="flex-row items-center mt-1.5">
                  <Palette size={11} color={ACCENT_GREEN} />
                  <Text className="text-[11.5px] text-gray-500 ml-1">
                    {ticket.color}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Price Summary */}
        <View className="px-4" style={{ marginTop: 14 }}>
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={IndianRupee} label="PRICE SUMMARY" />
            {lineItems.length === 0 ? (
              <Text className="text-[12px] text-gray-500">No service items recorded.</Text>
            ) : (
              <>
                {lineItems.map((item, idx) => (
                  <View key={item.id || idx} className="flex-row items-center py-1.5">
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center mr-2.5"
                      style={{ backgroundColor: '#DCFCE7' }}
                    >
                      <Text
                        className="text-[10.5px] font-extrabold"
                        style={{ color: BRAND_GREEN_DARK }}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    <Text className="text-[12.5px] text-gray-700 flex-1" numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text className="text-[12.5px] font-bold text-gray-900">
                      ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}

                <View
                  className="my-3"
                  style={{ height: 1, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}
                />

                <View
                  className="p-3 rounded-2xl flex-row items-center justify-between"
                  style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
                >
                  <View>
                    <Text className="text-[10.5px] uppercase font-bold text-gray-500" style={{ letterSpacing: 0.6 }}>
                      Estimated Total
                    </Text>
                    <Text className="text-[10.5px] text-gray-500">
                      Inclusive of all services
                    </Text>
                  </View>
                  <Text
                    className="text-[18px] font-extrabold"
                    style={{ color: BRAND_GREEN_DARK }}
                  >
                    ₹{Number(estimatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Complaint */}
        {ticket.issueDescription ? (
          <View className="px-4 mt-4">
            <View
              className="bg-white rounded-2xl p-4"
              style={cardShadow}
            >
              <SectionHeader icon={FileText} label="COMPLAINT ISSUE" tint="#DBEAFE" accent="#1D4ED8" />
              <View
                className="p-3 rounded-xl"
                style={{ backgroundColor: '#F8FAFC' }}
              >
                <Text className="text-[12.5px] text-gray-700 leading-5" numberOfLines={8}>
                  {ticket.issueDescription}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Schedule + Approval */}
        <View className="px-4 mt-4">
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={CalendarClock} label="SERVICE SCHEDULE" tint="#FEF3C7" accent="#B45309" />
            <DetailRow icon={Clock} label="Approx. Ready" value={readyAtText || 'Not yet set'} />
            <DetailRow icon={CalendarClock} label="Delivery" value={deliveryAtText || 'Not yet set'} />
            <View className="flex-row items-center py-2.5">
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: approvalText === 'Done' ? '#DCFCE7' : '#F3F4F6' }}
              >
                <CheckCircle2 size={14} color={approvalText === 'Done' ? BRAND_GREEN_DARK : '#9CA3AF'} />
              </View>
              <View className="flex-1">
                <Text className="text-[10.5px] uppercase font-semibold text-gray-400 mb-0.5" style={{ letterSpacing: 0.6 }}>
                  Customer Approval
                </Text>
                <Text
                  className="text-[13.5px] font-semibold leading-5"
                  style={{ color: approvalText === 'Done' ? BRAND_GREEN_DARK : '#6B7280' }}
                >
                  {approvalText || 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Device Photos */}
        <View className="px-4 mt-4">
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={Camera} label="DEVICE PHOTOS" tint="#EDE9FE" accent="#6D28D9" />
            <View className="flex-row -mx-1 mt-1">
              <PhotoSlot label="Front Side" uri={photos.front} icon={Camera} />
              <PhotoSlot label="Back Side" uri={photos.back} icon={Camera} />
              <PhotoSlot label="Coverage Video" uri={photos.video} icon={PlayCircle} />
            </View>
          </View>
        </View>

        {/* Device Security */}
        <View className="px-4 mt-4">
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={ShieldCheck} label="DEVICE SECURITY" tint="#CFFAFE" accent="#0E7490" />
            {securityType || securityValue ? (
              <View
                className="p-3 rounded-xl flex-row items-center"
                style={{ backgroundColor: '#ECFEFF' }}
              >
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: '#06B6D4' }}
                >
                  <ShieldCheck size={16} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  {securityType ? (
                    <Text className="text-[10.5px] uppercase font-bold text-gray-500" style={{ letterSpacing: 0.6 }}>
                      {securityType}
                    </Text>
                  ) : null}
                  <Text className="text-[14px] font-extrabold text-gray-900 mt-0.5">
                    {securityValue || '—'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-[12.5px] text-gray-500">Not provided</Text>
            )}
          </View>
        </View>

        {/* Missing / Damage Parts */}
        <View className="px-4 mt-4">
          <View
            className="bg-white rounded-2xl p-4"
            style={cardShadow}
          >
            <SectionHeader icon={PackageX} label="MISSING / DAMAGE PARTS" tint="#FEE2E2" accent="#B91C1C" />
            {missingParts.length === 0 ? (
              <View
                className="p-3 rounded-xl flex-row items-center"
                style={{ backgroundColor: '#F0FDF4' }}
              >
                <CheckCircle2 size={16} color={BRAND_GREEN_DARK} />
                <Text className="ml-2 text-[12.5px] font-semibold" style={{ color: BRAND_GREEN_DARK }}>
                  No missing parts reported
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap -mx-1">
                {missingParts.map((p, i) => (
                  <View
                    key={i}
                    className="px-3 py-1.5 rounded-full m-1 flex-row items-center"
                    style={{ backgroundColor: '#FEE2E2' }}
                  >
                    <PackageX size={11} color="#B91C1C" />
                    <Text className="ml-1.5 text-[12px] font-semibold" style={{ color: '#B91C1C' }}>
                      {p}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Technician */}
        {(ticket.assignedTechnicianId || technician) ? (
          <View className="px-4 mt-4">
            <View
              className="bg-white rounded-2xl p-4"
              style={cardShadow}
            >
              <SectionHeader icon={UserCog} label="ASSIGNED TECHNICIAN" />
              <View className="flex-row items-center">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: BRAND_GREEN }}
                >
                  <Text className="text-white text-[15px] font-extrabold">
                    {(technician?.name || 'T').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-extrabold text-gray-900">
                    {technician?.name || 'Assigned'}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    {technician?.id ? (
                      <Text className="text-[11px] text-gray-500">
                        ID: {String(technician.id).slice(0, 8).toUpperCase()}
                      </Text>
                    ) : null}
                    {technician?.roleLabel ? (
                      <Text className="text-[11px] text-gray-500 ml-2">
                        • {technician.roleLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Technician uploaded device photos */}
        {(ticket.assignedTechnicianId || technician || technicianPhotos.length > 0) ? (
          <View className="px-4 mt-4">
            <View
              className="bg-white rounded-2xl p-4"
              style={cardShadow}
            >
              <SectionHeader icon={Camera} label="TECHNICIAN UPLOADS" tint="#EDE9FE" accent="#6D28D9" />
              <Text className="text-[11.5px] text-gray-500 mb-2" numberOfLines={1}>
                {(technician?.name || ticket.assignedTechnicianName || 'Technician')}
                {technician?.id ? `  •  ${String(technician.id).slice(0, 8).toUpperCase()}` : (
                  ticket.assignedTechnicianCode ? `  •  ${ticket.assignedTechnicianCode}` : ''
                )}
              </Text>
              <View className="flex-row -mx-1">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ width: '33.333%' }} className="p-1">
                    <View
                      className="rounded-xl items-center justify-center overflow-hidden"
                      style={{
                        aspectRatio: 1,
                        backgroundColor: '#F5F3FF',
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: '#C4B5FD',
                      }}
                    >
                      {technicianPhotos[i] ? (
                        <Image source={{ uri: technicianPhotos[i] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View className="items-center px-2">
                          <Camera size={20} color="#8B5CF6" />
                          <Text className="text-[9px] text-gray-500 text-center mt-1">
                            Awaiting photo
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* Technician's compliance / issue-verified note. Renders after the
            Technician Uploads block — mirrors the order of the technician's
            own Ticket Detail screen (Your Side images, then Issue Verified
            & Updated). Hidden when the technician hasn't submitted any. */}
        <ComplianceNotesCard notes={complianceNotes} />
      </ScrollView>
    </View>
  );
}
