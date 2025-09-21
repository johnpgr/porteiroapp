import React, { useState } from 'react';
import { Clock, User, X, Package, Phone } from 'lucide-react';

interface PendingNotification {
  id: string;
  entry_type: 'visitor' | 'delivery' | 'vehicle';
  notification_status: 'pending' | 'approved' | 'rejected' | 'expired';
  notification_sent_at: string;
  expires_at: string;
  apartment_id: string;
  guest_name?: string;
  purpose?: string;
  visitor_id?: string;
  delivery_sender?: string;
  delivery_description?: string;
  delivery_tracking_code?: string;
  license_plate?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_brand?: string;
  building_id: string;
  created_at: string;
  log_time: string;
  visitors?: {
    name: string;
    document: string;
    phone?: string;
  };
}

interface NotificationResponse {
  action: 'approve' | 'reject';
  delivery_destination?: 'portaria' | 'elevador';
  reason?: string;
}

interface NotificationCardProps {
  notification: PendingNotification;
  onRespond: (notificationId: string, response: NotificationResponse) => Promise<void>;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ notification, onRespond }) => {
  const [responding, setResponding] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApprove = async (destination: 'portaria' | 'elevador') => {
    setResponding(true);
    try {
      await onRespond(notification.id, {
        action: 'approve',
        delivery_destination: destination
      });
    } finally {
      setResponding(false);
    }
  };

  const handleReject = async (reason: string) => {
    setResponding(true);
    try {
      await onRespond(notification.id, {
        action: 'reject',
        reason: reason || 'Rejeitado pelo morador'
      });
      setShowRejectModal(false);
      setRejectReason('');
    } finally {
      setResponding(false);
    }
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {notification.entry_type === 'delivery' ? (
                <Package className="w-4 h-4 text-orange-500" />
              ) : (
                <User className="w-4 h-4 text-gray-500" />
              )}
              <span className="font-medium text-gray-900">{notification.guest_name || notification.visitors?.name || 'Visitante'}</span>
              <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                {notification.entry_type === 'delivery' ? 'Entrega' : 'Visita'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{notification.purpose}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(notification.created_at)}
              </span>
              {notification.visitors?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {notification.visitors.phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            {notification.entry_type === 'delivery' ? (
              <>
                <button 
                  onClick={() => handleApprove('elevador')}
                  disabled={responding}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Subir Elevador
                </button>
                <button 
                  onClick={() => handleApprove('portaria')}
                  disabled={responding}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Deixar Portaria
                </button>
              </>
            ) : (
              <button 
                onClick={() => handleApprove('elevador')}
                disabled={responding}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Aprovar
              </button>
            )}
            <button 
              onClick={() => setShowRejectModal(true)}
              disabled={responding}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Rejeitar
            </button>
            <button 
              onClick={() => setShowDetails(true)}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              Detalhes
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {notification.entry_type === 'delivery' ? 'Detalhes da Entrega' : 'Detalhes da Visita'}
              </h3>
              <button 
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Foto removida temporariamente - não disponível na interface atual */}
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nome:</label>
                  <p className="text-gray-900">{notification.guest_name || notification.visitors?.name || 'Visitante'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Documento:</label>
                  <p className="text-gray-900">{notification.visitors?.document || 'Não informado'}</p>
                </div>
                
                {notification.visitors?.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Telefone:</label>
                    <p className="text-gray-900">{notification.visitors.phone}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Motivo:</label>
                  <p className="text-gray-900">{notification.purpose || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Data/Hora:</label>
                  <p className="text-gray-900">{formatDate(notification.created_at)}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo:</label>
                  <p className="text-gray-900">
                    {notification.entry_type === 'delivery' ? 'Entrega' : 'Visita'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              {notification.entry_type === 'delivery' ? (
                <>
                  <button 
                    onClick={() => {
                      handleApprove('elevador');
                      setShowDetails(false);
                    }}
                    disabled={responding}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Subir Elevador
                  </button>
                  <button 
                    onClick={() => {
                      handleApprove('portaria');
                      setShowDetails(false);
                    }}
                    disabled={responding}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Deixar Portaria
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    handleApprove('elevador');
                    setShowDetails(false);
                  }}
                  disabled={responding}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Aprovar Visita
                </button>
              )}
              <button 
                onClick={() => {
                  setShowDetails(false);
                  setShowRejectModal(true);
                }}
                disabled={responding}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rejeição */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Rejeitar Solicitação</h3>
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-3">
                Tem certeza que deseja rejeitar a solicitação de <strong>{notification.guest_name || notification.visitors?.name || 'Visitante'}</strong>?
              </p>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo da rejeição (opcional):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Digite o motivo da rejeição..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleReject(rejectReason)}
                disabled={responding}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {responding ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationCard;