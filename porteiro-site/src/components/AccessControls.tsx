import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Shield, 
  Users, 
  Settings, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2, 
  Plus, 
  Download, 
  RefreshCw,
  Search,
  Filter,
  Clock,
  User,
  Building,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'users' | 'buildings' | 'reports' | 'communications';
  level: 'read' | 'write' | 'admin';
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  hierarchy_level: number;
  is_system_role: boolean;
  created_at: string;
}

interface UserAccess {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  status: 'active' | 'inactive' | 'suspended';
  last_login?: string;
  created_at: string;
  buildings_access: string[];
}

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  ip_address: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface PermissionFormData {
  name: string;
  description: string;
  category: 'system' | 'users' | 'buildings' | 'reports' | 'communications';
  level: 'read' | 'write' | 'admin';
}

const PERMISSION_CATEGORIES = {
  system: 'Sistema',
  users: 'Usuários',
  buildings: 'Prédios',
  reports: 'Relatórios',
  communications: 'Comunicações'
};

const PERMISSION_LEVELS = {
  read: 'Leitura',
  write: 'Escrita',
  admin: 'Administrador'
};

const STATUS_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
  suspended: 'Suspenso'
};

export default function AccessControls() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Form states
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [permissionForm, setPermissionForm] = useState<PermissionFormData>({
    name: '',
    description: '',
    category: 'system',
    level: 'read'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditSeverityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Simular carregamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simular erro ocasional
      if (Math.random() < 0.05) {
        throw new Error('Erro de conexão simulado');
      }
      
      // Dados simulados - em produção, buscar do Supabase
      const mockPermissions: Permission[] = [
        {
          id: '1',
          name: 'manage_users',
          description: 'Gerenciar usuários do sistema',
          category: 'users',
          level: 'admin',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          name: 'view_reports',
          description: 'Visualizar relatórios',
          category: 'reports',
          level: 'read',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '3',
          name: 'manage_buildings',
          description: 'Gerenciar prédios e apartamentos',
          category: 'buildings',
          level: 'write',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '4',
          name: 'system_settings',
          description: 'Configurações do sistema',
          category: 'system',
          level: 'admin',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];
      
      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'Super Administrador',
          description: 'Acesso total ao sistema',
          permissions: ['1', '2', '3', '4'],
          hierarchy_level: 1,
          is_system_role: true,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          name: 'Administrador',
          description: 'Gerenciamento de usuários e prédios',
          permissions: ['1', '2', '3'],
          hierarchy_level: 2,
          is_system_role: false,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '3',
          name: 'Moderador',
          description: 'Visualização de relatórios',
          permissions: ['2'],
          hierarchy_level: 3,
          is_system_role: false,
          created_at: '2024-01-15T10:00:00Z'
        }
      ];
      
      const mockUsers: UserAccess[] = [
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@porteiro.com',
          role_id: '2',
          role_name: 'Administrador',
          status: 'active',
          last_login: '2024-01-20T14:30:00Z',
          created_at: '2024-01-15T10:00:00Z',
          buildings_access: ['1', '2']
        },
        {
          id: '2',
          name: 'Maria Santos',
          email: 'maria@porteiro.com',
          role_id: '3',
          role_name: 'Moderador',
          status: 'active',
          last_login: '2024-01-19T16:45:00Z',
          created_at: '2024-01-10T09:00:00Z',
          buildings_access: ['1']
        },
        {
          id: '3',
          name: 'Carlos Oliveira',
          email: 'carlos@porteiro.com',
          role_id: '2',
          role_name: 'Administrador',
          status: 'suspended',
          created_at: '2024-01-05T11:00:00Z',
          buildings_access: ['3']
        }
      ];
      
      const mockAuditLogs: AuditLog[] = [
        {
          id: '1',
          user_id: '1',
          user_name: 'João Silva',
          action: 'Criou novo usuário',
          target_type: 'user',
          target_id: '4',
          details: 'Usuário "Ana Costa" criado com role Moderador',
          ip_address: '192.168.1.100',
          timestamp: '2024-01-20T15:30:00Z',
          severity: 'medium'
        },
        {
          id: '2',
          user_id: '2',
          user_name: 'Maria Santos',
          action: 'Visualizou relatório',
          target_type: 'report',
          target_id: 'monthly_visitors',
          details: 'Relatório mensal de visitantes acessado',
          ip_address: '192.168.1.101',
          timestamp: '2024-01-20T14:15:00Z',
          severity: 'low'
        },
        {
          id: '3',
          user_id: '1',
          user_name: 'João Silva',
          action: 'Suspendeu usuário',
          target_type: 'user',
          target_id: '3',
          details: 'Usuário "Carlos Oliveira" suspenso por violação de política',
          ip_address: '192.168.1.100',
          timestamp: '2024-01-20T13:45:00Z',
          severity: 'high'
        },
        {
          id: '4',
          user_id: '1',
          user_name: 'João Silva',
          action: 'Alterou configurações',
          target_type: 'system',
          target_id: 'security_settings',
          details: 'Configurações de segurança atualizadas',
          ip_address: '192.168.1.100',
          timestamp: '2024-01-20T12:00:00Z',
          severity: 'critical'
        }
      ];
      
      setPermissions(mockPermissions);
      setRoles(mockRoles);
      setUsers(mockUsers);
      setAuditLogs(mockAuditLogs);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar controles de acesso');
    } finally {
      setLoading(false);
    }
  };

  const validatePermissionForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!permissionForm.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!permissionForm.description.trim()) {
      errors.description = 'Descrição é obrigatória';
    }

    // Verificar se nome já existe
    const nameExists = permissions.some(permission => 
      permission.name.toLowerCase() === permissionForm.name.toLowerCase() && 
      permission.id !== editingPermission?.id
    );
    if (nameExists) {
      errors.name = 'Nome já está em uso';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePermissionForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (editingPermission) {
        const updatedPermission: Permission = {
          ...editingPermission,
          ...permissionForm,
          id: editingPermission.id,
          created_at: editingPermission.created_at
        };
        
        setPermissions(prev => prev.map(permission => 
          permission.id === editingPermission.id ? updatedPermission : permission
        ));
        
        toast.success('Permissão atualizada com sucesso!');
        setEditingPermission(null);
      } else {
        const newPermission: Permission = {
          ...permissionForm,
          id: Date.now().toString(),
          created_at: new Date().toISOString()
        };
        
        setPermissions(prev => [...prev, newPermission]);
        toast.success('Permissão criada com sucesso!');
      }
      
      setPermissionForm({
        name: '',
        description: '',
        category: 'system',
        level: 'read'
      });
      setShowAddPermission(false);
      setFormErrors({});
      
    } catch (error) {
      console.error('Erro ao salvar permissão:', error);
      toast.error('Erro ao salvar permissão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (userId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      const statusLabel = STATUS_LABELS[newStatus].toLowerCase();
      toast.success(`Usuário ${statusLabel} com sucesso!`);
      
      // Adicionar log de auditoria
      const newAuditLog: AuditLog = {
        id: Date.now().toString(),
        user_id: 'current_user',
        user_name: 'Super Admin',
        action: `Alterou status do usuário para ${statusLabel}`,
        target_type: 'user',
        target_id: userId,
        details: `Status alterado para ${statusLabel}`,
        ip_address: '192.168.1.1',
        timestamp: new Date().toISOString(),
        severity: newStatus === 'suspended' ? 'high' : 'medium'
      };
      
      setAuditLogs(prev => [newAuditLog, ...prev]);
      
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const exportAuditLogs = async () => {
    setExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const csvContent = [
        ['Data/Hora', 'Usuário', 'Ação', 'Tipo', 'Detalhes', 'IP', 'Severidade'].join(','),
        ...filteredAuditLogs.map(log => [
          new Date(log.timestamp).toLocaleString('pt-BR'),
          log.user_name,
          log.action,
          log.target_type,
          log.details,
          log.ip_address,
          log.severity
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Logs de auditoria exportados com sucesso!');
      
    } catch (error) {
      console.error('Erro ao exportar logs:', error);
      toast.error('Erro ao exportar logs de auditoria');
    } finally {
      setExporting(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.role_id === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = log.user_name.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(auditSearchTerm.toLowerCase());
    const matchesSeverity = auditSeverityFilter === 'all' || log.severity === auditSeverityFilter;
    
    return matchesSearch && matchesSeverity;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'suspended': return 'destructive';
      default: return 'secondary';
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando controles de acesso...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Controles de Acesso</h2>
          <p className="text-muted-foreground">
            Gerencie permissões, funções e auditoria de acesso
          </p>
        </div>
      </div>

      <Tabs defaultValue="permissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Gerenciar Permissões</h3>
            <Dialog open={showAddPermission} onOpenChange={setShowAddPermission}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingPermission(null);
                  setPermissionForm({
                    name: '',
                    description: '',
                    category: 'system',
                    level: 'read'
                  });
                  setFormErrors({});
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Permissão
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingPermission ? 'Editar Permissão' : 'Nova Permissão'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure uma nova permissão do sistema
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCreatePermission} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={permissionForm.name}
                      onChange={(e) => setPermissionForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="ex: manage_users"
                      className={formErrors.name ? 'border-red-500' : ''}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-500">{formErrors.name}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Input
                      id="description"
                      value={permissionForm.description}
                      onChange={(e) => setPermissionForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva o que esta permissão permite"
                      className={formErrors.description ? 'border-red-500' : ''}
                    />
                    {formErrors.description && (
                      <p className="text-sm text-red-500">{formErrors.description}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Select value={permissionForm.category} onValueChange={(value: any) => 
                        setPermissionForm(prev => ({ ...prev, category: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PERMISSION_CATEGORIES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="level">Nível</Label>
                      <Select value={permissionForm.level} onValueChange={(value: any) => 
                        setPermissionForm(prev => ({ ...prev, level: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PERMISSION_LEVELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </form>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAddPermission(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    onClick={handleCreatePermission}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        {editingPermission ? 'Atualizando...' : 'Criando...'}
                      </>
                    ) : (
                      editingPermission ? 'Atualizar' : 'Criar Permissão'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {permissions.map(permission => (
              <Card key={permission.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{permission.name}</CardTitle>
                    <div className="flex items-center space-x-1">
                      <Badge variant="outline">
                        {PERMISSION_CATEGORIES[permission.category]}
                      </Badge>
                      <Badge variant={permission.level === 'admin' ? 'destructive' : 'secondary'}>
                        {PERMISSION_LEVELS[permission.level]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{permission.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Criado: {formatDate(permission.created_at)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPermission(permission);
                        setPermissionForm({
                          name: permission.name,
                          description: permission.description,
                          category: permission.category,
                          level: permission.level
                        });
                        setShowAddPermission(true);
                        setFormErrors({});
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Nome ou e-mail..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setRoleFilter('all');
                    }}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle>Usuários ({filteredUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{user.name}</h4>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline">{user.role_name}</Badge>
                          <Badge variant={getStatusBadgeVariant(user.status)}>
                            {STATUS_LABELS[user.status]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Criado: {formatDate(user.created_at)}</p>
                        {user.last_login && (
                          <p>Último login: {formatDate(user.last_login)}</p>
                        )}
                      </div>
                      
                      <Select
                        value={user.status}
                        onValueChange={(value: 'active' | 'inactive' | 'suspended') => 
                          toggleUserStatus(user.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativar</SelectItem>
                          <SelectItem value="inactive">Desativar</SelectItem>
                          <SelectItem value="suspended">Suspender</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          {/* Audit Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Logs de Auditoria</CardTitle>
                <Button
                  onClick={exportAuditLogs}
                  disabled={exporting}
                  variant="outline"
                >
                  {exporting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {exporting ? 'Exportando...' : 'Exportar CSV'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="audit-search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="audit-search"
                      placeholder="Usuário, ação ou detalhes..."
                      value={auditSearchTerm}
                      onChange={(e) => setAuditSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="severity">Severidade</Label>
                  <Select value={auditSeverityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAuditSearchTerm('');
                      setSeverityFilter('all');
                    }}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Registros de Auditoria ({filteredAuditLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredAuditLogs.map(log => (
                  <div key={log.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(log.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-sm">{log.user_name}</h4>
                          <Badge variant={getSeverityBadgeVariant(log.severity)}>
                            {log.severity}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{log.action}</p>
                      <p className="text-sm text-muted-foreground">{log.details}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                        <span>IP: {log.ip_address}</span>
                        <span>Tipo: {log.target_type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}