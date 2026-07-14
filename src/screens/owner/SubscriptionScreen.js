import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {
  Crown,
  Gift,
  Check,
  Store,
  Clock,
  CreditCard,
  Zap,
  Minus,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import { ScreenHeader } from '../../components/rnr';
import { tokens } from '../../theme/colors';
import { subscriptionApi } from '../../api/client';
import { getSession } from '../../auth/session';
import { fetchMe } from '../../api/auth';

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

const softShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

// Static pricing table for Basic multi-shop (1 shop = 3000, N>=2 = N x 2500).
const PRICING_ROWS = [
  { shops: 1, amount: 3000 },
  { shops: 2, amount: 5000 },
  { shops: 3, amount: 7500 },
  { shops: 4, amount: 10000 },
  { shops: 5, amount: 12500 },
];

const STATUS_META = {
  FREE_TRIAL: { label: 'Free Trial', color: '#B45309', tint: '#FFEDD5' },
  ACTIVE:     { label: 'Active',     color: tokens.primaryDark, tint: tokens.primarySoft },
  EXPIRED:    { label: 'Expired',    color: '#B91C1C', tint: '#FEE2E2' },
  CANCELLED:  { label: 'Cancelled',  color: '#B91C1C', tint: '#FEE2E2' },
};

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// FREE_TRIAL and BASIC plan visuals keyed by plan code.
const PLAN_ICON = { FREE_TRIAL: Gift, BASIC: Crown };

export default function SubscriptionScreen({ navigation, gated = false, onUnlock, onLogout }) {
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upgrade flow state
  const [upgrading, setUpgrading] = useState(false);      // upgrade panel open
  const [shopCount, setShopCount] = useState(1);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Resolve the logged-in owner id (fetchMe heals old sessions; id === userId).
      let uid = null;
      try {
        const me = await fetchMe();
        uid = me?.id || me?.userId || null;
      } catch {
        const s = await getSession();
        uid = s?.userId || s?.id || null;
      }
      setOwnerUserId(uid);

      const [planList, cur] = await Promise.all([
        subscriptionApi.get('/subscriptions/plans').catch(() => []),
        uid
          ? subscriptionApi.get(`/subscriptions/owner/${uid}`).catch(() => null)
          : Promise.resolve(null),
      ]);
      setPlans(Array.isArray(planList) ? planList : []);
      setCurrent(cur || null);
    } catch (e) {
      setError(e?.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refetch the quote whenever the picked shop count changes (upgrade panel open).
  useEffect(() => {
    if (!upgrading) return;
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      try {
        const q = await subscriptionApi.get('/subscriptions/quote', { query: { shops: shopCount } });
        if (!cancelled) setQuote(q || null);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [upgrading, shopCount]);

  const currentType = current?.subscriptionType || null;
  const currentStatus = current?.status || null;
  // Upgrade CTA only when on trial or nothing active yet.
  const canUpgrade = !current || currentStatus === 'FREE_TRIAL' || currentStatus === 'EXPIRED' || currentStatus === 'CANCELLED';

  const fallbackQuoteTotal = useMemo(() => {
    const row = PRICING_ROWS.find((r) => r.shops === shopCount);
    return row ? row.amount : (shopCount >= 2 ? shopCount * 2500 : 3000);
  }, [shopCount]);

  const quoteTotal = quote?.total ?? fallbackQuoteTotal;

  const handleActivate = async () => {
    if (!ownerUserId) { setError('Could not resolve your account. Please try again.'); return; }
    setActivating(true);
    setError(null);
    try {
      await subscriptionApi.post('/subscriptions/activate', {
        body: { ownerUserId, shopCount },
      });
      const cur = await subscriptionApi.get(`/subscriptions/owner/${ownerUserId}`).catch(() => null);
      setCurrent(cur || null);
      setActivated(true);
      setUpgrading(false);
    } catch (e) {
      setError(e?.message || 'Could not activate the plan. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const openUpgrade = () => {
    setActivated(false);
    setShopCount(Math.max(1, current?.shopCount || 1));
    setUpgrading(true);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F4FBF6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScreenHeader
        title="Subscription"
        onBack={gated ? undefined : () => navigation?.goBack?.()}
        right={gated ? (
          <Pressable onPress={onLogout} hitSlop={8} className="px-2 py-1">
            <Text className="text-[12.5px] font-extrabold" style={{ color: '#B91C1C' }}>Logout</Text>
          </Pressable>
        ) : undefined}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.primary} />
          <Text className="mt-3 text-[12.5px] text-gray-500">Loading your plan…</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {gated && !activated ? (
            <View className="rounded-2xl px-3.5 py-3 mb-3" style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}>
              <View className="flex-row items-center">
                <AlertCircle size={16} color="#B45309" />
                <Text className="ml-2 flex-1 text-[13px] font-extrabold" style={{ color: '#B45309' }}>
                  Your free trial has ended
                </Text>
              </View>
              <Text className="text-[12px] text-gray-600 mt-1">
                Choose a plan below to continue using GGFIX. You can log out anytime from the top-right.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View
              className="flex-row items-center rounded-2xl px-3.5 py-3 mb-3"
              style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}
            >
              <AlertCircle size={16} color="#B91C1C" />
              <Text className="ml-2 flex-1 text-[12.5px] font-semibold" style={{ color: '#B91C1C' }}>
                {error}
              </Text>
            </View>
          ) : null}

          {activated ? (
            <View
              className="flex-row items-center rounded-2xl px-3.5 py-3 mb-3"
              style={{ backgroundColor: tokens.primarySoft, borderWidth: 1, borderColor: '#BBF7D0' }}
            >
              <CheckCircle2 size={18} color={tokens.primaryDark} />
              <Text className="ml-2 flex-1 text-[12.5px] font-extrabold" style={{ color: tokens.primaryDark }}>
                Basic plan activated. You&apos;re all set!
              </Text>
            </View>
          ) : null}

          {gated && activated ? (
            <Pressable
              onPress={onUnlock}
              className="flex-row items-center justify-center rounded-2xl py-4 mb-3"
              style={{ backgroundColor: tokens.primary, ...cardShadow }}
            >
              <CheckCircle2 size={18} color="#FFFFFF" />
              <Text className="ml-2 text-white text-[15px] font-extrabold">Continue to App</Text>
            </Pressable>
          ) : null}

          {/* ---------- CURRENT PLAN ---------- */}
          <CurrentPlanCard current={current} />

          {/* ---------- PLANS ---------- */}
          <SectionLabel>Available Plans</SectionLabel>
          {plans.length === 0 ? (
            <View className="bg-white rounded-2xl p-4" style={softShadow}>
              <Text className="text-[12.5px] text-gray-500">No plans available right now.</Text>
            </View>
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                highlight={plan.code === 'BASIC'}
                isCurrent={currentType === plan.code || currentType === plan.name}
              />
            ))
          )}

          {/* ---------- PRICING TABLE ---------- */}
          <SectionLabel>Basic · Multi-shop Pricing</SectionLabel>
          <View className="bg-white rounded-2xl overflow-hidden" style={softShadow}>
            <View
              className="flex-row px-4 py-2.5"
              style={{ backgroundColor: tokens.primarySoft }}
            >
              <Text className="flex-1 text-[11px] font-extrabold uppercase" style={{ color: tokens.primaryDark, letterSpacing: 0.6 }}>
                Total Shops
              </Text>
              <Text className="text-[11px] font-extrabold uppercase" style={{ color: tokens.primaryDark, letterSpacing: 0.6 }}>
                Total Amount
              </Text>
            </View>
            {PRICING_ROWS.map((row, i) => (
              <View
                key={row.shops}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: '#F1F5F9',
                }}
              >
                <View className="flex-1 flex-row items-center">
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center mr-2"
                    style={{ backgroundColor: '#F0FDF4' }}
                  >
                    <Store size={12} color={tokens.primaryDark} />
                  </View>
                  <Text className="text-[13px] font-bold text-gray-800">
                    {row.shops} shop{row.shops === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text className="text-[13.5px] font-extrabold" style={{ color: tokens.primaryDark }}>
                  {money(row.amount)}
                </Text>
              </View>
            ))}
          </View>
          <Text className="text-[11px] text-gray-400 mt-2 ml-1">
            1 shop = ₹3,000 · 2 or more shops = ₹2,500 per shop.
          </Text>

          {/* ---------- UPGRADE CTA / FLOW ---------- */}
          {canUpgrade ? (
            <View className="mt-5">
              {!upgrading ? (
                <Pressable
                  onPress={openUpgrade}
                  android_ripple={{ color: '#DCFCE7' }}
                  className="flex-row items-center justify-center rounded-2xl py-4"
                  style={{ backgroundColor: tokens.primary, ...cardShadow }}
                >
                  <Zap size={18} color="#FFFFFF" strokeWidth={2.4} />
                  <Text className="ml-2 text-white text-[15px] font-extrabold">Upgrade to Basic</Text>
                </Pressable>
              ) : (
                <UpgradePanel
                  shopCount={shopCount}
                  onDec={() => setShopCount((n) => Math.max(1, n - 1))}
                  onInc={() => setShopCount((n) => Math.min(5, n + 1))}
                  onSet={setShopCount}
                  quote={quote}
                  quoteLoading={quoteLoading}
                  quoteTotal={quoteTotal}
                  activating={activating}
                  onConfirm={handleActivate}
                  onCancel={() => setUpgrading(false)}
                />
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */

function CurrentPlanCard({ current }) {
  if (!current) {
    return (
      <View className="bg-white rounded-3xl p-4" style={cardShadow}>
        <View className="flex-row items-center">
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
            style={{ backgroundColor: '#F1F5F9' }}
          >
            <CreditCard size={20} color="#64748B" />
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-extrabold uppercase" style={{ color: '#94A3B8', letterSpacing: 1 }}>
              Current Plan
            </Text>
            <Text className="text-[15px] font-extrabold text-gray-900 mt-0.5">No active plan</Text>
            <Text className="text-[11.5px] text-gray-500 mt-0.5">Choose a plan below to get started.</Text>
          </View>
        </View>
      </View>
    );
  }

  const status = current.status || '';
  const meta = STATUS_META[status] || { label: status, color: '#475569', tint: '#F1F5F9' };
  const isTrial = status === 'FREE_TRIAL';
  const isActive = status === 'ACTIVE';
  const planName = current.subscriptionType === 'BASIC' || current.subscriptionType === 'Basic'
    ? 'Basic'
    : (current.subscriptionType === 'FREE_TRIAL' || isTrial ? 'Free Trial' : (current.subscriptionType || meta.label));
  const days = Number(current.daysRemaining);

  return (
    <View className="bg-white rounded-3xl p-4" style={cardShadow}>
      <View className="flex-row items-center">
        <View
          className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
          style={{ backgroundColor: isTrial ? '#FFEDD5' : tokens.primarySoft }}
        >
          {isTrial ? (
            <Gift size={20} color="#B45309" />
          ) : (
            <Crown size={20} color={tokens.primaryDark} />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-[10px] font-extrabold uppercase" style={{ color: '#94A3B8', letterSpacing: 1 }}>
            Current Plan
          </Text>
          <View className="flex-row items-center mt-0.5 flex-wrap">
            <Text className="text-[16px] font-extrabold text-gray-900 mr-2">{planName}</Text>
            <View
              className="px-2 py-0.5 rounded-full self-start"
              style={{ backgroundColor: meta.tint }}
            >
              <Text className="text-[10px] font-extrabold" style={{ color: meta.color, letterSpacing: 0.3 }}>
                {meta.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Trial / active detail row */}
      {isTrial ? (
        <View
          className="flex-row items-center rounded-2xl px-3 py-2.5 mt-3"
          style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}
        >
          <Clock size={16} color="#B45309" />
          <Text className="ml-2 text-[13px] font-extrabold" style={{ color: '#B45309' }}>
            {Number.isFinite(days) ? `${days} day${days === 1 ? '' : 's'} left` : 'Trial active'}
          </Text>
          {formatDate(current.inactiveDate) ? (
            <Text className="ml-auto text-[11.5px] font-semibold text-gray-500">
              Ends {formatDate(current.inactiveDate)}
            </Text>
          ) : null}
        </View>
      ) : isActive ? (
        <View
          className="flex-row items-center rounded-2xl px-3 py-2.5 mt-3"
          style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
        >
          <Check size={16} color={tokens.primaryDark} />
          <Text className="ml-2 text-[13px] font-extrabold" style={{ color: tokens.primaryDark }}>
            {formatDate(current.inactiveDate) ? `Active until ${formatDate(current.inactiveDate)}` : 'Active'}
          </Text>
          {money(current.priceAmount) ? (
            <Text className="ml-auto text-[11.5px] font-semibold text-gray-500">
              {money(current.priceAmount)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Meta chips (shops / employees / sell / pickup) */}
      {(current.shopLimit != null || current.shopCount != null) ? (
        <View className="flex-row flex-wrap mt-3" style={{ marginHorizontal: -3 }}>
          {current.shopCount != null ? (
            <MetaChip icon={Store} label={`${current.shopCount} shop${current.shopCount === 1 ? '' : 's'}`} />
          ) : null}
          {current.employeeLimit != null ? (
            <MetaChip icon={CreditCard} label={`${current.employeeLimit} staff`} />
          ) : null}
          {current.pickupServiceEnabled ? (
            <MetaChip icon={Zap} label="Pickup enabled" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MetaChip({ icon: Icon, label }) {
  return (
    <View
      className="flex-row items-center px-2.5 py-1 rounded-full mb-1.5"
      style={{ backgroundColor: '#F1F5F9', marginHorizontal: 3 }}
    >
      <Icon size={11} color="#475569" />
      <Text className="ml-1 text-[11px] font-bold text-gray-600">{label}</Text>
    </View>
  );
}

function PlanCard({ plan, highlight, isCurrent }) {
  const Icon = PLAN_ICON[plan.code] || CreditCard;
  const isTrial = plan.code === 'FREE_TRIAL';
  const priceLabel = isTrial
    ? `Free · ${plan.durationDays || 15} days`
    : `${money(plan.price) || '₹3,000'} / year`;
  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <View
      className="bg-white rounded-3xl p-4 mb-3"
      style={[
        cardShadow,
        highlight
          ? { borderWidth: 2, borderColor: tokens.primary, backgroundColor: '#FBFEFC' }
          : { borderWidth: 1, borderColor: '#E5E7EB' },
      ]}
    >
      <View className="flex-row items-center">
        <View
          className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
          style={{ backgroundColor: isTrial ? '#FFEDD5' : tokens.primarySoft }}
        >
          <Icon size={20} color={isTrial ? '#B45309' : tokens.primaryDark} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap">
            <Text className="text-[16px] font-extrabold text-gray-900 mr-2">
              {plan.name || (isTrial ? 'Free Trial' : 'Basic')}
            </Text>
            {highlight ? (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: tokens.primary }}>
                <Text className="text-[9.5px] font-extrabold text-white" style={{ letterSpacing: 0.5 }}>
                  POPULAR
                </Text>
              </View>
            ) : null}
            {isCurrent ? (
              <View className="px-2 py-0.5 rounded-full ml-1.5" style={{ backgroundColor: '#F1F5F9' }}>
                <Text className="text-[9.5px] font-extrabold text-gray-500" style={{ letterSpacing: 0.5 }}>
                  CURRENT
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-[14px] font-extrabold mt-0.5" style={{ color: tokens.primaryDark }}>
            {priceLabel}
          </Text>
          {!isTrial ? (
            <Text className="text-[11px] text-gray-500 mt-0.5">
              {money(plan.multiShopPrice) ? `${money(plan.multiShopPrice)}/shop for 2+ shops` : '₹2,500/shop for 2+ shops'}
            </Text>
          ) : null}
        </View>
      </View>

      {features.length > 0 ? (
        <View className="mt-3.5">
          {features.map((f, i) => (
            <View key={i} className="flex-row items-center mb-2">
              <View
                className="w-5 h-5 rounded-full items-center justify-center mr-2.5"
                style={{ backgroundColor: tokens.primarySoft }}
              >
                <Check size={12} color={tokens.primary} strokeWidth={3} />
              </View>
              <Text className="flex-1 text-[12.5px] text-gray-700 leading-4">{f}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function UpgradePanel({
  shopCount, onDec, onInc, onSet, quote, quoteLoading, quoteTotal, activating, onConfirm, onCancel,
}) {
  return (
    <View className="bg-white rounded-3xl p-4" style={cardShadow}>
      <View className="flex-row items-center">
        <Crown size={18} color={tokens.primaryDark} />
        <Text className="ml-2 text-[15px] font-extrabold text-gray-900">Activate Basic Plan</Text>
      </View>
      <Text className="text-[12px] text-gray-500 mt-1">
        How many shops do you want to cover?
      </Text>

      {/* Stepper */}
      <View className="flex-row items-center justify-center mt-4">
        <Pressable
          onPress={onDec}
          disabled={shopCount <= 1}
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{
            backgroundColor: shopCount <= 1 ? '#F1F5F9' : tokens.primarySoft,
            opacity: shopCount <= 1 ? 0.5 : 1,
          }}
        >
          <Minus size={18} color={tokens.primaryDark} strokeWidth={2.6} />
        </Pressable>
        <View className="mx-6 items-center">
          <Text className="text-[30px] font-extrabold text-gray-900">{shopCount}</Text>
          <Text className="text-[10.5px] font-bold text-gray-400 uppercase" style={{ letterSpacing: 0.6 }}>
            shop{shopCount === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={onInc}
          disabled={shopCount >= 5}
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{
            backgroundColor: shopCount >= 5 ? '#F1F5F9' : tokens.primarySoft,
            opacity: shopCount >= 5 ? 0.5 : 1,
          }}
        >
          <Plus size={18} color={tokens.primaryDark} strokeWidth={2.6} />
        </Pressable>
      </View>

      {/* Quick-pick chips 1..5 */}
      <View className="flex-row justify-center mt-4" style={{ marginHorizontal: -3 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n === shopCount;
          return (
            <Pressable
              key={n}
              onPress={() => onSet(n)}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{
                marginHorizontal: 3,
                backgroundColor: active ? tokens.primary : '#F1F5F9',
              }}
            >
              <Text
                className="text-[13px] font-extrabold"
                style={{ color: active ? '#FFFFFF' : '#64748B' }}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Total */}
      <View
        className="flex-row items-center rounded-2xl px-4 py-3 mt-4"
        style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
      >
        <Text className="text-[12.5px] font-bold text-gray-600 flex-1">Total payable</Text>
        {quoteLoading ? (
          <ActivityIndicator color={tokens.primaryDark} />
        ) : (
          <Text className="text-[20px] font-extrabold" style={{ color: tokens.primaryDark }}>
            {money(quoteTotal)}
          </Text>
        )}
      </View>
      {quote?.discountApplied ? (
        <Text className="text-[11px] font-semibold text-center mt-1.5" style={{ color: tokens.primary }}>
          Multi-shop discount applied ({money(quote.pricePerShop)}/shop)
        </Text>
      ) : null}

      {/* Confirm / cancel */}
      <Pressable
        onPress={onConfirm}
        disabled={activating}
        className="flex-row items-center justify-center rounded-2xl py-3.5 mt-4"
        style={{ backgroundColor: tokens.primary, opacity: activating ? 0.6 : 1 }}
      >
        {activating ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <CreditCard size={16} color="#FFFFFF" />
            <Text className="ml-2 text-white text-[14.5px] font-extrabold">
              Confirm &amp; Activate
            </Text>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={onCancel}
        disabled={activating}
        className="items-center justify-center py-3 mt-1"
      >
        <Text className="text-[13px] font-bold text-gray-500">Cancel</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function SectionLabel({ children }) {
  return (
    <View className="mt-5 mb-2 ml-1">
      <Text
        className="text-[11px] font-extrabold uppercase"
        style={{ color: tokens.primaryDark, letterSpacing: 1.2 }}
      >
        {children}
      </Text>
    </View>
  );
}
