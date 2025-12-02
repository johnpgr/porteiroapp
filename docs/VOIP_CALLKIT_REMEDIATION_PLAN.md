## Plano: Remediação de VoIP e CallKit no iOS

Feche os últimos gaps de VoIP push/CallKit providenciando credenciais reais de VoIP no APNs, garantindo que contas de porteiro registrem tokens e inicializem o CallKeep no login, estendendo o fan-out do backend para entregar esses pushes e documentando a cobertura de testes para evitar regressões quando os testes de integração existirem.

### Etapas
1. Provisionar credenciais VoIP na Apple e atualizar `apps/interfone-api/src/services/push.service.ts` para usar o HTTP/2 do APNs em vez do endpoint do Expo, documentando o manejo de certificados/p8 em `docs/CALLKEEP_IMPLEMENTATION_PLAN.md`.
2. Garantir que `registerPushTokenAfterLogin` e `voipPushService.initialize` rodem nos fluxos de porteiro em `apps/expo/hooks/useAuth.tsx` / `utils/pushNotifications.ts`, salvando tokens em `profiles.voip_push_token`.
3. Espelhar o bootstrap de chamadas do morador (`CallSystemInitializer`, `ActiveCallBootstrapper`, `IntercomNotificationListeners`) em `apps/expo/app/(app)/porteiro/` para que CallCoordinator e CallKeep estejam prontos logo após o login do porteiro.
4. Atualizar `apps/interfone-api/src/controllers/call.controller.ts` para incluir tokens de porteiros ao montar `iosRecipients`/`androidRecipients`, além de migrações que persistam as preferências de notificação deles.
5. Definir cobertura contra regressões: adicionar testes de integração em `tests/src` (ou pelo menos um runbook manual documentado) exercitando pushes VoIP para porteiro, simulação de entrega APNs e o fluxo do CallCoordinator para porteiros.

### Considerações Adicionais
1. Trabalho no portal Apple bloqueado? Opção A: solicitar acesso; Opção B: documentar como dependência externa.
2. Precisamos que o UX do porteiro controle permissões de notificação antes de registrar tokens? Opção A: prompt no login; Opção B: reutilizar o fluxo de permissões do morador.
3. Sem testes de integração—priorizamos primeiro contratos de backend ou um harness mobile E2E completo?

### Checklist no Apple Developer Portal (VoIP Push)
1. **Capacidade do App ID:** Em Certificates & Identifiers → Identifiers, abra o App ID iOS usado pelo build Expo (ex.: `app.porteiro.mobile`) e certifique-se de que Push Notifications está habilitado com a opção VoIP marcada. Salve para que a Apple regenere o backing store de entitlements.
2. **Perfis de provisionamento:** Baixe novamente os perfis Development, Ad Hoc e App Store após habilitar VoIP para que Xcode/Expo incluam o entitlement `com.apple.developer.pushkit.unrestricted-voip`. Substitua os `.mobileprovision` onde os builds EAS os referenciam.
3. **Material de chave/certificado:** Em Keys, gere (ou reutilize) uma APNs Auth Key limitada a Push Notifications. Anote o Key ID, baixe o `.p8` e registre o Team ID de 10 caracteres. Se preferir autenticação por certificado, crie um “VoIP Services Certificate”, exporte o `.p12` e compartilhe a senha com segurança.
4. **Repasse de configuração ao backend:** Entregue ao backend o Bundle ID, Team ID, Key ID e o `.p8` bruto (ou `.p12` + senha) para que `apps/interfone-api` assine os payloads VoIP. Guarde-os como segredos na plataforma de deploy (ex.: `APNS_VOIP_KEY`, `APNS_VOIP_KEY_ID`, `APNS_TEAM_ID`).
5. **Validação do tópico APNs:** Confirme que o tópico VoIP é `<bundle id>.voip` (o Expo EAS adiciona o sufixo automaticamente se configurado). Inclua esse tópico nos headers server-side junto com `apns-push-type: voip`.
6. **Controle de acesso:** Documente quem possui acesso ao Apple Developer e configure um canal seguro (cofre 1Password etc.) para rotacionar a chave, pois os pushes VoIP param imediatamente se a chave for revogada.
