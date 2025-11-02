import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';
import { notificationApi } from '../../services/notificationApi';
import { uploadDeliveryPhoto } from '../../services/photoUploadService';
import { notifyResidentsVisitorArrival } from '../../services/pushNotificationService';
import { Modal } from '~/components/Modal';
import { CameraModal } from '~/components/shared/CameraModal';

type FlowStep = 'apartamento' | 'empresa' | 'destinatario' | 'descricao' | 'observacoes' | 'foto' | 'confirmacao';

interface RegistrarEncomendaProps {
  onClose: () => void;
  onConfirm?: (message: string) => void;
}

const empresasEntrega = [
  { id: 'ifood', nome: 'iFood', icon: '🍔', cor: '#EA1D2C' },
  { id: 'rappi', nome: 'Rappi', icon: '🛵', cor: '#FF441F' },
  { id: 'mercadolivre', nome: 'Mercado Livre', icon: '🛒', cor: '#FFE600' },
  { id: 'shopee', nome: 'Shopee', icon: '🛍️', cor: '#EE4D2D' },
  { id: 'aliexpress', nome: 'AliExpress', icon: '📦', cor: '#FF6A00' },
  { id: 'amazon', nome: 'Amazon', icon: '📋', cor: '#FF9900' },
  { id: 'correios', nome: 'Correios', icon: '📮', cor: '#FFD700' },
  { id: 'uber', nome: 'Uber Eats', icon: '🚗', cor: '#000000' },
  { id: 'outros', nome: 'Outros', icon: '📦', cor: '#666666' },
];

interface Apartment {
  id: string;
  number: string;
  floor: number;
}

export default function RegistrarEncomenda({ onClose, onConfirm }: RegistrarEncomendaProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('apartamento');
  const [apartamento, setApartamento] = useState('');
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [availableApartments, setAvailableApartments] = useState<Apartment[]>([]);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);
  const [doormanBuildingId, setDoormanBuildingId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<(typeof empresasEntrega)[0] | null>(
    null
  );
  const [nomeDestinatario, setNomeDestinatario] = useState('');
  const [descricaoEncomenda, setDescricaoEncomenda] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoTirada, setFotoTirada] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Obter building_id do porteiro
  useEffect(() => {
    const getDoormanBuildingId = async () => {
      if (user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('building_id')
          .eq('id', user.id)
          .single();

        if (profile && profile.building_id) {
          setDoormanBuildingId(profile.building_id);
        } else {
          console.error('Erro ao buscar building_id do porteiro:', error);
          Alert.alert('Erro', 'Não foi possível identificar o prédio do porteiro.');
        }
      }
    };

    getDoormanBuildingId();
  }, [user]);

  // Carregar apartamentos disponíveis
  useEffect(() => {
    const fetchAvailableApartments = async () => {
      if (doormanBuildingId) {
        setIsLoadingApartments(true);
        try {
          const { data: apartments, error } = await supabase
            .from('apartments')
            .select('id, number, floor')
            .eq('building_id', doormanBuildingId)
            .order('number');

          if (error) {
            console.error('Erro ao buscar apartamentos:', error);
            Alert.alert('Erro', 'Não foi possível carregar os apartamentos.');
          } else {
            setAvailableApartments(apartments || []);
          }
        } catch (error) {
          console.error('Erro ao buscar apartamentos:', error);
          Alert.alert('Erro', 'Não foi possível carregar os apartamentos.');
        } finally {
          setIsLoadingApartments(false);
        }
      }
    };

    fetchAvailableApartments();
  }, [doormanBuildingId]);

  const renderNumericKeypad = (
    value: string,
    setValue: (val: string) => void,
    onNext: () => void
  ) => (
    <View style={styles.keypadContainer}>
      <View style={styles.displayContainer}>
        <Text style={styles.displayLabel}>Número do Apartamento</Text>
        <Text style={styles.displayValue}>{value || '___'}</Text>
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map((item, index) => {
          const isBackspace = item === '⌫';
          const isConfirm = item === '✓';
          const num = typeof item === 'number' ? item : null;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.keypadButton,
                isConfirm && styles.confirmButton
              ]}
              onPress={() => {
                if (isBackspace) {
                  setValue(value.slice(0, -1));
                } else if (isConfirm) {
                  onNext();
                } else if (num !== null) {
                  setValue(value + num.toString());
                }
              }}
              disabled={isConfirm && !value}>
              <Text style={isConfirm ? styles.confirmButtonText : styles.keypadButtonText}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Função para agrupar apartamentos por andar
  const groupApartmentsByFloor = () => {
    const grouped = availableApartments.reduce((acc, apartment) => {
      const floor = apartment.floor || 0;
      if (!acc[floor]) {
        acc[floor] = [];
      }
      acc[floor].push(apartment);
      return acc;
    }, {} as Record<number, typeof availableApartments>);
    
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(floor => ({ floor, apartments: grouped[floor] }));
  };

  const renderApartamentoStep = () => {
    const handleApartmentConfirm = async () => {
      if (!apartamento) {
        Alert.alert('Erro', 'Digite o número do apartamento.');
        return;
      }

      // Buscar o apartamento pelo número digitado
      const foundApartment = availableApartments.find(
        (apt) => apt.number === apartamento
      );

      if (!foundApartment) {
        Alert.alert(
          'Erro',
          `Apartamento ${apartamento} não encontrado. Verifique o número e tente novamente.`
        );
        return;
      }

      if (!foundApartment.id) {
        Alert.alert('Erro', 'Apartamento inválido. Tente novamente.');
        return;
      }

      // Validar se há moradores cadastrados no apartamento
      try {
        console.log('🔍 [RegistrarEncomenda] Verificando moradores no apartamento:', foundApartment.id);
        
        const { data: residents, error: residentsError } = await supabase
          .from('apartment_residents')
          .select('profile_id')
          .eq('apartment_id', foundApartment.id)
          .limit(1);

        if (residentsError) {
          console.error('❌ [RegistrarEncomenda] Erro ao verificar moradores:', residentsError);
          Alert.alert('Erro', 'Não foi possível verificar os moradores do apartamento. Tente novamente.');
          return;
        }

        if (!residents || residents.length === 0) {
          console.log('⚠️ [RegistrarEncomenda] Nenhum morador encontrado no apartamento:', apartamento);
          Alert.alert(
            'Apartamento sem Residentes',
            `Não há residentes cadastrados no apartamento ${apartamento}. Não é possível registrar encomendas para este apartamento.`,
            [{ text: 'OK' }]
          );
          return;
        }

        console.log('✅ [RegistrarEncomenda] Moradores encontrados no apartamento:', residents.length);
      } catch (error) {
        console.error('❌ [RegistrarEncomenda] Erro na validação de moradores:', error);
        Alert.alert('Erro', 'Erro ao validar apartamento. Tente novamente.');
        return;
      }

      setSelectedApartment(foundApartment);
      console.log('Apartamento selecionado com sucesso:', {
        id: foundApartment.id,
        number: foundApartment.number,
      });
      setCurrentStep('empresa');
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Apartamento</Text>
        <Text style={styles.stepSubtitle}>Digite o número do apartamento</Text>

        {isLoadingApartments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando apartamentos...</Text>
          </View>
        ) : availableApartments.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>⚠️ Nenhum Apartamento</Text>
            <Text style={styles.errorText}>
              Não há apartamentos cadastrados neste prédio.
            </Text>
          </View>
        ) : (
          renderNumericKeypad(apartamento, setApartamento, handleApartmentConfirm)
        )}
      </View>
    );
  };

  const renderEmpresaStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Empresa de Entrega</Text>
      <Text style={styles.stepSubtitle}>Selecione a empresa ou serviço</Text>

      <ScrollView style={styles.empresasContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.empresasGrid}>
          {empresasEntrega.map((empresa) => (
            <TouchableOpacity
              key={empresa.id}
              style={[
                styles.empresaButton,
                { borderColor: empresa.cor },
                empresaSelecionada?.id === empresa.id && { backgroundColor: empresa.cor + '20' },
                empresaSelecionada?.id === empresa.id && styles.empresaButtonSelected,
              ]}
              onPress={() => {
                setEmpresaSelecionada(empresa);
                setCurrentStep('destinatario');
              }}>
              <Text style={styles.empresaIcon}>{empresa.icon}</Text>
              <Text style={styles.empresaNome}>{empresa.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderDestinatarioStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Destinatário</Text>
      <Text style={styles.stepSubtitle}>Digite o nome do destinatário</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={nomeDestinatario}
          onChangeText={setNomeDestinatario}
          placeholder="Nome do destinatário"
          autoFocus
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.nextButton, !nomeDestinatario && styles.nextButtonDisabled]}
          onPress={() => {
            if (nomeDestinatario.trim()) {
              setCurrentStep('descricao');
            }
          }}
          disabled={!nomeDestinatario.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDescricaoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Descrição da Encomenda</Text>
      <Text style={styles.stepSubtitle}>Descreva o conteúdo da encomenda</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={descricaoEncomenda}
          onChangeText={setDescricaoEncomenda}
          placeholder="Ex: Caixa com roupas, eletrônicos, documentos..."
          multiline
          numberOfLines={4}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.nextButton, !descricaoEncomenda.trim() && styles.nextButtonDisabled]}
          onPress={() => {
            if (descricaoEncomenda.trim()) {
              setCurrentStep('observacoes');
            }
          }}
          disabled={!descricaoEncomenda.trim()}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderObservacoesStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Observações</Text>
      <Text style={styles.stepSubtitle}>Adicione observações (opcional)</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={observacoes}
          onChangeText={setObservacoes}
          placeholder="Observações sobre a encomenda..."
          multiline
          numberOfLines={4}
          autoFocus
        />

        <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentStep('foto')}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Função para solicitar permissão da câmera
  const requestCameraPermission = async () => {
    const result = await requestPermission();
    return result?.granted || false;
  };

  const renderFotoStep = () => {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Foto da Encomenda</Text>
        <Text style={styles.stepSubtitle}>Tire uma foto da encomenda ou do entregador (opcional)</Text>

        {fotoTirada && photoUri ? (
          <View style={styles.photoSuccessContainer}>
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            </View>
            <View style={styles.photoSuccessIcon}>
              <Text style={styles.photoSuccessEmoji}>✅</Text>
            </View>
            <Text style={styles.photoSuccessTitle}>Foto capturada com sucesso!</Text>
            <Text style={styles.photoSuccessText}>
              {photoUrl ? 'A foto foi enviada com sucesso.' : 'A foto da encomenda foi registrada.'}
            </Text>
            <View style={styles.photoActionsContainer}>
              <TouchableOpacity
                style={styles.retakePhotoButton}
                onPress={() => {
                  setFotoTirada(false);
                  setPhotoUri(null);
                  setPhotoUrl(null);
                  setShowCameraModal(true);
                }}>
                <Text style={styles.retakePhotoButtonText}>Tirar Nova Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => setCurrentStep('confirmacao')}>
                <Text style={styles.continueButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cameraPromptContainer}>
            <Text style={styles.cameraPromptIcon}>📸</Text>
            <Text style={styles.cameraPromptText}>
              A foto da encomenda é opcional, mas recomendada como comprovante.
            </Text>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => setShowCameraModal(true)}>
              <Text style={styles.nextButtonText}>Abrir Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setCurrentStep('confirmacao')}>
              <Text style={styles.skipButtonText}>Pular Foto</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderConfirmacaoStep = () => {
    const handleConfirm = async () => {
      // 🚫 PROTEÇÃO CRÍTICA: Prevenir múltiplas execuções simultâneas
      if (isLoading) {
        console.log('⚠️ [RegistrarEncomenda] Tentativa de submissão duplicada BLOQUEADA');
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔒 [RegistrarEncomenda] Submissão bloqueada - isLoading = true');

        // Validar se apartamento foi selecionado
        if (!selectedApartment || !selectedApartment.id) {
          Alert.alert('Erro', 'Selecione um apartamento válido.');
          setIsLoading(false);
          return;
        }

        // Verificar se o porteiro está logado e tem building_id
        if (!user || !doormanBuildingId) {
          Alert.alert('Erro', 'Porteiro não identificado. Faça login novamente.');
          setIsLoading(false);
          return;
        }

        if (!empresaSelecionada || !nomeDestinatario || !descricaoEncomenda) {
          Alert.alert('Erro', 'Todos os campos obrigatórios devem ser preenchidos');
          setIsLoading(false);
          return;
        }

        const currentTime = new Date().toISOString();

        console.log('Dados da entrega preparados:', {
          apartment_id: selectedApartment.id,
          building_id: doormanBuildingId,
          recipient_name: nomeDestinatario,
          delivery_company: empresaSelecionada.nome,
          description: descricaoEncomenda,
          notes: observacoes || null,
          photo_url: photoUrl
        });
        
        console.log('🖼️ Estado atual do photoUrl:', photoUrl);
        console.log('📸 Estado atual do fotoTirada:', fotoTirada);

        console.log('💾 Dados da encomenda a serem salvos:', {
          apartment_id: selectedApartment.id,
          building_id: doormanBuildingId,
          recipient_name: nomeDestinatario,
          delivery_company: empresaSelecionada.nome,
          description: descricaoEncomenda,
          notification_status: 'delivered',
          received_at: currentTime,
          notes: observacoes || null,
          photo_url: photoUrl
        });
        console.log('💾 PhotoUrl no momento do salvamento:', photoUrl);

        // Inserir dados na tabela deliveries
        const { data: deliveryData, error: deliveryError } = await supabase
          .from('deliveries')
          .insert({
            apartment_id: selectedApartment.id,
            building_id: doormanBuildingId,
            recipient_name: nomeDestinatario,
            delivery_company: empresaSelecionada.nome,
            description: descricaoEncomenda,
            notification_status: 'delivered',
            received_at: currentTime,
            notes: observacoes || null,
            photo_url: photoUrl,
            is_active: true
          })
          .select('id')
          .single();

        if (deliveryError) {
          console.error('Erro ao inserir entrega:', deliveryError);
          Alert.alert('Erro ao registrar entrega', 'Não foi possível salvar os dados da entrega. Tente novamente.');
          setIsLoading(false);
          return;
        }

        console.log('Entrega inserida com sucesso');

        // Inserir dados na tabela visitor_logs (sem criar visitante) e capturar o ID
        const { data: visitorLogData, error: logError } = await supabase
          .from('visitor_logs')
          .insert({
            visitor_id: null,
            apartment_id: selectedApartment.id,
            building_id: doormanBuildingId,
            authorized_by: user.id,
            log_time: currentTime,
            tipo_log: 'IN',
            visit_session_id: null,
            purpose: `Entrega: ${descricaoEncomenda}`,
            entry_type: 'delivery',
            notification_status: 'pending',
            requires_resident_approval: true,
            notification_sent_at: null,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
            delivery_sender: empresaSelecionada.nome,
            delivery_description: descricaoEncomenda,
            guest_name: `Entrega de ${empresaSelecionada.nome}`,
            created_at: currentTime
          })
          .select('id')
          .single();

        if (logError) {
          console.error('Erro ao salvar log de visitante:', logError);
          Alert.alert('Erro', 'Entrega registrada, mas houve problema ao salvar o log.');
          setIsLoading(false);
          return;
        }

        console.log('Log de visitante inserido com sucesso:', visitorLogData);

        // Enviar notificação push para os moradores via Edge Function
        try {
          console.log('📱 [RegistrarEncomenda] ==================== INICIO PUSH NOTIFICATION ====================');
          console.log('📱 [RegistrarEncomenda] Apartamento ID:', selectedApartment.id);
          console.log('📱 [RegistrarEncomenda] Apartamento Number:', selectedApartment.number);
          console.log('📱 [RegistrarEncomenda] Empresa:', empresaSelecionada.nome);

          // Verificar se há moradores com push_token neste apartamento
          const { data: residentsCheck, error: checkError } = await supabase
            .from('apartment_residents')
            .select('profile_id, profiles!inner(id, full_name, push_token, notification_enabled, user_type)')
            .eq('apartment_id', selectedApartment.id);

          console.log('🔍 [RegistrarEncomenda] Verificação de moradores:', {
            apartmentId: selectedApartment.id,
            residentsCount: residentsCheck?.length,
            error: checkError,
            residents: residentsCheck?.map((r: any) => ({
              name: r.profiles?.full_name,
              user_type: r.profiles?.user_type,
              has_token: !!r.profiles?.push_token,
              notification_enabled: r.profiles?.notification_enabled,
              token_preview: r.profiles?.push_token ? r.profiles.push_token.substring(0, 20) + '...' : null
            }))
          });

          console.log('📱 [RegistrarEncomenda] Chamando notifyResidentsVisitorArrival...');

          const pushResult = await notifyResidentsVisitorArrival({
            apartmentIds: [selectedApartment.id],
            visitorName: `Entrega de ${empresaSelecionada.nome}`,
            apartmentNumber: selectedApartment.number,
            purpose: `Encomenda: ${descricaoEncomenda}`,
            photoUrl: photoUrl || undefined,
          });

          console.log('📱 [RegistrarEncomenda] Resultado completo do push:', JSON.stringify(pushResult, null, 2));

          if (pushResult.success && pushResult.sent > 0) {
            console.log(`✅ [RegistrarEncomenda] Push notification enviada para ${pushResult.sent} morador(es)`);
          } else {
            console.warn('⚠️ [RegistrarEncomenda] Push notification não enviada:', pushResult.message);
            console.warn('⚠️ [RegistrarEncomenda] Total tokens encontrados:', pushResult.total);
            console.warn('⚠️ [RegistrarEncomenda] Enviados:', pushResult.sent);
            console.warn('⚠️ [RegistrarEncomenda] Falhas:', pushResult.failed);
          }
          console.log('📱 [RegistrarEncomenda] ==================== FIM PUSH NOTIFICATION ====================');
        } catch (pushError) {
          console.error('❌ [RegistrarEncomenda] Erro ao enviar push notification:', pushError);
          console.error('❌ [RegistrarEncomenda] Stack:', pushError instanceof Error ? pushError.stack : 'N/A');
          // Não bloqueia o fluxo se a notificação push falhar
        }

        // 🚫 PROTEÇÃO CRÍTICA WHATSAPP: Verificar se notificação já foi enviada
        console.log('📱 [RegistrarEncomenda] Verificando se WhatsApp já foi enviado...');

        if (!visitorLogData?.id) {
          console.warn('⚠️ [RegistrarEncomenda] Visitor log ID não encontrado - pulando notificação');
        } else {
          // Buscar se WhatsApp já foi enviado (notification_sent_at != null)
          const { data: currentLog } = await supabase
            .from('visitor_logs')
            .select('notification_sent_at')
            .eq('id', visitorLogData.id)
            .single();

          const alreadySent = currentLog?.notification_sent_at !== null;
          console.log('📋 [RegistrarEncomenda] WhatsApp já enviado?', alreadySent);

          // Enviar notificação WhatsApp APENAS se ainda não foi enviada
          if (!alreadySent) {
            try {
              console.log('📱 [RegistrarEncomenda] Enviando notificação WhatsApp...');

              // Buscar dados do morador proprietário
              const { data: residentData, error: residentError } = await supabase
                .from('apartment_residents')
                .select('profiles!inner(full_name, phone)')
                .eq('apartment_id', selectedApartment.id)
                .eq('is_owner', true)
                .single();

              if (residentError) {
                console.error('❌ [RegistrarEncomenda] Erro ao buscar dados do morador:', residentError);
              } else if (residentData && residentData.profiles.phone) {
                // Buscar dados do prédio
                const { data: buildingData, error: buildingError } = await supabase
                  .from('buildings')
                  .select('name')
                  .eq('id', doormanBuildingId)
                  .single();

                if (buildingError) {
                  console.error('❌ [RegistrarEncomenda] Erro ao buscar dados do prédio:', buildingError);
                } else {
                  console.log('📱 [RegistrarEncomenda] Enviando WhatsApp para:', residentData.profiles.full_name);

                  // Enviar notificação de entrega aguardando aprovação
                  await notificationApi.sendVisitorWaitingNotification({
                    visitor_name: `Entrega de ${empresaSelecionada.nome}`,
                    resident_phone: residentData.profiles.phone,
                    resident_name: residentData.profiles.full_name,
                    building: buildingData?.name || 'Seu prédio',
                    apartment: selectedApartment.number,
                    visitor_log_id: visitorLogData.id
                  });

                  console.log('✅ [RegistrarEncomenda] Mensagem WhatsApp enviada com sucesso');

                  // Atualizar notification_sent_at IMEDIATAMENTE para evitar reenvios
                  await supabase
                    .from('visitor_logs')
                    .update({ notification_sent_at: new Date().toISOString() })
                    .eq('id', visitorLogData.id);

                  console.log('✅ [RegistrarEncomenda] notification_sent_at atualizado - bloqueio ativado');
                }
              }
            } catch (notificationError) {
              console.error('❌ [RegistrarEncomenda] Erro ao enviar notificação WhatsApp:', notificationError);
              // Não bloquear o fluxo principal se a notificação falhar
            }
          } else {
            console.log('🚫 [RegistrarEncomenda] WhatsApp já enviado (notification_sent_at != null) - bloqueando reenvio');
          }
        }

        const message = `Encomenda registrada com sucesso para o apartamento ${selectedApartment.number}. O morador foi notificado e deve escolher o destino da entrega.`;

        if (onConfirm) {
          onConfirm(message);
        } else {
          Alert.alert('✅ Encomenda Registrada!', message, [{ text: 'OK' }]);
          onClose();
        }
      } catch (error) {
        console.error('Erro ao registrar encomenda:', error);
        Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
      } finally {
        setIsLoading(false);
        // Reset form
        setCurrentStep('apartamento');
        setApartamento('');
        setSelectedApartment(null);
        setEmpresaSelecionada(null);
        setNomeDestinatario('');
        setDescricaoEncomenda('');
        setObservacoes('');
        setFotoTirada(false);
      }
    };

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Confirmação</Text>
        <Text style={styles.stepSubtitle}>Revise os dados da encomenda</Text>

        <View style={styles.confirmationContainer}>
          <View style={styles.confirmationItem}>
            <Text style={styles.confirmationLabel}>🏠 Apartamento:</Text>
            <Text style={styles.confirmationValue}>{selectedApartment?.number || apartamento}</Text>
          </View>

          <View style={styles.confirmationItem}>
            <Text style={styles.confirmationLabel}>🚚 Empresa:</Text>
            <Text style={styles.confirmationValue}>{empresaSelecionada?.nome}</Text>
          </View>

          <View style={styles.confirmationItem}>
            <Text style={styles.confirmationLabel}>👤 Destinatário:</Text>
            <Text style={styles.confirmationValue}>{nomeDestinatario}</Text>
          </View>

          <View style={styles.confirmationItem}>
            <Text style={styles.confirmationLabel}>📦 Descrição:</Text>
            <Text style={styles.confirmationValue}>{descricaoEncomenda}</Text>
          </View>

          {observacoes && (
            <View style={styles.confirmationItem}>
              <Text style={styles.confirmationLabel}>📝 Observações:</Text>
              <Text style={styles.confirmationValue}>{observacoes}</Text>
            </View>
          )}

          <View style={styles.confirmationItem}>
            <Text style={styles.confirmationLabel}>📸 Foto:</Text>
            <Text style={styles.confirmationValue}>{fotoTirada ? '✅ Capturada' : '❌ Não capturada'}</Text>
          </View>
        </View>

        <View style={styles.confirmationActions}>
          <TouchableOpacity
            style={[styles.confirmFinalButton, isLoading && styles.confirmFinalButtonDisabled]}
            onPress={handleConfirm}
            disabled={isLoading}>
            {isLoading ? (
              <View style={styles.loadingButtonContent}>
                <ActivityIndicator size="small" color="#fff" style={styles.loadingSpinner} />
                <Text style={styles.confirmFinalButtonText}>Registrando...</Text>
              </View>
            ) : (
              <Text style={styles.confirmFinalButtonText}>✅ Confirmar Registro da Encomenda</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToPhotoButton} onPress={() => setCurrentStep('foto')}>
            <Text style={styles.backToPhotoButtonText}>← Voltar para Foto</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const resetForm = () => {
    setCurrentStep('apartamento');
    setApartamento('');
    setSelectedApartment(null);
    setEmpresaSelecionada(null);
    setNomeDestinatario('');
    setDescricaoEncomenda('');
    setObservacoes('');
    setFotoTirada(false);
    setPhotoUri(null);
    setPhotoUrl(null);
    setIsUploadingPhoto(false);
    setIsLoading(false);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Registrar Encomenda</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(
                  (['apartamento', 'empresa', 'destinatario', 'descricao', 'observacoes', 'foto', 'confirmacao'].indexOf(currentStep) + 1) /
                  7
                ) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {['apartamento', 'empresa', 'destinatario', 'descricao', 'observacoes', 'foto', 'confirmacao'].indexOf(currentStep) + 1} de 7
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 'apartamento' && renderApartamentoStep()}
        {currentStep === 'empresa' && renderEmpresaStep()}
        {currentStep === 'destinatario' && renderDestinatarioStep()}
        {currentStep === 'descricao' && renderDescricaoStep()}
        {currentStep === 'observacoes' && renderObservacoesStep()}
        {currentStep === 'foto' && renderFotoStep()}
        {currentStep === 'confirmacao' && renderConfirmacaoStep()}
      </ScrollView>

      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onPhotoCapture={(uri, url) => {
          if (uri) {
            setPhotoUri(uri);
            setPhotoUrl(url);
            setFotoTirada(true);
          }
          setCurrentStep('confirmacao');
        }}
        uploadFunction={uploadDeliveryPhoto}
        title="Foto da Encomenda"
      />
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  headerTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    padding: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5722',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  apartmentsContainer: {
    flex: 1,
  },
  apartmentsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 15,
  },
  apartmentButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  apartmentButtonSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e8',
  },
  apartmentNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  apartmentFloor: {
    fontSize: 14,
    color: '#666',
  },
  confirmationContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    gap: 15,
  },
  confirmationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  confirmationLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  confirmationValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    flex: 2,
    textAlign: 'right',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  keypadContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  displayContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  displayLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  displayValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 2,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 240,
    alignSelf: 'center',
    gap: 10,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  keypadButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },

  confirmButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  empresasContainer: {
    flex: 1,
    paddingHorizontal: 5,
  },
  empresasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  empresaButton: {
    width: '47%',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    minHeight: 100,
  },
  empresaButtonSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e8',
  },
  empresaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  empresaNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  inputContainer: {
    gap: 20,
  },
  textInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    width: '100%',
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 20,
    backgroundColor: '#000',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
  },
  cameraFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraInstructions: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cameraControls: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4CAF50',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
  },
  captureButtonText: {
    fontSize: 32,
  },
  photoSuccessContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8fff8',
    borderRadius: 20,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  photoSuccessIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoSuccessEmoji: {
    fontSize: 40,
    color: '#fff',
  },
  photoSuccessTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'center',
  },
  photoSuccessText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  photoActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retakePhotoButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  retakePhotoButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoTakenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  photoTakenText: {
    fontSize: 18,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  photoPreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPreviewText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
    textAlign: 'center',
  },
  backToPhotoButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#666',
  },
  backToPhotoButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationActions: {
    gap: 12,
  },
  retakeButton: {
    backgroundColor: '#666',
    padding: 15,
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    gap: 15,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  confirmFinalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 16,
  },
  confirmFinalButtonDisabled: {
    backgroundColor: '#cccccc',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  confirmFinalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginRight: 8,
  },
  skipButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraPromptContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 20,
  },
  cameraPromptIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cameraPromptText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  floorSection: {
    marginBottom: 20,
  },
  floorButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  floorButtonSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e8',
  },
  floorButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  floorButtonIcon: {
    fontSize: 16,
    color: '#666',
  },
});
