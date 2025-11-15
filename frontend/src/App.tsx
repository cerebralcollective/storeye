import React, { useState } from 'react'
import DocView from './DocView'
import SimpleLogin from './SimpleLogin'
import SimpleSignup from './SimpleSignup'

type ViewName = 'doc' | 'login' | 'signup'

export default function App() {
  const [view, setView] = useState<ViewName>('doc')
  return (
    <div style={{padding:20}}>
      <h2>Document Viewer</h2>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button onClick={()=>setView('doc')}>Doc</button>
        <button onClick={()=>setView('login')}>Login</button>
        <button onClick={()=>setView('signup')}>Signup</button>
      </div>
      {view === 'doc' && <DocView />}
      {view === 'login' && <SimpleLogin />}
      {view === 'signup' && <SimpleSignup />}
    </div>
  )
}
