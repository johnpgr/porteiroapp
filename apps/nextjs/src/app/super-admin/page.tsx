import { redirect } from 'next/navigation';

export default function SuperAdminPage() {
  redirect('/super-admin/dashboard');
  return null;
}