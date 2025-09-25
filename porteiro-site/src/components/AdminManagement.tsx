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
import { UserPlus, Users, Shield, Trash2, Edit, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from './NotificationSystem';
import { useAdminActions } from '@/hooks/useAdminActions';

interface Admin {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  last_login?: string;
  buildings_access?: string[];
}

interface AdminFormData {
  name: string;
  email: string;
  role: 'admin' | 'moderator';
  permissions: string[];
  buildings_access: string[];
}

const AVAILABLE_PERMISSIONS = [
  { id: 'manage_users', label: 'Gerenciar Usuários' },
  { id: 'manage_buildings', label: 'Gerenciar Prédios' },
  { id: 'manage_visitors', label: 'Gerenciar Visitantes' },
  { id: 'view_reports', label: 'Visualizar Relatórios' },
  { id: 'manage_communications', label: 'Gerenciar Comunicações' },
  { id: 'manage_polls', label: 'Gerenciar Enquetes' },
  { id: 'system_settings', label: 'Configurações do Sistema' },
  { id: 'audit_logs', label: 'Logs de Auditoria' }
];

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  moderator: 'Moderador'
};

const STATUS_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
  suspended: 'Suspenso'
};

export default function AdminManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState<AdminFormData>({
    name: '',
    email: '',
    role: 'admin',
    permissions: [],
    buildings_access: []
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const { addNotification } = useNotifications();
  const { 
    createAdmin, 
    updateAdmin, 
    deleteAdmin, 
    toggleAdminStatus,
    isLoading 
  } = useAdminActions();

  useEffect(() => {
    loadAdmins();
    loadBuildings();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      // Simulação de dados - em produção, buscar do Supabase
      const mockAdmins: Admin[] = [
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@porteiro.com',
          role: 'admin',
          permissions: ['manage_users', 'manage_buildings', 'view_reports'],
          status: 'active',
          created_at: '2024-01-15T10:00:00Z',
          last_login: '2024-01-20T14:30:00Z',
          buildings_access: ['1', '2']
        },
        {
          id: '2',
          name: 'Maria Santos',
          email: 'maria@porteiro.com',
          role: 'moderator',
          permissions: ['manage_visitors', 'view_reports'],
          status: 'active',
          created_at: '2024-01-10T09:00:00Z',
          last_login: '2024-01-19T16:45:00Z',
          buildings_access: ['1']
        },
        {
          id: '3',
          name: 'Carlos Oliveira',
          email: 'carlos@porteiro.com',
          role: 'admin',
          permissions: ['manage_communications', 'manage_polls'],
          status: 'suspended',
          created_at: '2024-01-05T11:00:00Z',
          buildings_access: ['3']
        }
      ];
      setAdmins(mockAdmins);
    } catch (error) {
      console.error('Erro ao carregar administradores:', error);
      toast.error('Erro ao carregar administradores');
    } finally {
      setLoading(false);
    }
  };

  const loadBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
      // Fallback para dados simulados
      setBuildings([
        { id: '1', name: 'Edifício Central' },
        { id: '2', name: 'Torre Norte' },
        { id: '3', name: 'Bloco Sul' }
      ]);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'E-mail inválido';
    }

    if (formData.permissions.length === 0) {
      errors.permissions = 'Selecione pelo menos uma permissão';
    }

    if (formData.buildings_access.length === 0) {
      errors.buildings_access = 'Selecione pelo menos um prédio';
    }

    // Verificar se e-mail já existe
    const emailExists = admins.some(admin => 
      admin.email.toLowerCase() === formData.email.toLowerCase() && 
      admin.id !== editingAdmin?.id
    );
    if (emailExists) {
      errors.email = 'E-mail já está em uso';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addNotification({
        type: 'error',
        title: 'Erro de validação',
        message: 'Por favor, corrija os erros no formulário'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (editingAdmin) {
        // Usar hook para atualizar administrador
        const success = await updateAdmin(editingAdmin.id, {
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          permissions: formData.permissions,
          buildings_access: formData.buildings_access
        });
        
        if (success) {
          // Atualizar admin existente
          const updatedAdmin: Admin = {
            ...editingAdmin,
            ...formData,
            id: editingAdmin.id,
            created_at: editingAdmin.created_at
          };
          
          setAdmins(prev => prev.map(admin => 
            admin.id === editingAdmin.id ? updatedAdmin : admin
          ));
          
          setEditingAdmin(null);
        }
      } else {
        // Usar hook para criar administrador
        const success = await createAdmin({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          permissions: formData.permissions,
          buildings_access: formData.buildings_access
        });
        
        if (success) {
          // Criar novo admin
          const newAdmin: Admin = {
            ...formData,
            id: Date.now().toString(),
            status: 'active',
            created_at: new Date().toISOString()
          };
          
          setAdmins(prev => [...prev, newAdmin]);
        }
      }
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'admin',
        permissions: [],
        buildings_access: []
      });
      setShowAddForm(false);
      setFormErrors({});
      
    } catch (error) {
      console.error('Erro ao salvar administrador:', error);
      addNotification({
        type: 'error',
        title: 'Erro interno',
        message: 'Erro inesperado ao salvar administrador'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAdminStatus = async (adminId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      const success = await toggleAdminStatus(adminId, newStatus);
      
      if (success) {
        setAdmins(prev => prev.map(admin => 
          admin.id === adminId ? { ...admin, status: newStatus } : admin
        ));
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      addNotification({
        type: 'error',
        title: 'Erro interno',
        message: 'Erro inesperado ao alterar status'
      });
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    try {
      const success = await deleteAdmin(adminId);
      
      if (success) {
        setAdmins(prev => prev.filter(admin => admin.id !== adminId));
      }
    } catch (error) {
      console.error('Erro ao remover administrador:', error);
      addNotification({
        type: 'error',
        title: 'Erro interno',
        message: 'Erro inesperado ao remover administrador'
      });
    }
  };

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      role: admin.role as 'admin' | 'moderator',
      permissions: admin.permissions,
      buildings_access: admin.buildings_access || []
    });
    setShowAddForm(true);
    setFormErrors({});
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'suspended': return 'destructive';
      default: return 'secondary';
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
        <span className="ml-2">Carregando administradores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gerenciamento de Administradores</h2>
          <p className="text-muted-foreground">
            Gerencie administradores, permissões e controles de acesso
          </p>
        </div>
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingAdmin(null);
              setFormData({
                name: '',
                email: '',
                role: 'admin',
                permissions: [],
                buildings_access: []
              });
              setFormErrors({});
            }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Administrador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAdmin ? 'Editar Administrador' : 'Adicionar Novo Administrador'}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do administrador e defina suas permissões
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome completo"
                    className={formErrors.name ? 'border-red-500' : ''}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className={formErrors.email ? 'border-red-500' : ''}
                  />
                  {formErrors.email && (
                    <p className="text-sm text-red-500">{formErrors.email}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={formData.role} onValueChange={(value: 'admin' | 'moderator') => 
                  setFormData(prev => ({ ...prev, role: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="moderator">Moderador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Permissões *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                  {AVAILABLE_PERMISSIONS.map(permission => (
                    <label key={permission.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              permissions: [...prev.permissions, permission.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              permissions: prev.permissions.filter(p => p !== permission.id)
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{permission.label}</span>
                    </label>
                  ))}
                </div>
                {formErrors.permissions && (
                  <p className="text-sm text-red-500">{formErrors.permissions}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Acesso aos Prédios *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto border rounded-md p-3">
                  {buildings.map(building => (
                    <label key={building.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.buildings_access.includes(building.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              buildings_access: [...prev.buildings_access, building.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              buildings_access: prev.buildings_access.filter(b => b !== building.id)
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{building.name}</span>
                    </label>
                  ))}
                </div>
                {formErrors.buildings_access && (
                  <p className="text-sm text-red-500">{formErrors.buildings_access}</p>
                )}
              </div>
            </form>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {editingAdmin ? 'Atualizando...' : 'Criando...'}
                  </>
                ) : (
                  editingAdmin ? 'Atualizar' : 'Criar Administrador'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Admins</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{admins.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {admins.filter(admin => admin.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
            <EyeOff className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {admins.filter(admin => admin.status === 'suspended').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <Eye className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {admins.filter(admin => admin.status === 'inactive').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admins List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Administradores</CardTitle>
          <CardDescription>
            Gerencie os administradores do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{admin.name}</h4>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline">{ROLE_LABELS[admin.role]}</Badge>
                      <Badge variant={getStatusBadgeVariant(admin.status)}>
                        {STATUS_LABELS[admin.status]}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Criado: {formatDate(admin.created_at)}</p>
                    {admin.last_login && (
                      <p>Último login: {formatDate(admin.last_login)}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(admin)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Select
                      value={admin.status}
                      onValueChange={(value: 'active' | 'inactive' | 'suspended') => 
                        handleToggleAdminStatus(admin.id, value)
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
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover o administrador {admin.name}? 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}