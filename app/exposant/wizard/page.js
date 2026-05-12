'use client';
import { useEffect, useState } from 'react';
import WizardForm from '@/components/wizard-form';
import { Loader2 } from 'lucide-react';

export default function ExposantWizardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = JSON.parse(localStorage.getItem('forum_session') || 'null');
    if (!s || s.role !== 'exposant') {
      window.location.href = '/';
      return;
    }
    setUser(s);
    setLoading(false);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!user?.registration_id) return <div className="p-8 text-center text-red-600">Aucune inscription associée à votre compte.</div>;

  return <WizardForm registrationId={user.registration_id} isPublic={false} />;
}
