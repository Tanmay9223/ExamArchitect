import React, { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Shared/Navbar';
import ToastContainer from './components/Shared/ToastContainer';
import ProtectedRoute from './components/Shared/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import MockExam from './pages/MockExam';

export default function App() {
  const [toasts, setToasts] = useState([]);
  
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div className="min-h-screen text-slate-100 font-body relative overflow-x-hidden bg-[#0a0b10]">
      <Navbar />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      <main className="pb-20">
        <Routes>
          <Route path="/" element={<Home addToast={addToast} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/mock-exam" element={<MockExam />} />
          
          <Route path="/exam/:id" element={<Dashboard addToast={addToast} />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute adminOnly={true} />}>
            <Route path="/internal-admin" element={<Admin addToast={addToast} />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
