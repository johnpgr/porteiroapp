import React from 'react';
import ProtectedRoute from '~/components/ProtectedRoute';
import CadastrarVisitante from './CadastrarVisitante';

export default function NovoVisitante() {
  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <CadastrarVisitante />
    </ProtectedRoute>
  );
}
