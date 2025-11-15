import React, { useState } from 'react'
import { Auth } from 'aws-amplify'

export default function SimpleLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    try {
      setLoading(true)
      const user = await Auth.signIn(username, password)
      alert('Signed in: ' + (user?.username || ''))
    } catch (e: any) {
      alert('Sign in error: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{marginTop:12}}>
      <h3>Login</h3>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} disabled={loading} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} />
      <button onClick={signIn} disabled={loading} style={{marginLeft:8}}>Sign in</button>
    </div>
  )
}
