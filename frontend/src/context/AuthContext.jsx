import React, { createContext, useState, useEffect, useContext } from 'react';
import { API_BASE } from '../config';

const AuthContext = createContext();

const getErrorMessage = (detail, defaultMsg) => {
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(err => {
      const field = err.loc && err.loc.length > 1 ? err.loc.slice(1).join('.') : '';
      return field ? `${field}: ${err.msg}` : err.msg;
    }).join(', ');
  }
  if (typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }
  return String(detail);
};



export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchProfile(token);
    } else {
      localStorage.removeItem('token');
      setCurrentUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async (currentToken) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      } else {
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(getErrorMessage(error.detail, 'Login failed'));
    }

    const data = await res.json();
    setToken(data.access_token);
  };

  const register = async (name, email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(getErrorMessage(error.detail, 'Registration failed'));
    }

    // Auto login after register
    await login(email, password);
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
