import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, BarChart3, TrendingUp, ListTodo, BookOpen,
  Flame, Calendar, ChevronRight, CheckCircle, Search, Image, MessageSquare, Send
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend);

const API_BASE = 'http://localhost:8000';

function AnswerSpoiler({ answer }) {
  const [open, setOpen] = useState(false);
  if (!answer) return null;
  return (
    <div className="mt-4">
      <button
        className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? 'Hide Answer' : 'Show Answer'}
      </button>
      {open && (
        <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-100 text-sm">
          <strong>Correct Answer:</strong> {answer}
        </div>
      )}
    </div>
  );
}

function QuestionFeedback({ questionId }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('Error in Question');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(''); // 'sending', 'sent', 'error'
  const { currentUser } = useAuth();

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setStatus('sending');
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE}/api/questions/${questionId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ feedback_type: type, comment })
      });
      if (res.ok) {
        setStatus('sent');
        setTimeout(() => setOpen(false), 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <button
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-amber-400 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <MessageSquare size={14} /> Report Issue / Provide Feedback
      </button>

      {open && (
        <div className="mt-3 bg-black/30 border border-white/5 p-4 rounded-xl">
          {!currentUser ? (
            <p className="text-xs text-rose-400">Please login to submit feedback.</p>
          ) : status === 'sent' ? (
            <p className="text-xs text-emerald-400 flex items-center gap-2"><CheckCircle size={14} /> Feedback submitted successfully. Thank you!</p>
          ) : (
            <div className="flex flex-col gap-3">
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="bg-black/50 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none"
              >
                <option>Error in Question</option>
                <option>Wrong Answer Key</option>
                <option>Formatting Issue</option>
                <option>Other</option>
              </select>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Describe the issue..."
                className="bg-black/50 border border-white/10 rounded p-2 text-xs text-white outline-none min-h-[60px]"
              />
              <button
                onClick={handleSubmit}
                disabled={status === 'sending'}
                className="self-end bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <Send size={12} /> {status === 'sending' ? 'Sending...' : 'Submit'}
              </button>
              {status === 'error' && <p className="text-xs text-rose-400">Failed to submit feedback. Try again.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseOptions(text) {
  if (!text) return null;
  const mcqPattern = /(?:\(|\s|^)([A-D])\)(?:\s+|:)([\s\S]*?)(?=\s*(?:\(|^[A-D]\)|[A-D]\s*[\.):]|$))/g;
  const matches = [...text.matchAll(mcqPattern)];
  if (matches.length > 0) {
    const options = matches.map(m => ({ label: m[1], text: m[2].trim() }));
    const firstOptionIdx = text.search(/(?:\(|\s|^)[A-D]\)(?:\s+|:)/);
    const cleanText = firstOptionIdx !== -1 ? text.substring(0, firstOptionIdx).trim() : text;
    return { cleanText, options };
  }
  const dotPattern = /(?:\s|^)([A-D])\.(?:\s+|:)([\s\S]*?)(?=\s*(?:^[A-D]\.|[A-D]\s*[\.):]|$))/g;
  const matchesDot = [...text.matchAll(dotPattern)];
  if (matchesDot.length > 0) {
    const options = matchesDot.map(m => ({ label: m[1], text: m[2].trim() }));
    const firstOptionIdx = text.search(/(?:\s|^)[A-D]\.(?:\s+|:)/);
    const cleanText = firstOptionIdx !== -1 ? text.substring(0, firstOptionIdx).trim() : text;
    return { cleanText, options };
  }
  return null;
}

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [selectedExam, setSelectedExam] = useState(null);
  const [activeTab, setActiveTab] = useState('heatmap');
  const [loading, setLoading] = useState(true);

  // Data states
  const [heatmapData, setHeatmapData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [papers, setPapers] = useState([]);
  const [studyPlan, setStudyPlan] = useState([]);
  const [examTopics, setExamTopics] = useState([]);

  // Tab specific states
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 10;

  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [subtopicHeatmaps, setSubtopicHeatmaps] = useState({});
  const [selectedHeatmapTopic, setSelectedHeatmapTopic] = useState(null);

  const [studyPlanDays, setStudyPlanDays] = useState('30');
  const [studyPlanWeaknesses, setStudyPlanWeaknesses] = useState('');
  const [weaknessExpandedSubjects, setWeaknessExpandedSubjects] = useState({});

  useEffect(() => {
    // Fetch Exam metadata and dashboards
    fetch(`${API_BASE}/api/exams?category_id=1`) // Hack to find it or we can fetch by id if backend supports. But let's fetch all and filter
      .then(res => res.json())
      .then(exams => {
        const ex = exams.find(e => e.id === parseInt(id)) || { id, full_name: 'Exam', name: 'EXAM' };
        setSelectedExam(ex);

        Promise.all([
          fetch(`${API_BASE}/api/exams/${id}/heatmap`).then(res => res.json()),
          fetch(`${API_BASE}/api/exams/${id}/predictions`).then(res => res.json()),
          fetch(`${API_BASE}/api/exams/${id}/papers`).then(res => res.json()),
          fetch(`${API_BASE}/api/exams/${id}/study-plan?total_days=30`).then(res => res.ok ? res.json() : []),
          fetch(`${API_BASE}/api/exams/${id}/topics`).then(res => res.json())
        ])
          .then(([heatmap, preds, papersData, plan, topics]) => {
            setHeatmapData(heatmap);
            setPredictions(preds);
            setPapers(papersData);
            setStudyPlan(plan);
            setExamTopics(topics);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      });
  }, [id]);

  const fetchQuestionsList = useCallback(() => {
    const params = new URLSearchParams();
    if (questionSearch.trim()) params.set('search', questionSearch.trim());
    if (questionSubjectFilter) params.set('subject_id', questionSubjectFilter);
    params.set('exam_id', id);
    const queryStr = params.toString() ? `?${params.toString()}` : '';

    let url = selectedPaper ? `${API_BASE}/api/papers/${selectedPaper.id}/questions${queryStr}` : `${API_BASE}/api/questions${queryStr}`;

    fetch(url)
      .then(res => res.json())
      .then(data => setQuestions(data))
      .catch(err => console.error(err));
  }, [id, selectedPaper, questionSubjectFilter, questionSearch]);

  useEffect(() => {
    if (activeTab === 'questions') fetchQuestionsList();
  }, [selectedPaper, questionSubjectFilter, activeTab, fetchQuestionsList]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'questions') fetchQuestionsList();
    }, 300);
    return () => clearTimeout(timer);
  }, [questionSearch, activeTab, fetchQuestionsList]);

  const handleUpdateStudyPlan = async () => {
    if (!currentUser) {
      alert("Please login to generate custom study plans.");
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const body = {
        total_days: parseInt(studyPlanDays) || 30,
        weakness_topics: studyPlanWeaknesses ? studyPlanWeaknesses.split(',').map(s => s.trim()).filter(Boolean) : null
      };
      const res = await fetch(`${API_BASE}/api/exams/${id}/study-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        setStudyPlan(data);
      } else {
        alert("Failed to generate plan");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderHeatmapCell = (marks, key) => {
    const maxMark = 16;
    let bgIntensity = 'rgba(255,255,255,0.02)';
    let textColor = '#94a3b8';
    if (marks > 0) {
      if (marks <= 3) {
        bgIntensity = `linear-gradient(135deg, rgba(251, 191, 36, ${0.15 + (marks / 3) * 0.25}), rgba(217, 119, 6, ${0.15 + (marks / 3) * 0.25}))`;
        textColor = '#fcd34d';
      } else if (marks <= 7) {
        bgIntensity = `linear-gradient(135deg, rgba(249, 115, 22, ${0.4 + ((marks - 3) / 4) * 0.3}), rgba(234, 88, 12, ${0.4 + ((marks - 3) / 4) * 0.3}))`;
        textColor = '#ffffff';
      } else {
        bgIntensity = `linear-gradient(135deg, rgba(239, 68, 68, ${0.7 + ((marks - 7) / 9) * 0.25}), rgba(185, 28, 28, ${0.7 + ((marks - 7) / 9) * 0.25}))`;
        textColor = '#ffffff';
      }
    }
    return (
      <div key={key} style={{ background: bgIntensity, color: textColor }} className="py-1.5 px-1 rounded font-bold text-center text-xs border border-white/5">
        {marks > 0 ? `${marks.toFixed(0)}m` : '0m'}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 flex justify-center items-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 animate-fade-in">
      {/* Header Banner */}
      <div className="glass-panel p-6 mb-8 border-l-4 border-l-indigo-500 flex flex-wrap justify-between items-center gap-6">
        <div>
          <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-2" onClick={() => navigate('/')}>
            <ChevronLeft size={16} /> Choose Exam
          </button>
          <h2 className="text-2xl font-bold font-display">{selectedExam?.full_name || 'Exam'} Dashboard</h2>
          <p className="text-sm text-slate-400">Database Papers: {papers.length} Years • Prediction Model: Statistical v5</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-8 overflow-x-auto">
        {[
          { id: 'heatmap', icon: BarChart3, label: 'Topic Heatmap' },
          { id: 'predictions', icon: TrendingUp, label: 'AI Predictions' },
          { id: 'studyplan', icon: ListTodo, label: 'Dynamic Study Plan' },
          { id: 'questions', icon: BookOpen, label: 'Question Browser' }
        ].map(t => (
          <button
            key={t.id}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === t.id ? 'border-indigo-500 text-white bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>

      {/* HEATMAP TAB */}
      {activeTab === 'heatmap' && (
        <div className="glass-panel p-6 animate-fade-in">
          <h3 className="text-xl font-bold mb-6">Decadal Topic Heatmap</h3>
          <div className="overflow-x-auto bg-[#191c2c]/40 rounded-xl p-4 border border-white/5">
            {heatmapData && heatmapData.data?.length > 0 ? (
              (() => {
                const years = heatmapData.years.length > 0 ? heatmapData.years : [2015, 2016, 2017, 2018, 2019, 2020];
                const parentTopicMap = {};
                heatmapData.data.forEach(t => {
                  if (!t.parent_id) {
                    parentTopicMap[t.id] = { id: t.id, name: t.name, years: {} };
                    years.forEach(y => { parentTopicMap[t.id].years[y] = 0; });
                  }
                });
                heatmapData.data.forEach(t => {
                  const parentId = t.parent_id || t.id;
                  if (parentTopicMap[parentId]) {
                    Object.entries(t.years || {}).forEach(([y, data]) => {
                      parentTopicMap[parentId].years[y] = (parentTopicMap[parentId].years[y] || 0) + (data.total_marks || 0);
                    });
                  }
                });
                return (
                  <div className="min-w-[800px]">
                    <div className="grid gap-1 mb-2 border-b border-white/10 pb-2 text-xs font-bold text-slate-400" style={{ gridTemplateColumns: `240px repeat(${years.length}, 1fr)` }}>
                      <div>Subject / Subtopic</div>
                      {years.map(y => <div key={y} className="text-center">{y}</div>)}
                    </div>
                    {Object.values(parentTopicMap).map(row => (
                      <div key={row.id} className="grid gap-1 items-center py-2 border-b border-white/5" style={{ gridTemplateColumns: `240px repeat(${years.length}, 1fr)` }}>
                        <div className="text-sm font-semibold text-white">{row.name}</div>
                        {years.map((y, i) => renderHeatmapCell(row.years[y] || 0, i))}
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <p className="text-center text-slate-400 py-10">No heatmap data available. Ensure ingestion is completed.</p>
            )}
          </div>
        </div>
      )}

      {/* PREDICTIONS TAB */}
      {activeTab === 'predictions' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="glass-panel p-6 flex items-center gap-4 border-amber-500/30">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Flame size={24} />
              </div>
              <div>
                <span className="text-sm text-slate-400 block">Top predicted topic</span>
                <h4 className="text-lg font-bold text-white">{predictions[0]?.topic_name || 'Loading...'}</h4>
              </div>
            </div>
          </div>
          <div className="glass-panel p-6">
            <h3 className="text-xl font-bold mb-6">Upcoming Exam Probability Analysis</h3>
            <div className="flex flex-col gap-4">
              {predictions.map((pred, i) => (
                <div key={i} className="bg-[#191c2c]/60 border border-white/5 p-4 rounded-xl">
                  <div className="flex flex-wrap justify-between items-center mb-2">
                    <div>
                      <strong className="text-lg text-white block">{pred.topic_name}</strong>
                      <span className="text-xs text-slate-400">Category: {pred.parent_topic_name || 'General'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded bg-white/5 ${pred.predicted_probability >= 0.9 ? 'text-rose-500' : 'text-amber-500'}`}>
                        {pred.predicted_probability >= 0.9 ? 'Highly Critical' : 'Rising Weight'}
                      </span>
                      <span className="text-2xl font-bold text-emerald-400">{Math.round(pred.predicted_probability * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">{pred.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STUDY PLAN TAB */}
      {activeTab === 'studyplan' && (
        <div className="glass-panel p-6 animate-fade-in">
          <h3 className="text-xl font-bold mb-2">AI-Prioritized Study Roadmap</h3>
          <p className="text-sm text-slate-400 mb-6">Generate a custom plan focusing on high-probability topics.</p>

          <div className="bg-[#191c2c]/60 border border-white/5 p-6 rounded-xl mb-8 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Duration (Days)</label>
              <input type="number" value={studyPlanDays} onChange={e => setStudyPlanDays(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white w-24 outline-none focus:border-indigo-500" />
            </div>
            <div className="flex-grow">
              <label className="block text-xs text-slate-400 mb-1">Target Weaknesses (comma separated)</label>
              <input type="text" value={studyPlanWeaknesses} onChange={e => setStudyPlanWeaknesses(e.target.value)} placeholder="e.g. Cache mapping, SQL Queries" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white w-full outline-none focus:border-indigo-500" />
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={handleUpdateStudyPlan}>
              <Calendar size={16} /> Generate Plan
            </button>
            {!currentUser && <p className="text-xs text-rose-400 w-full mt-2">Login is required to generate custom plans.</p>}
          </div>

          <div className="flex flex-col gap-4">
            {studyPlan.length > 0 ? studyPlan.map((plan, i) => (
              <div key={i} className="flex gap-6 bg-[#191c2c]/40 border border-white/5 p-5 rounded-xl">
                <div className="text-center min-w-[80px]">
                  <span className="block text-sm font-bold text-indigo-400">{plan.day}</span>
                  <span className="text-xs text-slate-400">{plan.time}</span>
                </div>
                <div className="w-[1px] bg-white/10"></div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">{plan.title}</h4>
                  <ul className="flex flex-col gap-2">
                    {plan.tasks.map((task, tIdx) => (
                      <li key={tIdx} className="text-sm text-slate-300 flex items-start gap-2">
                        <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )) : <p className="text-center text-slate-400 py-6">No plan generated.</p>}
          </div>
        </div>
      )}

      {/* QUESTIONS TAB */}
      {activeTab === 'questions' && (
        <div className="glass-panel p-6 animate-fade-in">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4 border-b border-white/10 pb-6">
            <h3 className="text-xl font-bold">Historical Question Explorer</h3>
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-semibold">{questions.length} Questions</span>
          </div>

          <div className="flex flex-wrap gap-4 mb-8">
            <div className="flex-grow bg-black/30 border border-white/10 rounded-lg flex items-center px-3 focus-within:border-indigo-500/50 transition-colors">
              <Search size={18} className="text-slate-400" />
              <input type="text" value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} placeholder="Search questions..." className="bg-transparent border-none text-white w-full py-2.5 px-3 focus:outline-none" />
            </div>
            <select className="bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" value={selectedPaper?.id || ''} onChange={e => {
              const val = e.target.value;
              setSelectedPaper(val ? papers.find(p => p.id === parseInt(val)) : null);
            }}>
              <option value="">All Papers</option>
              {papers.map(p => <option key={p.id} value={p.id}>GATE CS {p.year}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-4">
            {questions.slice((currentPage - 1) * questionsPerPage, currentPage * questionsPerPage).map(q => {
              const parsed = parseOptions(q.question_text);
              const cleanText = parsed ? parsed.cleanText : q.question_text;
              const options = parsed ? parsed.options : [];
              return (
                <div key={q.id} className="bg-[#191c2c]/40 border border-white/5 rounded-xl overflow-hidden hover:border-indigo-500/30 transition-colors">
                  <div className="bg-black/20 px-5 py-3 border-b border-white/5 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-400">Q.{q.question_number}</span>
                      {!selectedPaper && <span className="text-xs px-2 py-0.5 border border-white/10 rounded text-slate-300">GATE CS {q.paper_year}</span>}
                      <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">{q.question_style}</span>
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">{q.marks} Mark(s)</span>
                    </div>
                    {q.topic_name && <span className="text-xs font-semibold text-slate-400 px-3 py-1 bg-white/5 rounded-full">{q.topic_name}</span>}
                  </div>
                  <div className="p-5">
                    <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{cleanText}</p>
                    {options.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {options.map((opt, oIdx) => (
                          <div key={oIdx} className="bg-white/5 border border-white/10 p-3 rounded-lg flex items-start gap-3">
                            <span className="font-bold text-indigo-400 shrink-0">{opt.label})</span>
                            <span className="text-slate-300 text-sm">{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.has_diagram && (
                      <div className="mt-4 flex items-center gap-2 text-amber-500/80 text-sm bg-amber-500/10 p-3 rounded-lg w-fit">
                        <Image size={16} /> Contains diagram (Placeholder)
                      </div>
                    )}
                    <AnswerSpoiler answer={q.correct_answer} />
                    <QuestionFeedback questionId={q.id} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {questions.length > questionsPerPage && (
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
              <span className="text-sm text-slate-400">Showing {(currentPage - 1) * questionsPerPage + 1} to {Math.min(currentPage * questionsPerPage, questions.length)} of {questions.length}</span>
              <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50 text-sm">Prev</button>
                <button disabled={currentPage * questionsPerPage >= questions.length} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
