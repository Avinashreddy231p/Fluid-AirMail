import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import Login from './Login.tsx'
import Register from './Register.tsx'
import ForgotPassword from './ForgotPassword.tsx'
import ProtectedRoute from './ProtectedRoute.tsx'
import { AuthProvider } from './AuthContext.tsx'
import './index.css'

const theme = localStorage.getItem('theme');
if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
  document.documentElement.classList.remove('light');
} else {
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
}

const accentColor = localStorage.getItem('accentColor');
if (accentColor) {
  document.documentElement.style.setProperty('--color-primary', accentColor);
  let r = parseInt(accentColor.slice(1, 3), 16);
  let g = parseInt(accentColor.slice(3, 5), 16);
  let b = parseInt(accentColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--color-primary-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
  </React.StrictMode>,
)

