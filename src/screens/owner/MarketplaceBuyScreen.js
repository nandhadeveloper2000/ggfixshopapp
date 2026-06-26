import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { marketplaceApi } from '../../api/client';

export default function MarketplaceBuyScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await marketplaceApi.get('/marketplace/products', { query: { type: 'SELL', status: 'ACTIVE' } });
      setList(Array.isArray(data) ? data : data?.content ?? data?.data ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace (Buy)</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MarketplaceSell')}>
          <Text style={styles.link}>Sell</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#22C55E']} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.title}</Text>
            <Text style={styles.price}>{item.price != null ? `₹${item.price}` : '—'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No products. Data from API.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#202124' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
  link: { fontSize: 16, color: '#22C55E' },
  list: { padding: 16, paddingBottom: 32 },
  row: { backgroundColor: '#282A2D', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#3C4043' },
  name: { fontSize: 16, fontWeight: '600', color: '#F8FAFC' },
  price: { fontSize: 14, color: '#22C55E', marginTop: 4 },
  empty: { fontSize: 14, color: '#9AA0A6', textAlign: 'center', marginTop: 24 },
});
