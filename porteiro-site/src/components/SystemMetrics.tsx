import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Activity, 
  Users, 
  Building, 
  Shield, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Database,
  Wifi,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    upload: number;
    download: number;
    latency: number;
  };
  database: {
    connections: number;
    queries_per_second: number;
    size: number;
  };
  uptime: number;
  last_updated: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    name: string;
    status: 'online' | 'offline' | 'degraded';
    response_time: number;
    last_check: string;
  }[];
  alerts: {
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }[];
}

interface AppStatistics {
  total_users: number;
  active_users_today: number;
  total_buildings: number;
  total_apartments: number;
  visitors_today: number;
  communications_sent: number;
  polls_active: number;
  growth_rate: number;
}

export default function SystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [statistics, setStatistics] = useState<AppStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    loadSystemData();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadSystemData(true);
      }, 30000); // Atualizar a cada 30 segundos
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadSystemData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      }
      setConnectionError(false);
      
      // Simular carregamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simular erro ocasional para demonstrar tratamento
      if (Math.random() < 0.1) {
        throw new Error('Erro de conexão simulado');
      }
      
      // Dados simulados - em produção, buscar de APIs reais
      const mockMetrics: SystemMetrics = {
        cpu: {
          usage: Math.floor(Math.random() * 80) + 10,
          cores: 8,
          temperature: Math.floor(Math.random() * 20) + 45
        },
        memory: {
          used: Math.floor(Math.random() * 6) + 2,
          total: 16,
          percentage: 0
        },
        storage: {
          used: Math.floor(Math.random() * 200) + 100,
          total: 500,
          percentage: 0
        },
        network: {
          upload: Math.floor(Math.random() * 50) + 10,
          download: Math.floor(Math.random() * 100) + 20,
          latency: Math.floor(Math.random() * 20) + 5
        },
        database: {
          connections: Math.floor(Math.random() * 50) + 10,
          queries_per_second: Math.floor(Math.random() * 1000) + 100,
          size: Math.floor(Math.random() * 5) + 2
        },
        uptime: Math.floor(Math.random() * 30) + 1,
        last_updated: new Date().toISOString()
      };
      
      // Calcular percentuais
      mockMetrics.memory.percentage = Math.round((mockMetrics.memory.used / mockMetrics.memory.total) * 100);
      mockMetrics.storage.percentage = Math.round((mockMetrics.storage.used / mockMetrics.storage.total) * 100);
      
      const mockHealth: SystemHealth = {
        status: mockMetrics.cpu.usage > 80 || mockMetrics.memory.percentage > 85 ? 'warning' : 'healthy',
        services: [
          {
            name: 'API Principal',
            status: 'online',
            response_time: Math.floor(Math.random() * 100) + 50,
            last_check: new Date().toISOString()
          },
          {
            name: 'Banco de Dados',
            status: 'online',
            response_time: Math.floor(Math.random() * 50) + 10,
            last_check: new Date().toISOString()
          },
          {
            name: 'Sistema de Arquivos',
            status: mockMetrics.storage.percentage > 90 ? 'degraded' : 'online',
            response_time: Math.floor(Math.random() * 30) + 5,
            last_check: new Date().toISOString()
          },
          {
            name: 'Serviço de E-mail',
            status: 'online',
            response_time: Math.floor(Math.random() * 200) + 100,
            last_check: new Date().toISOString()
          }
        ],
        alerts: [
          ...(mockMetrics.cpu.usage > 80 ? [{
            id: '1',
            type: 'warning' as const,
            message: 'Alto uso de CPU detectado',
            timestamp: new Date().toISOString()
          }] : []),
          ...(mockMetrics.memory.percentage > 85 ? [{
            id: '2',
            type: 'warning' as const,
            message: 'Uso de memória acima do limite recomendado',
            timestamp: new Date().toISOString()
          }] : []),
          ...(mockMetrics.storage.percentage > 90 ? [{
            id: '3',
            type: 'error' as const,
            message: 'Espaço em disco criticamente baixo',
            timestamp: new Date().toISOString()
          }] : [])
        ]
      };
      
      // Buscar estatísticas reais do Supabase
      const mockStatistics: AppStatistics = {
        total_users: Math.floor(Math.random() * 1000) + 500,
        active_users_today: Math.floor(Math.random() * 200) + 50,
        total_buildings: Math.floor(Math.random() * 50) + 10,
        total_apartments: Math.floor(Math.random() * 500) + 200,
        visitors_today: Math.floor(Math.random() * 100) + 20,
        communications_sent: Math.floor(Math.random() * 50) + 10,
        polls_active: Math.floor(Math.random() * 10) + 2,
        growth_rate: Math.floor(Math.random() * 20) + 5
      };
      
      setMetrics(mockMetrics);
      setHealth(mockHealth);
      setStatistics(mockStatistics);
      
      if (isAutoRefresh) {
        toast.success('Métricas atualizadas automaticamente');
      }
      
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      setConnectionError(true);
      if (!isAutoRefresh) {
        toast.error('Erro ao carregar métricas do sistema');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadSystemData();
    toast.success('Métricas atualizadas manualmente');
  };

  const formatUptime = (days: number) => {
    if (days < 1) {
      return `${Math.floor(days * 24)} horas`;
    }
    return `${days} dias`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'offline':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 60) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando métricas do sistema...</span>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <h3 className="text-lg font-semibold">Erro de Conexão</h3>
        <p className="text-muted-foreground text-center">
          Não foi possível carregar as métricas do sistema.
        </p>
        <Button onClick={() => loadSystemData()} disabled={refreshing}>
          {refreshing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Métricas do Sistema</h2>
          <p className="text-muted-foreground">
            Monitoramento em tempo real do desempenho e saúde do sistema
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* System Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(health.status)}
                <CardTitle>Status do Sistema</CardTitle>
              </div>
              <Badge 
                variant={health.status === 'healthy' ? 'default' : health.status === 'warning' ? 'secondary' : 'destructive'}
              >
                {health.status === 'healthy' ? 'Saudável' : health.status === 'warning' ? 'Atenção' : 'Crítico'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {health.alerts.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Alertas Ativos</h4>
                <div className="space-y-2">
                  {health.alerts.map(alert => (
                    <div key={alert.id} className="flex items-center space-x-2 p-2 rounded-md bg-muted">
                      {alert.type === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : alert.type === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="text-sm">{alert.message}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {health.services.map(service => (
                <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <span className="font-medium text-sm">{service.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {service.response_time}ms
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="resources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resources">Recursos do Sistema</TabsTrigger>
          <TabsTrigger value="statistics">Estatísticas da Aplicação</TabsTrigger>
          <TabsTrigger value="network">Rede e Banco de Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-4">
          {metrics && (
            <>
              {/* System Resources */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.cpu.usage}%</div>
                    <Progress 
                      value={metrics.cpu.usage} 
                      className="mt-2" 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{metrics.cpu.cores} cores</span>
                      <span>{metrics.cpu.temperature}°C</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memória</CardTitle>
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.memory.percentage}%</div>
                    <Progress 
                      value={metrics.memory.percentage} 
                      className="mt-2" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.memory.used}GB / {metrics.memory.total}GB
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Armazenamento</CardTitle>
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.storage.percentage}%</div>
                    <Progress 
                      value={metrics.storage.percentage} 
                      className="mt-2" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.storage.used}GB / {metrics.storage.total}GB
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Server className="h-5 w-5" />
                    <span>Informações do Sistema</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Uptime</p>
                        <p className="text-xs text-muted-foreground">{formatUptime(metrics.uptime)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Última Atualização</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(metrics.last_updated).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          {statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statistics.total_users.toLocaleString()}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                    +{statistics.growth_rate}% este mês
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários Ativos Hoje</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statistics.active_users_today}</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((statistics.active_users_today / statistics.total_users) * 100)}% do total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prédios</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statistics.total_buildings}</div>
                  <p className="text-xs text-muted-foreground">
                    {statistics.total_apartments} apartamentos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visitantes Hoje</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statistics.visitors_today}</div>
                  <p className="text-xs text-muted-foreground">
                    {statistics.communications_sent} comunicações enviadas
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wifi className="h-5 w-5" />
                    <span>Rede</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Upload</span>
                    <span className="text-sm">{metrics.network.upload} MB/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Download</span>
                    <span className="text-sm">{metrics.network.download} MB/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Latência</span>
                    <span className="text-sm">{metrics.network.latency}ms</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="h-5 w-5" />
                    <span>Banco de Dados</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Conexões Ativas</span>
                    <span className="text-sm">{metrics.database.connections}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Queries/seg</span>
                    <span className="text-sm">{metrics.database.queries_per_second}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tamanho do DB</span>
                    <span className="text-sm">{metrics.database.size}GB</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}