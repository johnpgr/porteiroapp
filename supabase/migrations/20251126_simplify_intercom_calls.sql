-- Migration: Simplify Intercom Calls Schema
-- Generic bidirectional calls between doormen and residents

-- Step 1: Drop existing tables (cascade to remove dependencies)
DROP TABLE IF EXISTS call_participants CASCADE;
DROP TABLE IF EXISTS intercom_calls CASCADE;

-- Step 2: Create simplified intercom_calls table
CREATE TABLE intercom_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The apartment involved in the call
    apartment_id UUID NOT NULL REFERENCES apartments(id),
    
    -- Who started the call
    initiator_id UUID NOT NULL REFERENCES profiles(id),
    initiator_type VARCHAR(20) NOT NULL CHECK (initiator_type IN ('doorman', 'resident')),
    
    -- Call status and timing
    status VARCHAR(20) DEFAULT 'calling' CHECK (status IN ('calling', 'answered', 'ended', 'missed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    
    -- Agora channel (generated from call id)
    channel_name VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for intercom_calls
CREATE INDEX idx_intercom_calls_apartment_id ON intercom_calls(apartment_id);
CREATE INDEX idx_intercom_calls_initiator_id ON intercom_calls(initiator_id);
CREATE INDEX idx_intercom_calls_initiator_type ON intercom_calls(initiator_type);
CREATE INDEX idx_intercom_calls_started_at ON intercom_calls(started_at DESC);
CREATE INDEX idx_intercom_calls_status ON intercom_calls(status);

-- Step 4: Create call_participants table
-- Tracks all participants (residents AND doormen) in a call
CREATE TABLE call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES intercom_calls(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES profiles(id),
    participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('doorman', 'resident')),
    status VARCHAR(20) DEFAULT 'notified' CHECK (status IN ('notified', 'ringing', 'answered', 'connected', 'declined', 'missed', 'disconnected')),
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create indexes for call_participants
CREATE INDEX idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX idx_call_participants_participant_id ON call_participants(participant_id);
CREATE INDEX idx_call_participants_participant_type ON call_participants(participant_type);

-- Step 6: Enable RLS
ALTER TABLE intercom_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- Step 7: RLS Policies for intercom_calls
-- Keep it simple to avoid circular references

-- Users can manage calls they initiated
CREATE POLICY "Initiators can manage their calls" ON intercom_calls
    FOR ALL USING (initiator_id = auth.uid());

-- Users can view calls for their apartment
CREATE POLICY "Users can view apartment calls" ON intercom_calls
    FOR SELECT USING (
        apartment_id IN (
            SELECT apartment_id FROM apartment_residents 
            WHERE profile_id = auth.uid()
        )
    );

-- Step 8: RLS Policies for call_participants
-- Simple direct policies without cross-table references to avoid recursion

-- Users can view their own participation
CREATE POLICY "Users can view their participation" ON call_participants
    FOR SELECT USING (participant_id = auth.uid());

-- Users can insert themselves as participants (for joining calls)
CREATE POLICY "Users can add themselves as participants" ON call_participants
    FOR INSERT WITH CHECK (participant_id = auth.uid());

-- Participants can update their own status (answer/decline)
CREATE POLICY "Participants can update their status" ON call_participants
    FOR UPDATE USING (participant_id = auth.uid());

-- Service role bypass for API operations (the API uses service role key)
-- No additional policy needed as service role bypasses RLS

-- Add comment explaining the schema
COMMENT ON TABLE intercom_calls IS 'Intercom calls between doormen and residents.
- initiator_id: who started the call (doorman or resident)
- initiator_type: doorman or resident
- apartment_id: the apartment involved
- All call targets are tracked in call_participants table';

COMMENT ON TABLE call_participants IS 'Participants in an intercom call.
- For doorman-initiated calls: participants are residents of the apartment
- For resident-initiated calls: participants include the target doorman(s)';
