import { NextRequest, NextResponse } from 'next/server';

interface QueryParams {
  name?: string;
  phone?: string;
  building?: string;
  apartment?: string;
}

interface RegistrationData {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  password: string;
}

interface RequestBody {
  queryParams: QueryParams;
  registrationData: RegistrationData;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { queryParams, registrationData } = body;

    // Validar dados obrigatórios
    if (!registrationData.full_name || !registrationData.email || 
        !registrationData.phone || !registrationData.cpf || !registrationData.password) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registrationData.email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // Preparar dados para envio à API externa
    const apiData = {
      full_name: registrationData.full_name,
      email: registrationData.email,
      phone: registrationData.phone,
      cpf: registrationData.cpf,
      birth_date: registrationData.birth_date || null,
      address: registrationData.address || null,
      emergency_contact_name: registrationData.emergency_contact_name || null,
      emergency_contact_phone: registrationData.emergency_contact_phone || null,
      password: registrationData.password,
      // Incluir informações dos query params como metadados
      metadata: {
        source: 'prefilled_form',
        building: queryParams.building,
        apartment: queryParams.apartment,
        original_name: queryParams.name,
        original_phone: queryParams.phone
      }
    };

    // Fazer chamada para a API externa (assumindo que existe uma API de registro)
    // Por enquanto, vamos simular o sucesso
    console.log('Dados de cadastro processados:', {
      queryParams,
      registrationData: apiData
    });

    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Em uma implementação real, você faria algo como:
    /*
    const response = await fetch('https://api.jamesavisa.com/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: JSON.stringify(apiData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro na API externa');
    }

    const result = await response.json();
    */

    // Resposta de sucesso simulada
    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso',
      data: {
        user_id: 'mock-user-id',
        full_name: registrationData.full_name,
        email: registrationData.email,
        building: queryParams.building,
        apartment: queryParams.apartment
      }
    });

  } catch (error) {
    console.error('Erro no cadastro pré-preenchido:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
        details: 'Falha ao processar cadastro com dados pré-preenchidos'
      },
      { status: 500 }
    );
  }
}

// Método GET para verificar se o endpoint está funcionando
export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de cadastro pré-preenchido ativo',
    timestamp: new Date().toISOString()
  });
}