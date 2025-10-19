import React, { useEffect, useRef, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';

const NOTIFIED_DECISIONS_KEY = 'porteiro_notified_decisions';

export default function PorteiroLayout() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const { user } = useAuth();

  // Ref para timestamp da última verificação
  const lastCheckTimeRef = useRef<Date>(new Date());

  // Ref para armazenar IDs de notificações já exibidas (persiste entre re-renders)
  const notifiedDecisionsRef = useRef<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      setShouldAnimate(false);
    } else {
      setShouldAnimate(true);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // Carregar IDs notificados do AsyncStorage ao montar
  useEffect(() => {
    const loadNotifiedIds = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFIED_DECISIONS_KEY);
        if (stored) {
          const ids = JSON.parse(stored);
          notifiedDecisionsRef.current = new Set(ids);
          console.log(`📦 [PorteiroLayout] ${ids.length} IDs carregados do cache`);
        }
        setIsReady(true);
      } catch (error) {
        console.error('❌ [PorteiroLayout] Erro ao carregar IDs notificados:', error);
        setIsReady(true);
      }
    };

    loadNotifiedIds();
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
            notification_status,
            resident_response_at,
            visitors (name),
            apartments (number),
            profiles (full_name)
          `)
          .eq('apartments.building_id', buildingId)
          .in('notification_status', ['approved', 'rejected'])
          .gte('resident_response_at', lastCheckTime)
          .order('resident_response_at', { ascending: false });

        if (error) {
          console.error('❌ [PorteiroLayout] Erro ao verificar decisões:', error);
          return;
        }

        // Atualizar timestamp do último check ANTES de processar
        lastCheckTimeRef.current = now;

        if (recentDecisions && recentDecisions.length > 0) {
          // Filtrar apenas decisões que ainda não foram notificadas
          const newDecisions = recentDecisions.filter(
            (decision) => !notifiedDecisionsRef.current.has(decision.id)
          );

          if (newDecisions.length > 0) {
            console.log(`🔔 [PorteiroLayout] ${newDecisions.length} nova(s) decisão(ões) encontrada(s)`);

            // Exibir alert para cada nova decisão
            for (const decision of newDecisions) {
              const visitorName = decision.visitors?.name || 'Visitante';
              const apartmentNumber = decision.apartments?.number || 'N/A';
              const moradorName = decision.profiles?.full_name || 'Morador';
              const isApproved = decision.notification_status === 'approved';

              Alert.alert(
                isApproved ? '✅ Visitante Aprovado' : '❌ Visitante Recusado',
                `O morador ${moradorName} do apartamento ${apartmentNumber} ${isApproved ? 'ACEITOU' : 'RECUSOU'} o visitante ${visitorName}.`,
                [{ text: 'OK' }]
              );

              // Adicionar ID ao Set de notificações já exibidas
              notifiedDecisionsRef.current.add(decision.id);
            }

            // Salvar IDs no AsyncStorage
            try {
              const idsArray = Array.from(notifiedDecisionsRef.current);
              // Manter apenas os últimos 100 IDs para não crescer infinitamente
              const recentIds = idsArray.slice(-100);
              await AsyncStorage.setItem(NOTIFIED_DECISIONS_KEY, JSON.stringify(recentIds));
              console.log(`💾 [PorteiroLayout] ${recentIds.length} IDs salvos no cache`);
            } catch (saveError) {
              console.error('❌ [PorteiroLayout] Erro ao salvar IDs:', saveError);
            }
          } else {
            console.log('✅ [PorteiroLayout] Nenhuma decisão nova');
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
