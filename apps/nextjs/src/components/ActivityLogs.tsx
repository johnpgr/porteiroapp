'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Activity,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Shield,
  Database,
  Settings,
  Eye,
  Calendar,
  FileText
} from 'lucide-react';

// Interfaces
interface AuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  resource: string;
  details: any;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failed' | 'warning';
  created_at: string;
}

interface SecurityLog {
  id: string;
  admin_id: string;
  admin_email: string;
  event: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  component: string;
  details: any;
  created_at: string;
}

interface LogFilters {
  dateFrom: string;
  dateTo: string;
  admin: string;
  action: string;
  status: string;
  severity: string;
  search: string;
}

const ActivityLogs: React.FC = () => {
  // Estados
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('audit');
  const [filters, setFilters] = useState<LogFilters>({
    dateFrom: '',
    dateTo: '',
    admin: '',
    action: '',
    status: '',
    severity: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; email: string }[]>([]);
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    failedActions: 0,
    securityAlerts: 0
  });

  // Carregar dados
  useEffect(() => {
    loadData();
    loadAdmins();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Construir query params
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const [auditResponse, securityResponse, systemResponse] = await Promise.all([
        fetch(`/api/admin/audit-logs?${params.toString()}`),
        fetch(`/api/admin/security-logs?${params.toString()}`),
        fetch(`/api/admin/system-logs?${params.toString()}`)
      ]);

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setAuditLogs(auditData.logs || []);
      }

      if (securityResponse.ok) {
        const securityData = await securityResponse.json();
        setSecurityLogs(securityData.logs || []);
      }

      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        setSystemLogs(systemData.logs || []);
      }

      // Calcular estatísticas
      calculateStats();
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast.error('Erro ao carregar logs de atividade');
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await fetch('/api/admin/admins');
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
      }
    } catch (error) {
      console.error('Erro ao carregar administradores:', error);
    }
  };

  const calculateStats = () => {
    const today = new Date().toDateString();
    const todayAuditLogs = auditLogs.filter(log => 
      new Date(log.created_at).toDateString() === today
    );
    const failedActions = auditLogs.filter(log => log.status === 'failed').length;
    const criticalAlerts = securityLogs.filter(log => 
      log.severity === 'critical' || log.severity === 'high'
    ).length;

    setStats({
      totalLogs: auditLogs.length + securityLogs.length + systemLogs.length,
      todayLogs: todayAuditLogs.length,
      failedActions,
      securityAlerts: criticalAlerts
    });
  };

  const handleFilterChange = (key: keyof LogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      admin: '',
      action: '',
      status: '',
      severity: '',
      search: ''
    });
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('export', 'true');

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Logs exportados com sucesso');
      } else {
        throw new Error('Erro ao exportar logs');
      }
    } catch (error) {
      console.error('Erro ao exportar logs:', error);
      toast.error('Erro ao exportar logs');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: { [key: string]: string } = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[severity] || 'bg-gray-100 text-gray-800'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return <User className="h-4 w-4" />;
    if (action.includes('update')) return <Settings className="h-4 w-4" />;
    if (action.includes('delete')) return <XCircle className="h-4 w-4" />;
    if (action.includes('view')) return <Eye className="h-4 w-4" />;
    if (action.includes('login')) return <Shield className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDetails = (details: any) => {
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total de Logs</p>
                <p className="text-2xl font-bold">{stats.totalLogs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Hoje</p>
                <p className="text-2xl font-bold">{stats.todayLogs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Falhas</p>
                <p className="text-2xl font-bold">{stats.failedActions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Alertas</p>
                <p className="text-2xl font-bold">{stats.securityAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Logs de Atividade</span>
              </CardTitle>
              <CardDescription>
                Visualize e monitore todas as atividades administrativas do sistema
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Filtros */}
        {showFilters && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Buscar nos logs..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="dateFrom">Data Inicial</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="dateTo">Data Final</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="admin">Administrador</Label>
                <Select value={filters.admin} onValueChange={(value) => handleFilterChange('admin', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {admins.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="failed">Falha</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="severity">Severidade</Label>
                <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabs com logs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit">Logs de Auditoria</TabsTrigger>
          <TabsTrigger value="security">Logs de Segurança</TabsTrigger>
          <TabsTrigger value="system">Logs do Sistema</TabsTrigger>
        </TabsList>
        
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum log de auditoria encontrado</p>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getActionIcon(log.action)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{log.action}</span>
                              {getStatusIcon(log.status)}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {log.admin_email} - {log.resource}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              IP: {log.ip_address} | {formatDate(log.created_at)}
                            </p>
                            {log.details && (
                              <details className="mt-2">
                                <summary className="text-xs text-blue-600 cursor-pointer">
                                  Ver detalhes
                                </summary>
                                <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                                  {formatDetails(log.details)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {securityLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum log de segurança encontrado</p>
                  </div>
                ) : (
                  securityLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Shield className="h-5 w-5 text-red-500" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{log.event}</span>
                              {getSeverityBadge(log.severity)}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {log.admin_email}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(log.created_at)}
                            </p>
                            {log.details && (
                              <details className="mt-2">
                                <summary className="text-xs text-blue-600 cursor-pointer">
                                  Ver detalhes
                                </summary>
                                <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                                  {formatDetails(log.details)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {systemLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum log do sistema encontrado</p>
                  </div>
                ) : (
                  systemLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start space-x-3">
                        <Database className="h-5 w-5" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{log.component}</span>
                            <Badge variant={log.level === 'error' ? 'destructive' : 'secondary'}>
                              {log.level.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{log.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(log.created_at)}
                          </p>
                          {log.details && (
                            <details className="mt-2">
                              <summary className="text-xs text-blue-600 cursor-pointer">
                                Ver detalhes
                              </summary>
                              <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                                {formatDetails(log.details)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ActivityLogs;