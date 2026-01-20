import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import AnoLayout from './layouts/AnoLayout';
import SeniorLayout from './layouts/SeniorLayout';
function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1️⃣ Restore session on reload
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2️⃣ Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setProfile(null); // reset profile on auth change
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 3️⃣ Fetch profile when session exists
  useEffect(() => {
    if (!session) return;

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('role, assigned_category, assigned_division')
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

  if (loading) return <p>Loading...</p>;

  // Not logged in
  if (!session) {
    return <Login />;
  }

  // Logged in but no role
  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  if (!profile) {
    return <p>Loading profile...</p>;
  }

  // Role-based routing
  if (profile.role === 'ano') {
    return <AnoLayout />;
  }

  if (profile.role === 'senior') {
    return <SeniorLayout />;
  }

  return <p>Invalid role configuration.</p>;
}

export default App;
