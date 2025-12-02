import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type RelationshipType = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

const relationships: RelationshipType[] = [
  {
    id: 'conjuge',
    label: 'Cônjuge',
    icon: '💑',
    description: 'Esposo(a), companheiro(a)',
  },
  {
    id: 'filho',
    label: 'Filho(a)',
    icon: '👶',
    description: 'Filhos, enteados',
  },
  {
    id: 'pai_mae',
    label: 'Pai/Mãe',
    icon: '👨‍👩‍👧‍👦',
    description: 'Pais, sogros',
  },
  {
    id: 'irmao',
    label: 'Irmão/Irmã',
    icon: '👫',
    description: 'Irmãos, cunhados',
  },
  {
    id: 'familiar',
    label: 'Outro Familiar',
    icon: '👪',
    description: 'Tios, primos, avós',
  },
  {
    id: 'amigo',
    label: 'Amigo(a)',
    icon: '👥',
    description: 'Amigos próximos',
  },
  {
    id: 'funcionario',
    label: 'Funcionário',
    icon: '🏠',
    description: 'Empregada, babá, cuidador',
  },
  {
    id: 'prestador',
    label: 'Prestador de Serviço',
    icon: '🔧',
    description: 'Técnicos, profissionais',
  },
  {
    id: 'motorista',
    label: 'Motorista',
    icon: '🚗',
    description: 'Motorista particular',
  },
  {
    id: 'outro',
    label: 'Outro',
    icon: '👤',
    description: 'Outros relacionamentos',
  },
];

export function RelacionamentoCadastro() {
  const { nome } = useLocalSearchParams<{ nome: string }>();
  const [selectedRelationship, setSelectedRelationship] = useState<string>('');

  const handleNext = () => {
    if (!selectedRelationship) {
      return;
    }

    router.push({
      pathname: '/morador/cadastro_steps/telefone',
      params: {
        nome: nome || '',
        relacionamento: selectedRelationship,
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const selectedRelationshipData = relationships.find((r) => r.id === selectedRelationship);

  return (
    <View style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>👥 Novo Cadastro</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
            </View>
            <Text style={styles.progressText}>Passo 2 de 8</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>👤 {nome}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Relacionamento</Text>
              <Text style={styles.sectionDescription}>
                Qual é o relacionamento desta pessoa com você?
              </Text>

              <ScrollView style={styles.relationshipsList} showsVerticalScrollIndicator={false}>
                {relationships.map((relationship) => (
                  <TouchableOpacity
                    key={relationship.id}
                    style={[
                      styles.relationshipCard,
                      selectedRelationship === relationship.id && styles.relationshipCardSelected,
                    ]}
                    onPress={() => setSelectedRelationship(relationship.id)}>
                    <View style={styles.relationshipIcon}>
                      <Text style={styles.relationshipIconText}>{relationship.icon}</Text>
                    </View>

                    <View style={styles.relationshipInfo}>
                      <Text
                        style={[
                          styles.relationshipLabel,
                          selectedRelationship === relationship.id &&
                            styles.relationshipLabelSelected,
                        ]}>
                        {relationship.label}
                      </Text>
                      <Text
                        style={[
                          styles.relationshipDescription,
                          selectedRelationship === relationship.id &&
                            styles.relationshipDescriptionSelected,
                        ]}>
                        {relationship.description}
                      </Text>
                    </View>

                    <View style={styles.relationshipCheck}>
                      {selectedRelationship === relationship.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedRelationshipData && (
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedInfoText}>
                    ✅ Selecionado: {selectedRelationshipData.icon} {selectedRelationshipData.label}
                  </Text>
                </View>
              )}

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  O relacionamento ajuda a definir os níveis de acesso e permissões
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backFooterButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, !selectedRelationship && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={!selectedRelationship}>
              <Text
                style={[
                  styles.nextButtonText,
                  !selectedRelationship && styles.nextButtonTextDisabled,
                ]}>
                Continuar
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={selectedRelationship ? '#fff' : '#ccc'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressStep: {
    width: 25,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  personInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  relationshipsList: {
    flex: 1,
    marginBottom: 20,
  },
  relationshipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  relationshipCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  relationshipIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  relationshipIconText: {
    fontSize: 24,
  },
  relationshipInfo: {
    flex: 1,
  },
  relationshipLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  relationshipLabelSelected: {
    color: '#2196F3',
  },
  relationshipDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  relationshipDescriptionSelected: {
    color: '#1976D2',
  },
  relationshipCheck: {
    width: 30,
    alignItems: 'center',
  },
  selectedInfo: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  selectedInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 12,
  },
  backFooterButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextButtonTextDisabled: {
    color: '#ccc',
  },
});

export default RelacionamentoCadastro;
