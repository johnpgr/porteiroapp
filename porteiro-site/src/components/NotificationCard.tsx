import React, { useState } from 'react';
import { Clock, User, Package, Car, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
  reason?: string;
  delivery_destination?: 'portaria' | 'elevador' | 'apartamento';
}

interface NotificationCardProps {
  notification: PendingNotification;
  onRespond: (notificationId: string, response: NotificationResponse) => Promise<void>;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ notification, onRespond }) => {
  const [responding, setResponding] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const getIcon = () => {
    switch (notification.entry_type) {
      case 'visitor':
        return <User className="w-5 h-5 text-blue-500" />;
      case 'delivery':
        return <Package className="w-5 h-5 text-green-500" />;
      case 'vehicle':
        return <Car className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTitle = () => {
    switch (notification.entry_type) {
      case 'visitor':
        return `Visitante: ${notification.guest_name || notification.visitors?.name || 'Não identificado'}`;
      case 'delivery':
        return `Entrega de: ${notification.delivery_sender || 'Remetente não informado'}`;
      case 'vehicle':
        return `Veículo: ${notification.license_plate || 'Placa não informada'}`;
      default:
        return 'Notificação';
    }
  };

  const getDetails = () => {
    switch (notification.entry_type) {
      case 'visitor':
        return notification.purpose ? `Motivo: ${notification.purpose}` : 'Sem motivo informado';
      case 'delivery':
        return notification.delivery_description || 'Descrição não informada';
      case 'vehicle':
        return `${notification.vehicle_brand || ''} ${notification.vehicle_model || ''} ${notification.vehicle_color || ''}`.trim() || 'Detalhes não informados';
      default:
        return '';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return `${Math.floor(diffInMinutes / 1440)}d atrás`;
  };

  const handleApprove = async () => {
    if (notification.entry_type === 'delivery') {
      setShowDeliveryModal(true);
    } else {
      await handleResponse({ action: 'approve' });
    }
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const handleResponse = async (response: NotificationResponse) => {
    try {
      setResponding(true);
      await onRespond(notification.id, response);
      setShowRejectModal(false);
      setShowDeliveryModal(false);
      setRejectReason('');
    } catch (error) {
      console.error('Erro ao responder notificação:', error);
    } finally {
      setResponding(false);
    }
  };

  const handleDeliveryDestination = async (destination: 'portaria' | 'elevador') => {
    await handleResponse({ 
      action: 'approve', 
      delivery_destination: destination 
    });
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return;
    await handleResponse({ 
      action: 'reject', 
      reason: rejectReason.trim() 
    });
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                {getTitle()}
              </h3>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                <Clock className="w-3 h-3 mr-1" />
                {formatTime(notification.notification_sent_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">{getDetails()}</p>
          {notification.delivery_tracking_code && (
            <p className="text-xs text-gray-500 mt-1">
              Código: {notification.delivery_tracking_code}
            </p>
          )}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleApprove}
            disabled={responding}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {responding ? 'Processando...' : 'Aprovar'}
          </button>
          <button
            onClick={handleReject}
            disabled={responding}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Rejeitar
          </button>
        </div>
      </div>

      {/* Modal de Rejeição */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Motivo da Rejeição</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Digite o motivo da rejeição..."
              className="w-full p-3 border border-gray-300 rounded-md resize-none h-24 text-sm"
              maxLength={200}
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || responding}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {responding ? 'Rejeitando...' : 'Rejeitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Destino da Entrega */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Destino da Entrega</h3>
            <p className="text-sm text-gray-600 mb-4">
              Onde a entrega deve ser deixada?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleDeliveryDestination('portaria')}
                disabled={responding}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                {responding ? 'Processando...' : 'Deixar na Portaria'}
              </button>
              <button
                onClick={() => handleDeliveryDestination('elevador')}
                disabled={responding}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                {responding ? 'Processando...' : 'Enviar pelo Elevador'}
              </button>
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationCard;
export type { PendingNotification, NotificationResponse };