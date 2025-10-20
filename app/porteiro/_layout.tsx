import React, { useEffect, useRef, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

const NOTIFIED_SIGNATURES_KEY = 'porteiro_notified_signatures';

export default function PorteiroLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user, signOut } = useAuth();

  // Ref para timestamp da última verificação
  const lastCheckTimeRef = useRef<Date>(new Date());

  // Ref para armazenar assinaturas de notificações já exibidas (persiste entre re-renders)
  const notifiedSignaturesRef = useRef<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // Função para criar assinatura única por decisão
  const getDecisionSignature = (decision: any) => {
    const timestamp = new Date(decision.resident_response_at).getTime();
    const minuteTimestamp = Math.floor(timestamp / 60000); // Truncar para minuto
    return `${decision.visitor_id || 'unknown'}_${decision.notification_status}_${decision.resident_response_by}_${minuteTimestamp}`;
  };

  // Carregar assinaturas notificadas do AsyncStorage ao montar
  useEffect(() => {
    const loadNotifiedSignatures = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFIED_SIGNATURES_KEY);
        if (stored) {
          const signatures = JSON.parse(stored);
          notifiedSignaturesRef.current = new Set(signatures);
          console.log(`📦 [PorteiroLayout] ${signatures.length} assinaturas carregadas do cache`);
        }
        setIsReady(true);
      } catch (error) {
        console.error('❌ [PorteiroLayout] Erro ao carregar assinaturas notificadas:', error);
        setIsReady(true);
      }
    };

    loadNotifiedSignatures();
  }, []);

  // Sistema de notificações de decisões dos moradores
  useEffect(() => {
    // Só executar se estiver pronto e for um porteiro logado
    if (!isReady || !user || user.user_type !== 'porteiro' || !user.building_id) {
      return;
    }

    const buildingId = user.building_id;

    const checkVisitorDecisions = async () => {
      try {
        // Buscar apenas decisões DEPOIS do último check
        const lastCheckTime = lastCheckTimeRef.current.toISOString();
        const now = new Date();

        console.log(`🔍 [PorteiroLayout] Verificando decisões desde ${lastCheckTime}`);

        const { data: recentDecisions, error } = await supabase
          .from('visitor_logs')
          .select(`
            id,
            visitor_id,
            notification_status,
            resident_response_at,
            resident_response_by,
            visitors (name),
            apartments!inner (number, building_id)
          `)
          .eq('apartments.building_id', buildingId)
          .in('notification_status', ['approved', 'rejected'])
          .gte('resident_response_at', lastCheckTime)
          .not('resident_response_by', 'is', null)
          .order('resident_response_at', { ascending: false });

        if (error) {
          // Verificar se é erro JWT expirado
          if (error.code === 'PGRST303' || error.message?.includes('JWT expired')) {
            Alert.alert(
              'Sessão Expirada',
              'Sua sessão expirou. Você será redirecionado para o login.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    // Fazer logout e redirecionar
                    signOut();
                  }
                }
              ]
            );
            return;
          }
          
          console.error('❌ [PorteiroLayout] Erro ao verificar decisões:', error);
          return;
        }

        // Atualizar timestamp do último check ANTES de processar
        lastCheckTimeRef.current = now;

        console.log(`🔍 [PorteiroLayout] Query retornou ${recentDecisions?.length || 0} registros`);

        if (recentDecisions && recentDecisions.length > 0) {
          // Log detalhado dos registros encontrados
          console.log(`📊 [PorteiroLayout] Registros encontrados:`, recentDecisions.map(d => ({
            id: d.id,
            visitor_id: d.visitor_id,
            status: d.notification_status,
            response_by: d.resident_response_by,
            response_at: d.resident_response_at
          })));

          // Filtrar apenas decisões que ainda não foram notificadas usando assinatura única
          const newDecisions = recentDecisions.filter((decision) => {
            const signature = getDecisionSignature(decision);
            const isNew = !notifiedSignaturesRef.current.has(signature);
            
            if (!isNew) {
              console.log(`🔄 [PorteiroLayout] Decisão duplicada filtrada - Assinatura: ${signature}`);
            }
            
            return isNew;
          });

          if (newDecisions.length > 0) {
            console.log(`🔔 [PorteiroLayout] ${newDecisions.length} nova(s) decisão(ões) única(s) encontrada(s)`);

            // Buscar nomes dos moradores em batch
            const residentIds = [...new Set(newDecisions.map(d => d.resident_response_by).filter(Boolean))];
            const residentsMap = new Map<string, string>();

            if (residentIds.length > 0) {
              try {
                const { data: residents } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .in('id', residentIds);

                if (residents) {
                  residents.forEach(r => residentsMap.set(r.id, r.full_name));
                }
              } catch (err) {
                console.warn('⚠️ [PorteiroLayout] Erro ao buscar nomes dos moradores:', err);
              }
            }

            // Exibir alert para cada nova decisão
            for (const decision of newDecisions) {
              const visitorName = decision.visitors?.name || 'Visitante';
              const apartmentNumber = decision.apartments?.number || 'N/A';
              const moradorName = residentsMap.get(decision.resident_response_by) || 'Morador';
              const isApproved = decision.notification_status === 'approved';
              const signature = getDecisionSignature(decision);

              console.log(`📢 [PorteiroLayout] Exibindo notificação - Assinatura: ${signature}`);

              Alert.alert(
                isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Recusado',
                `O morador ${moradorName} do apartamento ${apartmentNumber} ${isApproved ? 'ACEITOU' : 'RECUSOU'} o visitante ${visitorName}.`,
                [{ text: 'OK' }]
              );

              // Adicionar assinatura ao Set de notificações já exibidas
              notifiedSignaturesRef.current.add(signature);
            }

            // Salvar assinaturas no AsyncStorage
            try {
              const signaturesArray = Array.from(notifiedSignaturesRef.current);
              // Manter apenas as últimas 100 assinaturas para não crescer infinitamente
              const recentSignatures = signaturesArray.slice(-100);
              await AsyncStorage.setItem(NOTIFIED_SIGNATURES_KEY, JSON.stringify(recentSignatures));
              console.log(`💾 [PorteiroLayout] ${recentSignatures.length} assinaturas salvas no cache`);
            } catch (saveError) {
              console.error('❌ [PorteiroLayout] Erro ao salvar assinaturas:', saveError);
            }
          } else {
            console.log('✅ [PorteiroLayout] Nenhuma decisão nova (todas já foram notificadas)');
          }
        }
      } catch (error) {
        console.error('❌ [PorteiroLayout] Exceção ao verificar decisões:', error);
      }
    };

    // Verificar imediatamente ao montar
    checkVisitorDecisions();

    // Configurar polling a cada 10 segundos
    const intervalId = setInterval(checkVisitorDecisions, 10000);

    // Cleanup: limpar interval ao desmontar
    return () => {
      clearInterval(intervalId);
      console.log('🧹 [PorteiroLayout] Polling de decisões cancelado');
    };
  }, [user, isReady]); // Dependências: user e isReady

  return (
    <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="visitor" />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="logs" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="emergency" />
    </Stack>
  );
}
