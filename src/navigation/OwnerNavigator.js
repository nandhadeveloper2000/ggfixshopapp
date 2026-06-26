import React from 'react';
import { Pressable, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, LayoutGrid, FileText, Receipt, ShoppingBag, Tag, UserCircle } from 'lucide-react-native';
import colors from '../theme/colors';
import BackButton from '../components/BackButton';

// White-tinted back arrow for the green-header screens (Shop Info, Pickup
// Options). The shared BackButton renders a dark arrow which is invisible on
// the green native header bar.
function GreenHeaderBack({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
        backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'transparent',
      })}
    >
      <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
    </Pressable>
  );
}
import DashboardScreen from '../screens/owner/DashboardScreen';
import MyAccountScreen from '../screens/owner/MyAccountScreen';
// All booking-related screens are now grouped under owner/AllBooking/
import BookingHistoryScreen from '../screens/owner/AllBooking/BookingHistoryScreen';
import BillingScreen from '../screens/owner/BillingScreen';
import BuyScreen from '../screens/owner/BuyScreen';
import BookingStatusScreen from '../screens/owner/BookingStatusScreen';
import BookingStatusReportScreen from '../screens/owner/BookingStatusReportScreen';
import BookingPreviousReportScreen from '../screens/owner/BookingPreviousReportScreen';
import OwnerBuyListingDetailsScreen from '../screens/owner/OwnerBuyListingDetailsScreen';
import TicketListScreen from '../screens/owner/TicketListScreen';
import TicketDetailScreen from '../screens/owner/AllBooking/TicketDetailScreen';
import DeviceDetailScreen from '../screens/owner/AllBooking/DeviceDetailScreen';
import EditBookingScreen from '../screens/owner/AllBooking/EditBookingScreen';
import DeviceInformationScreen from '../screens/owner/DeviceInformationScreen';
import DeviceMissingPartsScreen from '../screens/owner/DeviceMissingPartsScreen';
import DeviceSecurityScreen from '../screens/owner/DeviceSecurityScreen';
import BookingSummaryScreen from '../screens/owner/AllBooking/BookingSummaryScreen';
import BookingTimelineScreen from '../screens/owner/AllBooking/BookingTimelineScreen';
import BarcodePrintScreen from '../screens/owner/AllBooking/BarcodePrintScreen';
import DeliveryInvoiceScreen from '../screens/owner/AllBooking/DeliveryInvoiceScreen';
import InvoiceGeneratorScreen from '../screens/owner/AllBooking/InvoiceGeneratorScreen';
import DeliveryInvoiceReportScreen from '../screens/owner/AllBooking/DeliveryInvoiceReportScreen';
import AssignTechnicianScreen from '../screens/owner/AssignTechnicianScreen';
import InventoryScreen from '../screens/owner/InventoryScreen';
import MarketplaceBuyScreen from '../screens/owner/MarketplaceBuyScreen';
import MarketplaceSellScreen from '../screens/owner/MarketplaceSellScreen';
import OwnerSellSparePartsScreen from '../screens/owner/OwnerSellSparePartsScreen';
import OwnerSellMobileChoiceScreen from '../screens/owner/OwnerSellMobileChoiceScreen';
import OwnerSellChooseSalesCategoryScreen from '../screens/owner/OwnerSellChooseSalesCategoryScreen';
import OwnerSellGadgetPriceScreen from '../screens/owner/OwnerSellGadgetPriceScreen';
import OwnerSellListedScreen from '../screens/owner/OwnerSellListedScreen';
import OwnerSellHomeScreen from '../screens/owner/OwnerSellHomeScreen';
import MarketplaceOrdersScreen from '../screens/owner/MarketplaceOrdersScreen';
import MarketplaceListingDetailsScreen from '../screens/owner/MarketplaceListingDetailsScreen';
// Shared device pickers — also used by the owner sell mobile flow.
import SelectCategoryScreen from '../screens/shared/device/SelectCategoryScreen';
import SelectBrandScreen from '../screens/shared/device/SelectBrandScreen';
import SelectSeriesScreen from '../screens/shared/device/SelectSeriesScreen';
import SelectModelScreen from '../screens/shared/device/SelectModelScreen';
import SelectVariantScreen from '../screens/shared/device/SelectVariantScreen';
// Shared sell-flow screens — also used by the owner-list (Detailed / Dead Short) paths.
import SellScreeningScreen from '../screens/shared/sell/SellScreeningScreen';
import SellScreenConditionScreen from '../screens/shared/sell/SellScreenConditionScreen';
import SellFunctionalScreen from '../screens/shared/sell/SellFunctionalScreen';
import SellDeviceConfigScreen from '../screens/shared/sell/SellDeviceConfigScreen';
import SellAccessoriesWarrantyScreen from '../screens/shared/sell/SellAccessoriesWarrantyScreen';
import SellImagesScreen from '../screens/shared/sell/SellImagesScreen';
import PickupRequestsScreen from '../screens/owner/PickupRequestsScreen';
import ReportsScreen from '../screens/owner/ReportsScreen';
import OwnerPersonalInfoScreen from '../screens/owner/OwnerPersonalInfoScreen';
import OwnerShopInfoScreen from '../screens/owner/OwnerShopInfoScreen';
import OwnerKycIntroScreen from '../screens/owner/OwnerKycIntroScreen';
import OwnerKycUploadScreen from '../screens/owner/OwnerKycUploadScreen';
import OwnerKycReviewScreen from '../screens/owner/OwnerKycReviewScreen';
import OwnerKycPendingScreen from '../screens/owner/OwnerKycPendingScreen';
import OwnerKycViewScreen from '../screens/owner/OwnerKycViewScreen';
import OwnerPickupSlotsScreen from '../screens/owner/OwnerPickupSlotsScreen';
import OwnerPickupServiceListScreen from '../screens/owner/OwnerPickupServiceListScreen';
import OwnerPickupServiceDetailScreen from '../screens/owner/OwnerPickupServiceDetailScreen';
import OwnerEmployeeListScreen from '../screens/owner/OwnerEmployeeListScreen';
import OwnerEmployeeDetailScreen from '../screens/owner/OwnerEmployeeDetailScreen';
import OwnerEmployeeCreatedScreen from '../screens/owner/OwnerEmployeeCreatedScreen';
import OwnerEmployeeAddScreen from '../screens/owner/OwnerEmployeeAddScreen';
import OwnerEmployeeAttendanceScreen from '../screens/owner/OwnerEmployeeAttendanceScreen';
import OwnerEmployeeLeaveScreen from '../screens/owner/OwnerEmployeeLeaveScreen';
import OwnerEmployeeSalaryReportScreen from '../screens/owner/OwnerEmployeeSalaryReportScreen';
import OwnerEmployeePayslipScreen from '../screens/owner/OwnerEmployeePayslipScreen';
import OwnerEmployeeShiftDetailsScreen from '../screens/owner/OwnerEmployeeShiftDetailsScreen';
import OwnerEmployeeWorkingRecordScreen from '../screens/owner/OwnerEmployeeWorkingRecordScreen';
import OwnerEmployeePickupReportScreen from '../screens/owner/OwnerEmployeePickupReportScreen';
import OwnerEmployeeAddAdvanceScreen from '../screens/owner/OwnerEmployeeAddAdvanceScreen';
import OwnerEmployeeApplyLeaveScreen from '../screens/owner/OwnerEmployeeApplyLeaveScreen';
import OwnerQrCodeScreen from '../screens/owner/OwnerQrCodeScreen';
import RepairServiceBookingShop from '../screens/owner/service-booking-shop/RepairServiceBookingShop';
import ShopServiceStatusScreen from '../screens/owner/ShopServiceStatusScreen';
import OwnerLeaveRequestsScreen from '../screens/owner/OwnerLeaveRequestsScreen';
import ShopChatInboxScreen from '../screens/owner/chat/ShopChatInboxScreen';
import ShopChatThreadScreen from '../screens/owner/chat/ShopChatThreadScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const OWNER_TAB_ICONS = {
  Home: LayoutGrid,
  Bookings: FileText,
  Billing: Receipt,
  Buy: ShoppingBag,
  Sell: Tag,
  MyAccount: UserCircle,
};

