import React from 'react'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

interface LoginProps {
  children: React.ReactNode
}

export default function Login({ children }: LoginProps) {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div>
          <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
            <span>Logged in as: {user?.username}</span>
            <button onClick={signOut} style={{ marginLeft: '10px' }}>
              Sign out
            </button>
          </div>
          {children}
        </div>
      )}
    </Authenticator>
  )
}
