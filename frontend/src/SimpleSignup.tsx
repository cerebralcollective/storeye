import React, { useState } from 'react'
import { Auth } from 'aws-amplify'

export default function SimpleSignup() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const signUp = async () => {
    try {
      setLoading(true)
      const resp = await Auth.signUp({ username, password, attributes: { email } })
      alert('Signup started; check email for confirmation')
    } catch (e: any) {
      alert('Signup error: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{marginTop:12}}>
      <h3>Signup</h3>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} disabled={loading} />
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={loading} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} />
      <button onClick={signUp} disabled={loading} style={{marginLeft:8}}>Sign up</button>
    </div>
  )
}