function OwnerTabs({ onLogout }) {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 70 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarActiveTintColor: '#00008B',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarIcon: ({ color, focused }) => {
          const Icon = OWNER_TAB_ICONS[route.name] || LayoutGrid;
          return (
            <View
              style={{
                width: 44,
                height: 30,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: focused ? '#EEF2FF' : 'transparent',
              }}
            >
              <Icon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" options={{ title: 'Home' }}>
        {(props) => <DashboardScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Bookings" component={BookingHistoryScreen} />
      <Tab.Screen name="Billing" component={BillingScreen} />
      <Tab.Screen name="Buy" component={BuyScreen} options={{ title: 'Buy' }} />
      <Tab.Screen
        name="Sell"
        component={OwnerSellHomeScreen}
        options={{ title: 'Sell' }}
        initialParams={{ flow: 'OWNER_LIST' }}
      />
      <Tab.Screen name="MyAccount" options={{ title: 'My Account' }}>
        {(props) => <MyAccountScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function OwnerNavigator({ session, onLogout }) {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.headerBg },
        headerShadowVisible: true,
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: colors.headerText },
        headerTitleAlign: 'center',
        headerTitleAllowFontScaling: false,
        headerLeft: () => {
          if (!navigation.canGoBack()) return null;
          return <BackButton onPress={() => navigation.goBack()} />;
        },
        headerBackVisible: false,
      })}
    >
      <Stack.Screen name="OwnerTabs" options={{ headerShown: false }}>
        {(props) => <OwnerTabs {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="RepairServiceBookingShop" component={RepairServiceBookingShop} options={{ headerShown: false }} />
      <Stack.Screen name="ShopServiceStatus" component={ShopServiceStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditBooking" component={EditBookingScreen} options={{ title: 'Edit Booking' }} />
      <Stack.Screen name="LegacyDeviceInformation" component={DeviceInformationScreen} options={{ title: 'Device Information' }} />
      <Stack.Screen name="LegacyDeviceMissingParts" component={DeviceMissingPartsScreen} options={{ title: 'Device Missing Parts' }} />
      <Stack.Screen name="LegacyDeviceSecurity" component={DeviceSecurityScreen} options={{ title: 'Device Security' }} />
      <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} options={{ title: 'Booking Successful' }} />
      <Stack.Screen name="BookingTimeline" component={BookingTimelineScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BarcodePrint" component={BarcodePrintScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeliveryInvoice" component={DeliveryInvoiceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="InvoiceGenerator" component={InvoiceGeneratorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeliveryInvoiceReport" component={DeliveryInvoiceReportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingStatus" component={BookingStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingStatusReport" component={BookingStatusReportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingPreviousReport" component={BookingPreviousReportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LegacyAssignTechnician" component={AssignTechnicianScreen} options={{ title: 'Assign Technician' }} />
      <Stack.Screen name="MarketplaceSell" component={MarketplaceSellScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerBuyListingDetails" component={OwnerBuyListingDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerSellMobile" component={OwnerSellMobileChoiceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerSellSpareParts" component={OwnerSellSparePartsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerSellChooseSalesCategory" component={OwnerSellChooseSalesCategoryScreen} options={{ headerShown: false }} />
      {/* Shared device pickers — screens render their own ScreenHeader, so
          hide the native stack header to avoid the "two headers stacked" bug. */}
      <Stack.Screen name="SelectCategory" component={SelectCategoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectBrand" component={SelectBrandScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectSeries" component={SelectSeriesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectModel" component={SelectModelScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectVariant" component={SelectVariantScreen} options={{ title: 'Your Device' }} />
      {/* Shared sell-flow screens (also registered in the customer stack). */}
      <Stack.Screen name="SellScreening" component={SellScreeningScreen} options={{ title: 'Screening Question' }} />
      <Stack.Screen name="SellScreenCondition" component={SellScreenConditionScreen} options={{ title: 'Screen' }} />
      <Stack.Screen name="SellFunctional" component={SellFunctionalScreen} options={{ title: 'Functional' }} />
      <Stack.Screen name="SellDeviceConfig" component={SellDeviceConfigScreen} options={{ title: 'Device Configuration' }} />
      <Stack.Screen name="SellAccessoriesWarranty" component={SellAccessoriesWarrantyScreen} options={{ title: 'Accessoires & Warranty' }} />
      <Stack.Screen name="SellImages" component={SellImagesScreen} options={{ title: 'Sell Device Images' }} />
      <Stack.Screen name="OwnerSellGadgetPrice" component={OwnerSellGadgetPriceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerSellListed" component={OwnerSellListedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MarketplaceOrders" component={MarketplaceOrdersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MarketplaceListingDetails" component={MarketplaceListingDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="OwnerPersonalInfo" component={OwnerPersonalInfoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerShopInfo" component={OwnerShopInfoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerKycIntro" component={OwnerKycIntroScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerKycUpload" component={OwnerKycUploadScreen} options={{ title: 'KYC Documents' }} />
      <Stack.Screen name="OwnerKycReview" component={OwnerKycReviewScreen} options={{ title: 'KYC Documents' }} />
      <Stack.Screen name="OwnerKycPending" component={OwnerKycPendingScreen} options={{ title: 'KYC Status' }} />
      <Stack.Screen name="OwnerKycView" component={OwnerKycViewScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="OwnerPickupSlots"
        component={OwnerPickupSlotsScreen}
        options={({ navigation }) => ({
          title: 'Service Pickup Options',
          headerStyle: { backgroundColor: '#15803D' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
          headerLeft: () => navigation.canGoBack() ? <GreenHeaderBack onPress={() => navigation.goBack()} /> : null,
        })}
      />
      <Stack.Screen name="OwnerPickupServiceList" component={OwnerPickupServiceListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerPickupServiceDetail" component={OwnerPickupServiceDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerEmployeeList" component={OwnerEmployeeListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerEmployeeAdd" component={OwnerEmployeeAddScreen} options={{ title: 'Add Staff' }} />
      <Stack.Screen name="OwnerEmployeeDetail" component={OwnerEmployeeDetailScreen} options={{ title: 'Employee Details' }} />
      <Stack.Screen name="OwnerEmployeeCreated" component={OwnerEmployeeCreatedScreen} options={{ title: 'Employee Created', headerShown: false }} />
      <Stack.Screen name="OwnerEmployeeAttendance" component={OwnerEmployeeAttendanceScreen} options={{ title: 'Attendance' }} />
      <Stack.Screen name="OwnerEmployeeLeave" component={OwnerEmployeeLeaveScreen} options={{ title: 'Leave details' }} />
      <Stack.Screen name="OwnerEmployeeSalaryReport" component={OwnerEmployeeSalaryReportScreen} options={{ title: 'Salary report' }} />
      <Stack.Screen name="OwnerEmployeePayslip" component={OwnerEmployeePayslipScreen} options={{ title: 'Pay slip' }} />
      <Stack.Screen name="OwnerEmployeeShiftDetails" component={OwnerEmployeeShiftDetailsScreen} options={{ title: 'Shift details' }} />
      <Stack.Screen name="OwnerEmployeeWorkingRecord" component={OwnerEmployeeWorkingRecordScreen} options={{ title: 'Working record' }} />
      <Stack.Screen name="OwnerEmployeePickupReport" component={OwnerEmployeePickupReportScreen} options={{ title: 'Pickup report' }} />
      <Stack.Screen name="OwnerEmployeeAddAdvance" component={OwnerEmployeeAddAdvanceScreen} options={{ title: 'Add advance' }} />
      <Stack.Screen name="OwnerEmployeeApplyLeave" component={OwnerEmployeeApplyLeaveScreen} options={{ title: 'Apply for leave' }} />
      <Stack.Screen name="OwnerLeaveRequests" component={OwnerLeaveRequestsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OwnerQrCode" component={OwnerQrCodeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShopChatInbox" component={ShopChatInboxScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShopChatThread" component={ShopChatThreadScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
