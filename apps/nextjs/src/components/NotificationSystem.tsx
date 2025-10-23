'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { CheckCircle, AlertCircle, XCircle, Info, Bell, X } from 'lucide-react';

// Tipos de notificação
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Interface para notificação
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
  duration?: number;
}

// Interface do contexto
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  showToast: (type: NotificationType, title: string, message?: string, options?: {
    duration?: number;
    action?: { label: string; onClick: () => void };
  }) => void;
  unreadCount: number;
}

// Contexto de notificações
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Hook para usar o contexto
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de NotificationProvider');
  }
  return context;
};

// Provider de notificações
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Adicionar notificação
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remover notificações não persistentes após um tempo
    if (!notification.persistent) {
      const duration = notification.duration || 5000;
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, duration);
    }

    return newNotification.id;
  }, []);

  // Remover notificação
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Marcar como lida
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Limpar todas
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Mostrar toast
  const showToast = useCallback((
    type: NotificationType,
    title: string,
    message?: string,
    options?: {
      duration?: number;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    const toastContent = (
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {type === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
          {type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
          {type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">{title}</p>
          {message && <p className="text-sm text-gray-600 mt-1">{message}</p>}
        </div>
      </div>
    );

    const toastOptions = {
      duration: options?.duration || 4000,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined
    };

    switch (type) {
      case 'success':
        toast.success(toastContent, toastOptions);
        break;
      case 'error':
        toast.error(toastContent, toastOptions);
        break;
      case 'warning':
        toast.warning(toastContent, toastOptions);
        break;
      case 'info':
        toast.info(toastContent, toastOptions);
        break;
    }

    // Também adicionar à lista de notificações
    addNotification({
      type,
      title,
      message: message || '',
      action: options?.action,
      duration: options?.duration
    });
  }, [addNotification]);

  // Contar não lidas
  const unreadCount = notifications.filter(n => !n.read).length;

  // Limpar notificações antigas automaticamente
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNotifications(prev => 
        prev.filter(n => {
          const age = now.getTime() - n.timestamp.getTime();
          const maxAge = n.persistent ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000; // 24h para persistentes, 10min para outras
          return age < maxAge;
        })
      );
    }, 60000); // Verificar a cada minuto

    return () => clearInterval(interval);
  }, []);

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    showToast,
    unreadCount
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster 
        position="top-right"
        expand={true}
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px'
          }
        }}
      />
    </NotificationContext.Provider>
  );
};

// Componente de centro de notificações
export const NotificationCenter: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { notifications, markAsRead, markAllAsRead, clearAll, removeNotification, unreadCount } = useNotifications();

  if (!isOpen) return null;

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-25" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="border-b border-gray-200 px-4 py-2">
              <div className="flex space-x-2">
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                  disabled={unreadCount === 0}
                >
                  Marcar todas como lidas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAll}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Limpar todas
                </button>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Bell className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">Nenhuma notificação</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTime(notification.timestamp)}
                          </p>
                          {notification.action && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                notification.action!.onClick();
                              }}
                              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {notification.action.label}
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="ml-2 flex-shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook para feedback de ações administrativas
export const useAdminFeedback = () => {
  const { showToast } = useNotifications();

  const success = useCallback((title: string, message?: string) => {
    showToast('success', title, message);
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    showToast('error', title, message);
  }, [showToast]);

  const warning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message);
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    showToast('info', title, message);
  }, [showToast]);

  const confirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    showToast('warning', title, message, {
      duration: 10000,
      action: {
        label: 'Confirmar',
        onClick: onConfirm
      }
    });
  }, [showToast]);

  return {
    success,
    error,
    warning,
    info,
    confirm
  };
};

// Componente de indicador de notificações
export const NotificationBadge: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => {
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={onClick}
      className={`relative rounded-md p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 ${className}`}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};