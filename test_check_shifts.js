const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (usando service_role para testes)
const supabaseUrl = 'https://ycamhxzumzkpxuhtugxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYW1oeHp1bXprcHh1aHR1Z3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTcyMTAzMSwiZXhwIjoyMDcxMjk3MDMxfQ.5abRJDfQeKopRnaoYmFgoS7-0SoldraEMp_VPM7OjdQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShifts() {
    console.log('🔍 === VERIFICANDO TURNOS NO BANCO ===\n');
    
    try {
        // Buscar todos os turnos
        const { data: allShifts, error: allError } = await supabase
            .from('porteiro_shifts')
            .select('*')
            .order('shift_start', { ascending: false })
            .limit(10);
            
        if (allError) {
            console.error('❌ Erro ao buscar turnos:', allError);
            return;
        }
        
        console.log(`📊 Total de turnos encontrados: ${allShifts.length}\n`);
        
        if (allShifts.length > 0) {
            console.log('📋 Últimos turnos:');
            allShifts.forEach((shift, index) => {
                console.log(`${index + 1}. ID: ${shift.id}`);
                console.log(`   Porteiro: ${shift.porteiro_id}`);
                console.log(`   Prédio: ${shift.building_id}`);
                console.log(`   Status: ${shift.status}`);
                console.log(`   Início: ${shift.shift_start}`);
                console.log(`   Fim: ${shift.shift_end || 'Em andamento'}`);
                console.log(`   Duração: ${shift.duration_minutes || 'N/A'} minutos\n`);
            });
        }
        
        // Buscar turnos ativos especificamente
        const { data: activeShifts, error: activeError } = await supabase
            .from('porteiro_shifts')
            .select('*')
            .eq('status', 'active');
            
        if (activeError) {
            console.error('❌ Erro ao buscar turnos ativos:', activeError);
            return;
        }
        
        console.log(`🟢 Turnos ativos encontrados: ${activeShifts.length}\n`);
        
        if (activeShifts.length > 0) {
            console.log('🔄 Turnos ativos:');
            activeShifts.forEach((shift, index) => {
                console.log(`${index + 1}. ID: ${shift.id}`);
                console.log(`   Porteiro: ${shift.porteiro_id}`);
                console.log(`   Prédio: ${shift.building_id}`);
                console.log(`   Início: ${shift.shift_start}\n`);
            });
        }
        
        // Testar consulta específica para um porteiro
        const porteiroId = '45dd0438-e092-4c4e-a6ff-3a313855b41e'; // Severino Silva
        
        const { data: porteiroShifts, error: porteiroError } = await supabase
            .from('porteiro_shifts')
            .select('*')
            .eq('porteiro_id', porteiroId)
            .eq('status', 'active');
            
        if (porteiroError) {
            console.error('❌ Erro ao buscar turnos do porteiro:', porteiroError);
            return;
        }
        
        console.log(`👤 Turnos ativos para Severino Silva: ${porteiroShifts.length}\n`);
        
        if (porteiroShifts.length > 0) {
            console.log('✅ Turno ativo encontrado para Severino Silva:');
            porteiroShifts.forEach(shift => {
                console.log(`   ID: ${shift.id}`);
                console.log(`   Prédio: ${shift.building_id}`);
                console.log(`   Início: ${shift.shift_start}`);
            });
        } else {
            console.log('❌ Nenhum turno ativo encontrado para Severino Silva');
        }
        
    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

checkShifts();