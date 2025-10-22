-- Ajusta os status permitidos para participantes de chamadas de interfone
ALTER TABLE call_participants
  DROP CONSTRAINT IF EXISTS call_participants_status_check;

ALTER TABLE call_participants
  ADD CONSTRAINT call_participants_status_check
  CHECK (
    status IN (
      'notified',
      'invited',
      'ringing',
      'answered',
      'connected',
      'declined',
      'missed',
      'disconnected'
    )
  );