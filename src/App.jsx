import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import AnoLayout from './layouts/AnoLayout';
import SeniorLayout from './layouts/SeniorLayout';
import CadetLayout from './layouts/CadetLayout';        // ← NEW
import { ThemeProvider } from './components/ThemeContext';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // 1. Restore session on reload
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (event === 'USER_UPDATED') {
        setIsPasswordRecovery(false);
      }
      setSession(session);
      setProfile(null); // reset profile on auth change
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  // 3. Fetch profile when session exists
  useEffect(() => {
    if (!session) return;
    async function fetchProfile() {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('role, assigned_category, assigned_division, cadet_id') // ← cadet_id added
        .eq('id', session.user.id)
        .single();

      if (error) {
        setError('Your account is not assigned a role. Contact admin.');
        setProfile(null);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }
    fetchProfile();
  }, [session]);

  if (loading) return (
    <p style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '3rem' }}>
      Loading…
    </p>
  );

  if (isPasswordRecovery) return <Login initialFlow="newpass" />;
  if (!session) return <Login />;

  if (error) return (
    <p style={{ color: 'red', fontFamily: 'sans-serif', textAlign: 'center', marginTop: '3rem' }}>
      {error}
    </p>
  );
  if (!profile) return (
    <p style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '3rem' }}>
      Loading profile…
    </p>
  );

  // Role-based routing
  if (profile.role === 'ano')    return <AnoLayout />;
  if (profile.role === 'senior') return <SeniorLayout />;
  if (profile.role === 'cadet')  return <CadetLayout />;   // ← NEW

  return (
    <p style={{ color: 'red', fontFamily: 'sans-serif', textAlign: 'center', marginTop: '3rem' }}>
      Invalid role configuration. Contact your ANO.
    </p>
  );
}

export default function Root() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
