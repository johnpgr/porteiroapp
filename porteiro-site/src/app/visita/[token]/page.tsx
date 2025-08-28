import VisitaApprovalClient from './VisitaApprovalClient';

export default async function VisitaApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return <VisitaApprovalClient token={token} />;
}