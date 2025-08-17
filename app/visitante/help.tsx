import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HelpScreen() {
  const handleCall = (number: string) => {
    Alert.alert('Fazer Ligação', `Deseja ligar para ${number}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ligar',
        onPress: () => Linking.openURL(`tel:${number}`),
      },
    ]);
  };

  const handleWhatsApp = (number: string, message: string) => {
    const url = `whatsapp://send?phone=${number}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'WhatsApp não está instalado no seu dispositivo');
    });
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda & Suporte</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Emergency Section */}
        <View style={styles.emergencySection}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning" size={24} color="#F44336" />
            <Text style={styles.emergencyTitle}>🚨 Emergência</Text>
          </View>
          <Text style={styles.emergencyText}>Em caso de emergência, ligue imediatamente:</Text>
          <View style={styles.emergencyButtons}>
            <TouchableOpacity style={styles.emergencyButton} onPress={() => handleCall('190')}>
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.emergencyButtonText}>Polícia - 190</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyButton} onPress={() => handleCall('192')}>
              <Ionicons name="medical" size={20} color="#fff" />
              <Text style={styles.emergencyButtonText}>SAMU - 192</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyButton} onPress={() => handleCall('193')}>
              <Ionicons name="flame" size={20} color="#fff" />
              <Text style={styles.emergencyButtonText}>Bombeiros - 193</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How it Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❓ Como Funciona</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Registre sua Visita</Text>
              <Text style={styles.stepDescription}>
                Preencha seus dados pessoais, número do apartamento e motivo da visita. Adicione uma
                foto para maior segurança.
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Aguarde a Autorização</Text>
              <Text style={styles.stepDescription}>
                O morador receberá uma notificação e poderá aprovar ou negar sua visita. Você será
                notificado da decisão.
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Acesse o Prédio</Text>
              <Text style={styles.stepDescription}>
                Com a aprovação, você pode acessar o prédio. O porteiro registrará sua entrada e
                saída.
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Perguntas Frequentes</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Quanto tempo demora para receber uma resposta?</Text>
            <Text style={styles.faqAnswer}>
              Após registrar sua visita, você receberá um código de confirmação. Use este código na
              tela &quot;Consultar Status&quot; para acompanhar se sua visita foi aprovada pelo
              morador.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Posso registrar uma visita com antecedência?</Text>
            <Text style={styles.faqAnswer}>
              Sim! Você pode registrar sua visita com antecedência. O morador receberá a notificação
              e poderá aprovar para o horário desejado.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>E se minha visita for negada?</Text>
            <Text style={styles.faqAnswer}>
              Se sua visita for negada, você pode tentar entrar em contato diretamente com o morador
              através dos contatos disponíveis na seção &quot;Contatos&quot; desta tela.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Preciso levar documento?</Text>
            <Text style={styles.faqAnswer}>
              Sim, sempre leve um documento com foto. O porteiro pode solicitar para confirmar sua
              identidade.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Posso cancelar uma visita registrada?</Text>
            <Text style={styles.faqAnswer}>
              Sim, entre em contato com a portaria ou com o morador para cancelar. É importante
              avisar para evitar transtornos.
            </Text>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 Contatos</Text>

          <View style={styles.contactCard}>
            <Ionicons name="business" size={24} color="#2196F3" />
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Portaria do Prédio</Text>
              <Text style={styles.contactDescription}>Para informações gerais</Text>
              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleCall('(11) 1234-5678')}>
                  <Ionicons name="call" size={16} color="#2196F3" />
                  <Text style={styles.contactButtonText}>Ligar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() =>
                    handleWhatsApp('5511123456789', 'Olá, preciso de ajuda com o acesso ao prédio.')
                  }>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={[styles.contactButtonText, { color: '#25D366' }]}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.contactCard}>
            <Ionicons name="settings" size={24} color="#FF9800" />
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Suporte Técnico</Text>
              <Text style={styles.contactDescription}>Problemas com o aplicativo</Text>
              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleEmail('suporte@porteiroapp.com')}>
                  <Ionicons name="mail" size={16} color="#FF9800" />
                  <Text style={[styles.contactButtonText, { color: '#FF9800' }]}>E-mail</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() =>
                    handleWhatsApp(
                      '5511987654321',
                      'Preciso de suporte técnico para o PorteiroApp.'
                    )
                  }>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={[styles.contactButtonText, { color: '#25D366' }]}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.contactCard}>
            <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Administração</Text>
              <Text style={styles.contactDescription}>Questões administrativas</Text>
              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleCall('(11) 8765-4321')}>
                  <Ionicons name="call" size={16} color="#4CAF50" />
                  <Text style={[styles.contactButtonText, { color: '#4CAF50' }]}>Ligar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleEmail('admin@predio.com')}>
                  <Ionicons name="mail" size={16} color="#4CAF50" />
                  <Text style={[styles.contactButtonText, { color: '#4CAF50' }]}>E-mail</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Dicas Importantes</Text>

          <View style={styles.tipCard}>
            <Ionicons name="time" size={20} color="#FF9800" />
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Horário de Funcionamento:</Text> O sistema funciona 24h,
              mas considere o horário de descanso dos moradores.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="camera" size={20} color="#2196F3" />
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Foto:</Text> Adicionar uma foto aumenta a confiança e
              acelera o processo de aprovação.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="document-text" size={20} color="#4CAF50" />
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Documento:</Text> Sempre tenha um documento com foto em
              mãos para apresentar na portaria.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="checkmark-circle" size={20} color="#9C27B0" />
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Confirmação:</Text> Confirme os dados antes de enviar.
              Informações incorretas podem causar atrasos.
            </Text>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoTitle}>PorteiroApp</Text>
          <Text style={styles.appInfoVersion}>Versão 1.0.0</Text>
          <Text style={styles.appInfoDescription}>
            Sistema inteligente de gestão de visitantes para prédios residenciais
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  emergencySection: {
    backgroundColor: '#FFEBEE',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginLeft: 10,
  },
  emergencyText: {
    fontSize: 14,
    color: '#D32F2F',
    marginBottom: 15,
  },
  emergencyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emergencyButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  section: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  stepCard: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  faqItem: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  contactContent: {
    flex: 1,
    marginLeft: 15,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 10,
  },
  tipBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  appInfo: {
    alignItems: 'center',
    padding: 30,
    marginBottom: 20,
  },
  appInfoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 5,
  },
  appInfoVersion: {
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
  },
  appInfoDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
