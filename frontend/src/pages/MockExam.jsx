import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrainCircuit, BookOpen, AlertCircle, Save, CheckCircle, SaveAll } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function MockExam() {
  const { currentUser } = useAuth();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [difficulty, setDifficulty] = useState('M');
  const [loading, setLoading] = useState(false);
  const [mockExam, setMockExam] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/exams`)
      .then(res => res.json())
      .then(data => {
        setExams(data);
        if (data.length > 0) setSelectedExamId(data[0].id);
      })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!selectedExamId) return;
    setLoading(true);
    setMockExam(null);
    setSaveStatus('');
    try {
      // In a real app we'd pass topic_weights or target_difficulty to a generation endpoint.
      // We will fetch 10 random questions from the questions endpoint matching the exam
      const res = await fetch(`${API_BASE}/api/questions?exam_id=${selectedExamId}`);
      const data = await res.json();
      
      // Shuffle and pick 10
      const shuffled = [...data].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10);
      
      const newMock = {
        title: `Generated Mock Exam - ${new Date().toLocaleDateString()}`,
        questions: selected
      };
      
      setMockExam(newMock);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    if (!mockExam || mockExam.questions.length === 0) return;
    
    setSaveStatus('saving');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/user-exams/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exam_id: selectedExamId,
          score: 0,
          details: JSON.stringify(mockExam)
        })
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-display mb-4">AI Mock Exam Generator</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">Generate realistic mock tests based on historical paper distributions. Guest users can preview tests, but you need an account to save them to your profile.</p>
      </div>

      <div className="max-w-3xl mx-auto glass-panel p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Target Examination</label>
            <select 
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
            >
              <option value="">Select Exam...</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Difficulty Profile</label>
            <select 
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
            >
              <option value="E">Easy (Conceptual focus)</option>
              <option value="M">Medium (Balanced standard)</option>
              <option value="H">Hard (Numerical & tricky)</option>
            </select>
          </div>
        </div>
        <button 
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
          onClick={handleGenerate}
          disabled={loading || !selectedExamId}
        >
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <BrainCircuit />}
          {loading ? 'Synthesizing...' : 'Generate New Mock Paper'}
        </button>
      </div>

      {mockExam && (
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="glass-panel p-6 mb-6 flex flex-wrap justify-between items-center gap-4 border-l-4 border-l-emerald-500">
            <div>
              <h2 className="text-xl font-bold">{mockExam.title}</h2>
              <p className="text-slate-400 text-sm mt-1">{mockExam.questions.length} Questions • Estimated Time: 30 mins</p>
            </div>
            
            {currentUser ? (
              <button 
                onClick={handleSave}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                  saveStatus === 'saved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                  'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
              >
                {saveStatus === 'saving' ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 
                 saveStatus === 'saved' ? <CheckCircle size={18} /> : <SaveAll size={18} />}
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved to Profile' : 'Save for Later'}
              </button>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg flex items-center gap-2 text-amber-500 text-sm">
                <AlertCircle size={16} /> Login to save this exam
              </div>
            )}
          </div>

          <div className="space-y-6">
            {mockExam.questions.map((q, idx) => (
              <div key={idx} className="glass-panel p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-bold text-indigo-400">Question {idx + 1}</span>
                  <span className="text-xs px-2 py-1 bg-white/5 rounded text-slate-300 border border-white/10">{q.marks} Mark(s)</span>
                </div>
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
                {/* Options and spoiler logic can be simplified here for the mock test view */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-sm font-semibold text-slate-400">Correct Answer:</div>
                  <div className="mt-1 text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded inline-block">
                    {q.correct_answer || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
