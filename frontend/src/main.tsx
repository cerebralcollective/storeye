import React from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App'
import Login from './Login'

// Configure Amplify with Cognito
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID as string,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID as string,
      region: import.meta.env.VITE_AWS_REGION as string || 'us-east-2',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Login>
      <App />
    </Login>
  </React.StrictMode>
)
