import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import { PorteiroDashboardProvider } from '~/providers/PorteiroDashboardProvider';
import PorteiroTabsHeader from '~/components/porteiro/PorteiroTabsHeader';

const NOTIFIED_SIGNATURES_KEY = 'porteiro_notified_signatures';

interface ResidentDecision {
  id: string;
  visitor_id?: string;
  notification_status: 'approved' | 'rejected';
  resident_response_by: string;
  resident_response_at: string;
  apartments?: {
    number?: string;
    building_id?: string;
  };
  building_id?: string;
  apartment?: {
    building_id?: string;
  };
}

interface ResidentInfo {
  id: string;
  full_name?: string;
  email?: string;
}

export default function PorteiroLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user, signOut } = useAuth();
  const renderTabsHeader = useCallback(() => <PorteiroTabsHeader />, []);

  // Ref para timestamp da última verificação
  const lastCheckTimeRef = useRef<Date>(new Date());

  // Ref para armazenar assinaturas de notificações já exibidas (persiste entre re-renders)
  const notifiedSignaturesRef = useRef<Set<string>>(new Set());
  const decisionChannelRef = useRef<RealtimeChannel | null>(null);
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
  const getDecisionSignature = (decision: ResidentDecision): string => {
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
    if (decisionChannelRef.current) {
      supabase.removeChannel(decisionChannelRef.current);
      decisionChannelRef.current = null;
    }

    // Só executar se estiver pronto e for um porteiro logado
    if (!isReady || !user || user.user_type !== 'porteiro' || !user.building_id) {
      return;
    }

    const buildingId = user.building_id;
    let isActive = true;

    const handleNewDecisions = async (decisions: ResidentDecision[]) => {
      if (!isActive || !decisions || decisions.length === 0) {
        return;
      }

      const filteredDecisions = decisions.filter((decision) => {
        const decisionBuildingId =
          decision?.apartments?.building_id ??
          decision?.building_id ??
          decision?.apartment?.building_id ??
          null;

        if (decisionBuildingId && decisionBuildingId !== buildingId) {
          console.log(
            `↪️ [PorteiroLayout] Decisão ignorada por pertencer a outro prédio (${decisionBuildingId})`
          );
          return false;
        }

        if (
          !decision ||
          !['approved', 'rejected'].includes(decision.notification_status) ||
          !decision.resident_response_by ||
          !decision.resident_response_at
        ) {
          console.log('📝 [PorteiroLayout] Decisão ignorada por estar incompleta:', decision?.id);
          return false;
        }

        return true;
      });

      if (filteredDecisions.length === 0) {
        console.log('✅ [PorteiroLayout] Nenhuma decisão relevante após filtragem');
        return;
      }

      console.log(
        `📊 [PorteiroLayout] Processando ${filteredDecisions.length} decisão(ões) após filtragem`,
        filteredDecisions.map((d) => ({
          id: d.id,
          visitor_id: d.visitor_id,
          status: d.notification_status,
          response_by: d.resident_response_by,
          response_at: d.resident_response_at
        }))
      );

      const newDecisions = filteredDecisions.filter((decision) => {
        const signature = getDecisionSignature(decision);
        const isNew = signature ? !notifiedSignaturesRef.current.has(signature) : false;

        if (!isNew) {
          console.log(`🔄 [PorteiroLayout] Decisão duplicada filtrada - Assinatura: ${signature}`);
        }

        return isNew;
      });

      if (newDecisions.length === 0) {
        console.log('✅ [PorteiroLayout] Nenhuma decisão nova (todas já foram notificadas)');
        return;
      }

      console.log(`🔔 [PorteiroLayout] ${newDecisions.length} nova(s) decisão(ões) única(s) encontrada(s)`);

      const residentIds = [
        ...new Set(newDecisions.map((d) => d.resident_response_by).filter(Boolean))
      ];
      const residentsMap = new Map<string, string>();

      if (residentIds.length > 0) {
        try {
          const { data: residents, error: residentsError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', residentIds);

          if (residentsError) {
            console.warn('⚠️ [PorteiroLayout] Erro ao buscar nomes dos moradores:', residentsError);
            // Add fallback names for all residents
            for (const resId of residentIds) {
              residentsMap.set(resId, `Morador ${resId.slice(0, 8)}`);
            }
          } else if (residents) {
            residents.forEach((r) => residentsMap.set(r.id, r.full_name));
          }
        } catch (err) {
          console.warn('⚠️ [PorteiroLayout] Exceção ao buscar nomes dos moradores:', err);
          // Add fallback names for all residents
          for (const resId of residentIds) {
            residentsMap.set(resId, `Morador ${resId.slice(0, 8)}`);
          }
        }
      }

      for (const decision of newDecisions) {
        const visitorName = decision.visitors?.name || 'Visitante';
        const apartmentNumber = decision.apartments?.number || 'N/A';
        const moradorName = residentsMap.get(decision.resident_response_by) || 'Morador';
        const isApproved = decision.notification_status === 'approved';
        const signature = getDecisionSignature(decision);

        console.log(`📢 [PorteiroLayout] Exibindo notificação - Assinatura: ${signature}`);

        Alert.alert(
          isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Recusado',
          `O morador ${moradorName} do apartamento ${apartmentNumber} ${
            isApproved ? 'ACEITOU' : 'RECUSOU'
          } o visitante ${visitorName}.`,
          [{ text: 'OK' }]
        );

        if (signature) {
          notifiedSignaturesRef.current.add(signature);
        }
      }

      try {
        const signaturesArray = Array.from(notifiedSignaturesRef.current);
        const recentSignatures = signaturesArray.slice(-100);
        await AsyncStorage.setItem(NOTIFIED_SIGNATURES_KEY, JSON.stringify(recentSignatures));
        console.log(`💾 [PorteiroLayout] ${recentSignatures.length} assinaturas salvas no cache`);
      } catch (saveError) {
        console.error('❌ [PorteiroLayout] Erro ao salvar assinaturas:', saveError);
      }
    };

    const checkVisitorDecisions = async () => {
      try {
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
          if (error.code === 'PGRST303' || error.message?.includes('JWT expired')) {
            Alert.alert(
              'Sessão Expirada',
              'Sua sessão expirou. Você será redirecionado para o login.',
              [
                {
                  text: 'OK',
                  onPress: () => {
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

        lastCheckTimeRef.current = now;
        console.log(`🔍 [PorteiroLayout] Query retornou ${recentDecisions?.length || 0} registros`);

        if (recentDecisions && recentDecisions.length > 0) {
          await handleNewDecisions(recentDecisions);
        }
      } catch (error) {
        console.error('❌ [PorteiroLayout] Exceção ao verificar decisões:', error);
      }
    };

    const processRealtimePayload = async (payload: any) => {
      if (!isActive) {
        return;
      }

      try {
        if (!payload) {
          console.warn('⚠️ [PorteiroLayout] Broadcast recebido sem payload');
          return;
        }

        let decisions: any[] = [];

        if (Array.isArray(payload)) {
          decisions = payload;
        } else if (Array.isArray(payload?.decisions)) {
          decisions = payload.decisions;
        } else if (payload.decision) {
          decisions = [payload.decision];
        } else {
          const decisionId =
            payload.visitorLogId || payload.visitor_log_id || payload.visitorLogID || payload.id;

          if (!decisionId) {
            console.warn('⚠️ [PorteiroLayout] Broadcast sem identificador de decisão:', payload);
            return;
          }

          console.log(`🔄 [PorteiroLayout] Buscando decisão ${decisionId} após broadcast`);

          const { data, error } = await supabase
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
            .eq('id', decisionId)
            .eq('apartments.building_id', buildingId)
            .limit(1);

          if (error) {
            if (error.code === 'PGRST303' || error.message?.includes('JWT expired')) {
              Alert.alert(
                'Sessão Expirada',
                'Sua sessão expirou. Você será redirecionado para o login.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      signOut();
                    }
                  }
                ]
              );
              return;
            }

            console.error('❌ [PorteiroLayout] Erro ao buscar decisão via broadcast:', error);
            return;
          }

          if (!data || data.length === 0) {
            console.log('ℹ️ [PorteiroLayout] Nenhum registro encontrado ao buscar decisão via broadcast');
            return;
          }

          decisions = data;
        }

        await handleNewDecisions(decisions);
      } catch (error) {
        console.error('❌ [PorteiroLayout] Exceção ao processar payload de broadcast:', error);
      }
    };

    const setupRealtime = async () => {
      try {
        await checkVisitorDecisions();

        const channelName = `porteiro-decisions-${buildingId}`;
        console.log(`📡 [PorteiroLayout] Inscrevendo-se no canal ${channelName}`);

        const channel = supabase
          .channel(channelName, {
            config: {
              broadcast: {
                self: false
              }
            }
          })
          .on('broadcast', { event: 'visitor_decision_update' }, async ({ payload }) => {
            console.log('📨 [PorteiroLayout] Broadcast de decisão recebido:', payload);
            await processRealtimePayload(payload);
          });

        const subscribedChannel = channel.subscribe((status) => {
          console.log(`📶 [PorteiroLayout] Canal ${channelName} mudou para status: ${status}`);
        });

        decisionChannelRef.current = subscribedChannel;
      } catch (error) {
        console.error('❌ [PorteiroLayout] Erro ao configurar realtime de decisões:', error);
      }
    };

    setupRealtime();

    return () => {
      isActive = false;

      if (decisionChannelRef.current) {
        console.log('🧹 [PorteiroLayout] Canal de decisões removido');
        supabase.removeChannel(decisionChannelRef.current);
        decisionChannelRef.current = null;
      }
    };
  }, [user, isReady, signOut]); // Dependências: user e isReady

  return (
    <PorteiroDashboardProvider>
      <Stack screenOptions={{ headerShown: false, animation: shouldAnimate ? 'fade' : 'none' }}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: true,
            header: renderTabsHeader,
          }}
        />
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="visitor" />
        <Stack.Screen name="delivery" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="emergency" />
      </Stack>
    </PorteiroDashboardProvider>
  );
}
