import React, { useState } from 'react';
import { signUp, type SignUpOutput } from 'aws-amplify/auth';

export default function SimpleSignup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!username || !email || !password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);

      const { isSignUpComplete, userId, nextStep }: SignUpOutput = await signUp({
        username, // can be username or email
        password,
        options: {
          userAttributes: {
            email,  // Cognito user attribute
            // Can add more: name, phone_number, etc.
          },
          // Optional: auto-sign-in after confirmation
          autoSignIn: { enabled: true },
        },
      });

      if (isSignUpComplete) {
        alert('Account created and you are signed in!');
      } else {
        alert(
          'Signup started — check your email for the verification code.\n' +
          `Next step: ${nextStep.signUpStep}` // usually "CONFIRM_SIGN_UP"
        );
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      alert('Signup failed: ' + (error.message || error.name || String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <h3>Signup</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())}
          disabled={loading}
          style={{ padding: '10px 12px', fontSize: 16 }}
        />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          disabled={loading}
          style={{ padding: '10px 12px', fontSize: 16 }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{ padding: '10px 12px', fontSize: 16 }}
        />

        <button
          onClick={handleSignUp}
          disabled={loading}
          style={{
            padding: '12px 20px',
            fontSize: 16,
            backgroundColor: loading ? '#999' : '#0066ff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </div>
    </div>
  );
}