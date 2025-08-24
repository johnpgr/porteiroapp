import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

const AvisosTab = () => (
  <ScrollView style={styles.content}>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📢 Avisos do Condomínio</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>🛗 Manutenção do Elevador</Text>
        <Text style={styles.noticeDescription}>
          O elevador social estará em manutenção preventiva no dia 28/12/2024 das 8h às 17h.
        </Text>
        <Text style={styles.noticeTime}>Publicado em 20/12/2024 às 10:30</Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>💧 Interrupção no Fornecimento de Água</Text>
        <Text style={styles.noticeDescription}>
          Haverá interrupção no fornecimento de água no dia 30/12/2024 das 9h às 15h para
          manutenção da caixa d&apos;água.
        </Text>
        <Text style={styles.noticeTime}>Publicado em 18/12/2024 às 14:15</Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>🎄 Festa de Fim de Ano</Text>
        <Text style={styles.noticeDescription}>
          Convidamos todos os moradores para a festa de fim de ano que acontecerá no salão de
          festas no dia 31/12/2024 às 20h.
        </Text>
        <Text style={styles.noticeTime}>Publicado em 15/12/2024 às 16:45</Text>
      </View>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noticeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noticeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noticeTime: {
    fontSize: 12,
    color: '#999',
  },
});

export default AvisosTab;