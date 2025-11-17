import React, { useState } from 'react';
import { signIn } from 'aws-amplify/auth';   // v6 import (no more Auth class)

export default function SimpleLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!username || !password) {
      alert('Please enter username and password');
      return;
    }

    try {
      setLoading(true);

      // v6 syntax – returns a SignInOutput (user + tokens)
      const result = await signIn({
        username,
        password,
        options: {
          authFlowType: 'USER_PASSWORD_AUTH', // optional, default is fine
        },
      });

      // result.isSignedIn === true on success
      alert(`Signed in successfully! Welcome ${username}`);
      console.log('Sign-in result:', result);
    } catch (error: any) {
      console.error('Sign-in error:', error);
      alert('Sign in failed: ' + (error.message || error.name || String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <h3>Login</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Username / Email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          style={{ padding: '8px 12px', fontSize: 16, minWidth: 220 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{ padding: '8px 12px', fontSize: 16, minWidth: 220 }}
        />
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            padding: '8px 16px',
            fontSize: 16,
            background: loading ? '#999' : '#0066ff',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}