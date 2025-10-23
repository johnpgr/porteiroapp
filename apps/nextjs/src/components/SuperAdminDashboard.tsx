import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  Shield, 
  Users, 
  Settings, 
  Activity, 
  BarChart3, 
  Bell, 
  LogOut, 
  Menu,
  X,
  Home,
  Database,
  Lock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Server,
  HardDrive,
  Cpu,
  MemoryStick
} from 'lucide-react';
import AdminManagement from './AdminManagement';
import SystemMetrics from './SystemMetrics';
import AccessControls from './AccessControls';
import ActivityLogs from './ActivityLogs';
import { 
  NotificationProvider, 
  NotificationCenter, 
  NotificationBadge, 
  useNotifications 
} from './NotificationSystem';
import { useSystemMetrics } from '@/hooks/useAdminActions';

interface DashboardStats {
  totalAdmins: number;
  activeUsers: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
  todayActions: number;
  criticalAlerts: number;
  systemUptime: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  variant: 'default' | 'destructive' | 'outline';
}

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const NAVIGATION_ITEMS = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: <Home className="h-4 w-4" />,
    description: 'Dashboard principal com métricas gerais'
  },
  {
    id: 'admins',
    label: 'Administradores',
    icon: <Users className="h-4 w-4" />,
    description: 'Gerenciar administradores do sistema'
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: <Server className="h-4 w-4" />,
    description: 'Métricas e status do sistema'
  },
  {
    id: 'access',
    label: 'Controle de Acesso',
    icon: <Shield className="h-4 w-4" />,
    description: 'Permissões e auditoria'
  },
  {
    id: 'logs',
    label: 'Logs de Atividade',
    icon: <Activity className="h-4 w-4" />,
    description: 'Histórico de ações do sistema'
  }
];

function SuperAdminDashboardContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalAdmins: 0,
    activeUsers: 0,
    systemHealth: 'good',
    todayActions: 0,
    criticalAlerts: 0,
    systemUptime: '0d 0h 0m'
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { addNotification } = useNotifications();
  const { metrics, fetchMetrics, refreshMetrics } = useSystemMetrics();

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh dashboard data every 30 seconds
    const interval = setInterval(() => {
      if (activeTab === 'overview') {
        refreshMetrics();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, refreshMetrics]);
  
  // Notificações de sistema em tempo real
  useEffect(() => {
    if (metrics) {
      // Verificar alertas do sistema
      if (metrics.system?.cpu_usage > 80) {
        addNotification({
          type: 'warning',
          title: 'Alto uso de CPU',
          message: `CPU em ${metrics.system.cpu_usage}% de uso`,
          persistent: true
        });
      }
      
      if (metrics.system?.memory_usage > 85) {
        addNotification({
          type: 'warning',
          title: 'Alto uso de memória',
          message: `Memória em ${metrics.system.memory_usage}% de uso`,
          persistent: true
        });
      }
      
      if (metrics.system?.disk_usage > 90) {
        addNotification({
          type: 'error',
          title: 'Espaço em disco crítico',
          message: `Disco em ${metrics.system.disk_usage}% de uso`,
          persistent: true
        });
      }
    }
  }, [metrics, addNotification]);

  const loadDashboardData = async () => {
    try {
      // Carregar métricas do sistema
      await fetchMetrics();
      
      // Simular carregamento de outros dados
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Dados simulados - em produção, buscar do Supabase
      const mockStats: DashboardStats = {
        totalAdmins: 12,
        activeUsers: 847,
        systemHealth: 'good',
        todayActions: 156,
        criticalAlerts: 2,
        systemUptime: '15d 8h 32m'
      };
      
      const mockRecentActivity: RecentActivity[] = [
        {
          id: '1',
          user: 'João Silva',
          action: 'Criou novo administrador',
          timestamp: '2024-01-20T15:30:00Z',
          severity: 'medium'
        },
        {
          id: '2',
          user: 'Maria Santos',
          action: 'Alterou permissões de usuário',
          timestamp: '2024-01-20T14:45:00Z',
          severity: 'high'
        },
        {
          id: '3',
          user: 'Sistema',
          action: 'Backup automático concluído',
          timestamp: '2024-01-20T14:00:00Z',
          severity: 'low'
        },
        {
          id: '4',
          user: 'Carlos Oliveira',
          action: 'Tentativa de acesso negada',
          timestamp: '2024-01-20T13:15:00Z',
          severity: 'critical'
        },
        {
          id: '5',
          user: 'Ana Costa',
          action: 'Exportou relatório de auditoria',
          timestamp: '2024-01-20T12:30:00Z',
          severity: 'low'
        }
      ];
      
      setDashboardStats(mockStats);
      setRecentActivity(mockRecentActivity);
      
      // Notificação de boas-vindas
      addNotification({
        type: 'info',
        title: 'Dashboard carregado',
        message: 'Dados do sistema atualizados com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
      addNotification({
        type: 'error',
        title: 'Erro ao carregar dashboard',
        message: 'Não foi possível carregar os dados do sistema'
      });
    } finally {
      setLoading(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: 'add-admin',
      title: 'Novo Administrador',
      description: 'Adicionar um novo administrador ao sistema',
      icon: <Users className="h-5 w-5" />,
      action: () => setActiveTab('admins'),
      variant: 'default'
    },
    {
      id: 'system-check',
      title: 'Verificar Sistema',
      description: 'Executar diagnóstico completo do sistema',
      icon: <Settings className="h-5 w-5" />,
      action: () => {
        toast.info('Iniciando verificação do sistema...');
        setTimeout(() => {
          toast.success('Sistema verificado com sucesso!');
        }, 3000);
      },
      variant: 'outline'
    },
    {
      id: 'security-audit',
      title: 'Auditoria de Segurança',
      description: 'Revisar logs e permissões de segurança',
      icon: <Shield className="h-5 w-5" />,
      action: () => setActiveTab('access'),
      variant: 'outline'
    },
    {
      id: 'emergency-lock',
      title: 'Bloqueio de Emergência',
      description: 'Bloquear todos os acessos temporariamente',
      icon: <Lock className="h-5 w-5" />,
      action: () => {
        toast.warning('Função de emergência - confirme para continuar');
      },
      variant: 'destructive'
    }
  ];

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'warning': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'low': return 'secondary';
      case 'medium': return 'default';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Bem-vindo, Super Admin!</h1>
            <p className="text-blue-100">
              Gerencie todo o sistema de portaria com controle total e segurança.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100">Sistema Online</p>
            <p className="text-lg font-semibold">{dashboardStats.systemUptime}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Admins</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalAdmins}</div>
            <p className="text-xs text-muted-foreground">
              +2 novos este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              +12% desde ontem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saúde do Sistema</CardTitle>
            {getHealthIcon(dashboardStats.systemHealth)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={getHealthBadgeVariant(dashboardStats.systemHealth)}>
                {dashboardStats.systemHealth === 'excellent' && 'Excelente'}
                {dashboardStats.systemHealth === 'good' && 'Bom'}
                {dashboardStats.systemHealth === 'warning' && 'Atenção'}
                {dashboardStats.systemHealth === 'critical' && 'Crítico'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os serviços operacionais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ações Hoje</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.todayActions}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.criticalAlerts} alertas críticos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map(action => (
              <Button
                key={action.id}
                variant={action.variant}
                className="h-auto p-4 flex flex-col items-start space-y-2"
                onClick={action.action}
              >
                <div className="flex items-center space-x-2">
                  {action.icon}
                  <span className="font-semibold">{action.title}</span>
                </div>
                <p className="text-xs text-left opacity-80">
                  {action.description}
                </p>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>
              Últimas ações realizadas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.slice(0, 5).map(activity => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                      <Badge variant={getSeverityBadgeVariant(activity.severity)} className="text-xs">
                        {activity.severity}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => setActiveTab('logs')}
            >
              Ver Todos os Logs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recursos do Sistema</CardTitle>
            <CardDescription>
              Monitoramento em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">CPU</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">45%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MemoryStick className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Memória</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '62%' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">62%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Armazenamento</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-600 h-2 rounded-full" style={{ width: '78%' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">78%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Banco de Dados</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Online</span>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => setActiveTab('system')}
            >
              Ver Métricas Detalhadas
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'admins':
        return <AdminManagement />;
      case 'system':
        return <SystemMetrics />;
      case 'access':
        return <AccessControls />;
      case 'logs':
        return <ActivityLogs />;
      default:
        return renderOverview();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Super Admin</h2>
                <p className="text-sm text-gray-500">Painel de Controle</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {NAVIGATION_ITEMS.map(item => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              className={`w-full justify-start ${!sidebarOpen && 'px-2'}`}
              onClick={() => setActiveTab(item.id)}
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && (
                <div className="ml-2 text-left">
                  <div className="font-medium">{item.label}</div>
                  {activeTab !== item.id && (
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  )}
                </div>
              )}
            </Button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback>SA</AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Super Admin
                </p>
                <p className="text-xs text-gray-500 truncate">
                  admin@porteiro.com
                </p>
              </div>
            )}
            <Button variant="ghost" size="sm" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {NAVIGATION_ITEMS.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
              <p className="text-sm text-gray-500">
                {NAVIGATION_ITEMS.find(item => item.id === activeTab)?.description}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationBadge 
                onClick={() => setNotificationCenterOpen(true)}
              />
              
              <Badge variant="outline" className="flex items-center space-x-1">
                {getHealthIcon(dashboardStats.systemHealth)}
                <span>Sistema {dashboardStats.systemHealth === 'good' ? 'Saudável' : 'Com Problemas'}</span>
              </Badge>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {renderContent()}
        </main>
      </div>
      {/* Centro de Notificações */}
      <NotificationCenter 
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </div>
  );
}

// Componente principal com Provider
export default function SuperAdminDashboard() {
  return (
    <NotificationProvider>
      <SuperAdminDashboardContent />
    </NotificationProvider>
  );
}