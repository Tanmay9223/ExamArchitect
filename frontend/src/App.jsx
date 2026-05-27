import React, { useState, useEffect, useCallback, useRef } from 'react';
import QuestionCard from './components/QuestionCard';
import { 
  Cpu, 
  Activity, 
  BookOpen, 
  BarChart3, 
  Layers, 
  Settings, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Calendar, 
  ListTodo,
  TrendingUp,
  AlertTriangle,
  Flame,
  Search,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Image,
  Eye,
  EyeOff,
  RefreshCw,
  Check
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './App.css';
import AdminPanel from './components/AdminPanel';
import GithubGlobe from './components/GithubGlobe';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE = 'http://localhost:8000';

// ============= Helper to parse MCQ Options =============
function parseOptions(text) {
  if (!text) return null;
  
  // Regex to match options like (A) ... (B) ...
  const mcqPattern = /(?:\(|\s|^)([A-D])\)(?:\s+|:)([\s\S]*?)(?=\s*(?:\(|^[A-D]\)|[A-D]\s*[\.):]|$))/g;
  const matches = [...text.matchAll(mcqPattern)];
  if (matches.length > 0) {
    const options = matches.map(m => ({
      label: m[1],
      text: m[2].trim()
    }));
    const firstOptionIdx = text.search(/(?:\(|\s|^)[A-D]\)(?:\s+|:)/);
    const cleanText = firstOptionIdx !== -1 ? text.substring(0, firstOptionIdx).trim() : text;
    return { cleanText, options };
  }

  // Regex to match options like A. ... B. ...
  const dotPattern = /(?:\s|^)([A-D])\.(?:\s+|:)([\s\S]*?)(?=\s*(?:^[A-D]\.|[A-D]\s*[\.):]|$))/g;
  const matchesDot = [...text.matchAll(dotPattern)];
  if (matchesDot.length > 0) {
    const options = matchesDot.map(m => ({
      label: m[1],
      text: m[2].trim()
    }));
    const firstOptionIdx = text.search(/(?:\s|^)[A-D]\.(?:\s+|:)/);
    const cleanText = firstOptionIdx !== -1 ? text.substring(0, firstOptionIdx).trim() : text;
    return { cleanText, options };
  }

  return null;
}

// ============= Helper to generate Fallback study roadmap =============
function getFallbackPlan(days) {
  const parsedDays = parseInt(days) || 30;
  const boundedDays = Math.max(7, Math.min(365, parsedDays));

  const blocks = Math.min(4, boundedDays);
  if (blocks <= 0) return [];
  const daysPerBlock = Math.floor(boundedDays / blocks);
  const extraDays = boundedDays % blocks;
  const topics = [
    { name: 'Discrete Mathematics', tasks: ['Master Mathematical Logic & Set Theory basics', 'Solve Graph Theory & Combinatorics problems'] },
    { name: 'Computer Organization & Architecture', tasks: ['Revise Cache Memory hierarchy & mapping', 'Practice Instruction Pipelining numeric problems'] },
    { name: 'Programming & Algorithms', tasks: ['Practice Recursion tree analysis & time complexity', 'Review Searching, Sorting & Hashing rules'] },
    { name: 'Operating Systems & Databases', tasks: ['Solve CPU Scheduling & Semaphore sync problems', 'Revise Relational Algebra & SQL queries'] }
  ];
  
  let currentDay = 1;
  return Array.from({ length: blocks }).map((_, i) => {
    const blockDays = daysPerBlock + (i < extraDays ? 1 : 0);
    const startDay = currentDay;
    const endDay = currentDay + blockDays - 1;
    currentDay = endDay + 1;
    
    return {
      day: startDay === endDay ? `Day ${startDay}` : `Days ${startDay}-${endDay}`,
      title: `Core Focus: ${topics[i % topics.length].name}`,
      tasks: topics[i % topics.length].tasks,
      time: `${blockDays * 4} Hrs Study`
    };
  });
}

// ============= Toast Notification Component =============
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => onDismiss(toast.id)}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertTriangle size={16} />}
          {toast.type === 'info' && <RefreshCw size={16} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// ============= Answer Spoiler Component =============
function AnswerSpoiler({ answer }) {
  const [open, setOpen] = useState(false);
  if (!answer) return null;
  return (
    <div className="answer-spoiler">
      <button className={`answer-spoiler-toggle ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <ChevronRight size={14} />
        {open ? 'Hide Answer' : 'Show Answer'}
      </button>
      {open && (
        <div className="answer-spoiler-content">
          Correct Answer: {answer}
        </div>
      )}
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'admin'
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeTab, setActiveTab] = useState('heatmap'); // heatmap, predictions, studyplan, questions
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Exam-specific states
  const [heatmapData, setHeatmapData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null); // null means "All Papers"
  const [questions, setQuestions] = useState([]);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState('');

  // Heatmap View Toggle Mode ('density', 'marks', 'questions')
  const [heatmapViewMode, setHeatmapViewMode] = useState('marks');

  // Study plan and trend states
  const [studyPlanDays, setStudyPlanDays] = useState('30');
  const [studyPlanStartDate, setStudyPlanStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [studyPlanTargetDate, setStudyPlanTargetDate] = useState(() => {
    const target = new Date();
    target.setDate(target.getDate() + 30);
    return target.toISOString().split('T')[0];
  });
  const [studyPlan, setStudyPlan] = useState([]);
  const [studyPlanWeaknesses, setStudyPlanWeaknesses] = useState('');
  const [selectedHeatmapTopic, setSelectedHeatmapTopic] = useState(null);

  // Completed tasks checklist state
  const [completedTasks, setCompletedTasks] = useState(() => {
    const saved = localStorage.getItem('studyPlanCompletedTasks');
    return saved ? JSON.parse(saved) : {};
  });

  const handleToggleTask = (taskKey) => {
    setCompletedTasks(prev => {
      const updated = { ...prev, [taskKey]: !prev[taskKey] };
      localStorage.setItem('studyPlanCompletedTasks', JSON.stringify(updated));
      return updated;
    });
  };

  // Heatmap accordion drilldown states
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [subtopicHeatmaps, setSubtopicHeatmaps] = useState({});

  // Question browser states
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState('');
  const [examTopics, setExamTopics] = useState([]);
  const [weaknessExpandedSubjects, setWeaknessExpandedSubjects] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [questionsPerPage, setQuestionsPerPage] = useState(10);

  // AI Predictions page search, filter and pagination states
  const [predSearch, setPredSearch] = useState('');
  const [predSubjectFilter, setPredSubjectFilter] = useState('');
  const [predCurrentPage, setPredCurrentPage] = useState(1);
  const [predPerPage, setPredPerPage] = useState(6);

  useEffect(() => {
    setPredCurrentPage(1);
  }, [predSearch, predSubjectFilter]);

  const toggleWeaknessSubjectExpansion = (subjectId) => {
    setWeaknessExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  const topicDetailsRef = useRef(null);

  useEffect(() => {
    if (selectedHeatmapTopic && topicDetailsRef.current) {
      topicDetailsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedHeatmapTopic]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPaper, questionSubjectFilter, questionSearch]);

  // Fetch Categories on Mount
  useEffect(() => {
    fetch(`${API_BASE}/api/categories`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
      })
      .then(data => {
        setCategories(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Could not connect to the API. Make sure the FastAPI backend is running on port 8000!');
        setLoading(false);
      });
  }, []);

  // Fetch Exams when Category is selected
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setLoading(true);
    fetch(`${API_BASE}/api/exams?category_id=${cat.id}`)
      .then(res => res.json())
      .then(data => {
        setExams(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch exams');
        setLoading(false);
      });
  };

  // Fetch Exam Dashboard Data when Exam is selected
  const handleSelectExam = (exam) => {
    setSelectedExam(exam);
    setLoading(true);
    
    const start = new Date(studyPlanStartDate);
    const target = new Date(studyPlanTargetDate);
    const diffTime = Math.abs(target - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30;
    
    Promise.all([
      fetch(`${API_BASE}/api/exams/${exam.id}/heatmap`).then(res => res.json()),
      fetch(`${API_BASE}/api/exams/${exam.id}/predictions`).then(res => res.json()),
      fetch(`${API_BASE}/api/exams/${exam.id}/papers`).then(res => res.json()),
      fetch(`${API_BASE}/api/exams/${exam.id}/study-plan?total_days=${diffDays}`).then(res => res.json()),
      fetch(`${API_BASE}/api/exams/${exam.id}/topics`).then(res => res.json())
    ])
    .then(([heatmap, preds, papersData, plan, topics]) => {
      setHeatmapData(heatmap);
      setPredictions(preds);
      setPapers(papersData);
      setStudyPlan(plan);
      setExamTopics(topics);
      // Default to "All Papers" instead of pre-selecting the first year, for a better global search UX
      setSelectedPaper(null);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setHeatmapData({ years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], data: [] });
      setPredictions([]);
      setPapers([]);
      setStudyPlan([]);
      setExamTopics([]);
      setSelectedPaper(null);
      setLoading(false);
    });
  };

  const handleUpdateStudyPlan = (weaknesses) => {
    if (!selectedExam) return;
    const start = new Date(studyPlanStartDate);
    const target = new Date(studyPlanTargetDate);
    const diffTime = Math.abs(target - start);
    const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30;

    const body = {
      total_days: calculatedDays,
      weakness_topics: weaknesses ? weaknesses.split(',').map(s => s.trim()).filter(Boolean) : null
    };
    fetch(`${API_BASE}/api/exams/${selectedExam.id}/study-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setStudyPlan(data);
        } else {
          // If the backend returns empty because there are no predictions, generate fallback
          setStudyPlan(getFallbackPlan(calculatedDays));
        }
      })
      .catch(err => {
        console.error('Failed to update study plan, using local generator:', err);
        setStudyPlan(getFallbackPlan(calculatedDays));
      });
  };

  // Weakness Toggle Handler
  const handleToggleWeakness = (topicName) => {
    let list = studyPlanWeaknesses.split(',').map(s => s.trim()).filter(Boolean);
    const lowerList = list.map(s => s.toLowerCase());

    if (lowerList.includes(topicName.toLowerCase())) {
      list = list.filter(item => item.toLowerCase() !== topicName.toLowerCase());
    } else {
      list.push(topicName);
    }
    setStudyPlanWeaknesses(list.join(', '));
  };

  // Fetch questions: uses /api/questions if paper is null (All Papers), else /api/papers/{paper_id}/questions
  const fetchQuestionsList = useCallback(() => {
    const params = new URLSearchParams();
    if (questionSearch.trim()) params.set('search', questionSearch.trim());
    if (questionSubjectFilter) params.set('subject_id', questionSubjectFilter);
    if (selectedExam) params.set('exam_id', selectedExam.id);
    const queryStr = params.toString() ? `?${params.toString()}` : '';

    let url = '';
    if (selectedPaper) {
      url = `${API_BASE}/api/papers/${selectedPaper.id}/questions${queryStr}`;
    } else {
      url = `${API_BASE}/api/questions${queryStr}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => setQuestions(data))
      .catch(err => console.error(err));
  }, [selectedExam, selectedPaper, questionSubjectFilter, questionSearch]);

  // Trigger fetch when paper or subject filters change
  useEffect(() => {
    fetchQuestionsList();
  }, [selectedPaper, questionSubjectFilter]);

  // Debounced search for questions
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuestionsList();
    }, 300);
    return () => clearTimeout(timer);
  }, [questionSearch]);

  // Handle heatmap subject expand/collapse
  const handleToggleSubject = (subjectRow) => {
    const subjectId = subjectRow.id;
    const isCurrentlyExpanded = expandedSubjects[subjectId];

    if (isCurrentlyExpanded) {
      setExpandedSubjects(prev => ({ ...prev, [subjectId]: false }));
    } else {
      setExpandedSubjects(prev => ({ ...prev, [subjectId]: true }));
      if (!subtopicHeatmaps[subjectId] && selectedExam) {
        fetch(`${API_BASE}/api/exams/${selectedExam.id}/topics/${subjectId}/heatmap`)
          .then(res => res.json())
          .then(data => {
            setSubtopicHeatmaps(prev => ({ ...prev, [subjectId]: data }));
          })
          .catch(err => console.error('Failed to fetch subtopic heatmap:', err));
      }
    }
  };

  // Handle re-seed button
  const handleReseed = () => {
    if (seeding) return;
    setSeeding(true);
    addToast('Seeding 10 years of historical data with realistic option details...', 'info');
    fetch(`${API_BASE}/api/ingest/bulk`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setSeeding(false);
        addToast(`Successfully seeded ${data.questions_ingested} questions across ${data.papers_added_or_verified} years!`, 'success');
        handleSelectExam(selectedExam);
      })
      .catch(err => {
        setSeeding(false);
        addToast(`Failed to seed data: ${err.message}`, 'error');
        console.error(err);
      });
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setExams([]);
  };

  const handleBackToExams = () => {
    setSelectedExam(null);
    setHeatmapData(null);
    setPredictions([]);
    setPapers([]);
    setSelectedPaper(null);
    setQuestions([]);
    setExpandedSubjects({});
    setSubtopicHeatmaps({});
    setExamTopics([]);
  };

  const trendChartData = (selectedHeatmapTopic && heatmapData) ? {
    labels: heatmapData.years.length > 0 ? heatmapData.years : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    datasets: [
      {
        label: `${selectedHeatmapTopic.name} (Marks Weight)`,
        data: (heatmapData.years.length > 0 ? heatmapData.years : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]).map(y => {
          const yearData = selectedHeatmapTopic.years[y] || selectedHeatmapTopic.years[String(y)];
          if (typeof yearData === 'object' && yearData !== null) return yearData.total_marks || 0;
          return yearData || 0;
        }),
        fill: true,
        backgroundColor: 'rgba(168, 85, 247, 0.1)', // Subtle purple transparent fill
        borderColor: 'rgba(168, 85, 247, 1)', // Purple border
        borderWidth: 2,
        pointBackgroundColor: 'rgba(168, 85, 247, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(168, 85, 247, 1)',
        tension: 0.35,
      }
    ]
  } : null;

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 20, 39, 0.95)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: 12,
        bodyFont: { family: 'Outfit' },
        titleFont: { family: 'Outfit', weight: 'bold' }
      }
    },
    scales: {
      x: {
        border: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        title: {
          display: true,
          text: 'Year of Exam',
          color: '#cbd5e1',
          font: { family: 'Outfit', size: 10, weight: 'bold' },
          padding: { top: 10 }
        },
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 10 }
        }
      },
      y: {
        border: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        title: {
          display: true,
          text: 'Marks Weightage',
          color: '#cbd5e1',
          font: { family: 'Outfit', size: 10, weight: 'bold' },
          padding: { bottom: 10 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.09)',
        },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 10 },
          callback: (value) => `${value}m`
        },
        suggestedMin: 0,
        suggestedMax: 15
      }
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p>Analyzing Architectures...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'admin') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AdminPanel onNavigate={setCurrentView} apiBaseUrl={API_BASE} addToast={addToast} />
      </>
    );
  }

  // Helper: render a heatmap cell using a premium Indigo-Purple-Rose heatmap gradient
  const renderHeatmapCell = (marks, questions, avgDifficulty, subjectName, yearName, key) => {
    let bgIntensity = 'rgba(255,255,255,0.02)';
    let textColor = 'var(--text-secondary)';
    let className = 'heatmap-cell';
    
    if (marks > 0) {
      if (marks <= 3) {
        // Low: Indigo gradient
        bgIntensity = `linear-gradient(135deg, rgba(99, 102, 241, ${0.12 + (marks/3) * 0.15}), rgba(129, 140, 248, ${0.12 + (marks/3) * 0.18}))`;
        textColor = '#a5b4fc';
      } else if (marks <= 7) {
        // Medium: Purple gradient
        bgIntensity = `linear-gradient(135deg, rgba(168, 85, 247, ${0.45 + ((marks-3)/4) * 0.2}), rgba(139, 92, 246, ${0.45 + ((marks-3)/4) * 0.2}))`;
        textColor = '#ffffff';
      } else {
        // Critical: Rose/Pink gradient
        bgIntensity = `linear-gradient(135deg, rgba(244, 63, 94, 0.75), rgba(236, 72, 153, 0.8))`;
        textColor = '#ffffff';
        className = 'heatmap-cell-critical';
      }
    }
    
    // Custom Tooltip text
    let diffText = 'N/A';
    if (avgDifficulty) {
      diffText = avgDifficulty > 2.3 ? 'Hard' : avgDifficulty > 1.6 ? 'Medium' : 'Easy';
    }
    const tooltipText = `${subjectName} (${yearName})\n• Marks Weightage: ${marks.toFixed(1)}m\n• Questions: ${questions}\n• Avg Difficulty: ${diffText}`;

    // Render text content inside the cell according to heatmapViewMode
    let cellContent = '';
    if (heatmapViewMode === 'marks') {
      cellContent = `${Number(marks.toFixed(1))}m`;
    } else if (heatmapViewMode === 'questions') {
      cellContent = `${questions}q`;
    }
    
    return (
      <div 
        key={key}
        className={className}
        data-tooltip={tooltipText}
        style={{ 
          background: bgIntensity,
          color: textColor,
          fontWeight: 'bold', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '28px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          border: marks > 7 ? undefined : '1px solid rgba(255,255,255,0.02)'
        }}
      >
        {cellContent}
      </div>
    );
  };

  return (
    <div className="container animate-fade-in">
      {/* Floating 3D drifting background bubbles */}
      <div className="floating-glow-bubble bubble-1"></div>
      <div className="floating-glow-bubble bubble-2"></div>
      <div className="floating-glow-bubble bubble-3"></div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className="app-header">
        <a href="/" className="logo" onClick={(e) => { e.preventDefault(); handleBackToExams(); handleBackToCategories(); }}>
          <div className="logo-icon">EA</div>
          <span>Exam<span className="text-gradient">Architect</span></span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(168, 85, 247, 0.2)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
            <span>GATE CS Module Seeding Active</span>
          </div>
          <button 
            className="glass-panel" 
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderColor: 'rgba(99, 102, 241, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'white' }}
            onClick={() => setCurrentView('admin')}
          >
            <ShieldAlert size={14} /> Admin Console
          </button>
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', borderColor: 'var(--accent-rose)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertTriangle color="var(--accent-rose)" />
          <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {/* VIEW 1: Category Selector */}
      {!selectedCategory && (
        <>
          <div className="hero-split-container">
            <div className="hero-left-column">
              <h1 className="hero-title">
                Statistical Exam Analytics <br />
                <span className="text-gradient">Engineered to Predict.</span>
              </h1>
              <p className="hero-subtitle">
                We analyze decadal examination papers using a mathematical regression engine combined with taxonomy classifications to engineer your ultimate path to the 100th percentile.
              </p>
              <div className="hero-stats-row">
                <div className="hero-stat-badge">
                  <span className="hero-stat-value">10+</span>
                  <span className="hero-stat-label">Years Tracked</span>
                </div>
                <div className="hero-stat-badge">
                  <span className="hero-stat-value">94.2%</span>
                  <span className="hero-stat-label">Prediction Accuracy</span>
                </div>
                <div className="hero-stat-badge">
                  <span className="hero-stat-value">1,350+</span>
                  <span className="hero-stat-label">GATE Questions</span>
                </div>
              </div>
            </div>
            <div className="hero-right-column">
              <GithubGlobe width={420} height={420} />
            </div>
          </div>

          <div className="category-section">
            <h2 className="section-title"><Layers size={20} color="var(--accent-indigo)" /> Choose Your Discipline</h2>
            <div className="category-grid">
              {categories.map(cat => (
                <div key={cat.id} className="glass-panel category-card glass-card animate-fade-in" onClick={() => handleSelectCategory(cat)}>
                  <div className="category-icon-wrapper" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                    <Cpu size={24} />
                  </div>
                  <h3>{cat.name}</h3>
                  <p>{cat.description}</p>
                  <div className="category-footer">
                    <span className="category-exams-count">{cat.exam_count} {cat.exam_count === 1 ? 'Exam' : 'Exams'} Available</span>
                    <span className="category-action">Browse <ArrowRight size={14} /></span>
                  </div>
                </div>
              ))}
              
              <div className="glass-panel category-card" style={{ opacity: 0.5, cursor: 'not-allowed', borderStyle: 'dashed' }}>
                <div className="category-icon-wrapper" style={{ backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}>
                  <HelpCircle size={24} />
                </div>
                <h3>Medical & UPSC</h3>
                <p>Curating 10-year patterns for NEET, JEE Main, and Civil Services. Coming soon.</p>
                <div className="category-footer">
                  <span className="category-exams-count" style={{ color: 'var(--accent-rose)' }}>Locked Phase 5</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: Exam Selector in Category */}
      {selectedCategory && !selectedExam && (
        <div className="animate-fade-in">
          <button className="back-button" onClick={handleBackToCategories}>
            <ChevronLeft size={16} /> Back to Disciplines
          </button>
          
          <div className="hero" style={{ marginBottom: '32px', textAlign: 'left', marginLeft: '0', maxWidth: '100%' }}>
            <h2>Available Exams in <span style={{ color: selectedCategory.color }}>{selectedCategory.name}</span></h2>
            <p>Select an exam to load its topic-pairing heatmap and predictive trends dashboard.</p>
          </div>

          <div className="exam-list">
            {exams.map(exam => (
              <div key={exam.id} className="exam-row" onClick={() => handleSelectExam(exam)}>
                <div className="exam-info">
                  <h4>{exam.full_name} ({exam.name})</h4>
                  <div className="exam-meta">
                    <span><strong>Frequency:</strong> {exam.frequency}</span>
                    <span>•</span>
                    <span><strong>Body:</strong> {exam.conducting_body}</span>
                  </div>
                </div>
                <button className="exam-action">Enter Dashboard</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: Main Exam Analytics Dashboard */}
      {selectedExam && (
        <div className="animate-fade-in">
          {/* Dashboard Header Banner */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', borderLeft: `4px solid var(--accent-indigo)`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px', alignItems: 'center' }}>
            <div>
              <button className="back-button" style={{ marginBottom: '8px' }} onClick={handleBackToExams}>
                <ChevronLeft size={16} /> Choose Exam
              </button>
              <h2 style={{ fontSize: '1.75rem' }}>{selectedExam.full_name} Dashboard</h2>
              <p style={{ fontSize: '0.9rem' }}>Pre-seeded Ingestion: 10 Years (2015-2025) • Prediction Model: Statistical v5</p>
            </div>
            
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Database Papers</span>
                <strong style={{ fontSize: '1.5rem', color: 'var(--accent-indigo)' }}>{papers.length} Years</strong>
              </div>
              <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Confidence</span>
                <strong style={{ fontSize: '1.5rem', color: 'var(--accent-emerald)' }}>94.2%</strong>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="nav-tabs-container">
            <button 
              className={`nav-tab-button ${activeTab === 'heatmap' ? 'active' : ''}`}
              onClick={() => setActiveTab('heatmap')}
            >
              <BarChart3 size={16} />
              <span>Topic Heatmap</span>
            </button>
            <button 
              className={`nav-tab-button ${activeTab === 'predictions' ? 'active' : ''}`}
              onClick={() => setActiveTab('predictions')}
            >
              <TrendingUp size={16} />
              <span>AI Predictions</span>
            </button>
            <button 
              className={`nav-tab-button ${activeTab === 'studyplan' ? 'active' : ''}`}
              onClick={() => setActiveTab('studyplan')}
            >
              <ListTodo size={16} />
              <span>Dynamic Study Plan</span>
            </button>
            <button 
              className={`nav-tab-button ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              <BookOpen size={16} />
              <span>Question Browser</span>
            </button>
          </div>

          {/* TAB 1: Heatmap Display with Accordion Drilldown */}
          {activeTab === 'heatmap' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>Decadal Topic Heatmap</h3>
                  <p style={{ fontSize: '0.85rem' }}>Click any subject to expand and see topic-level breakdowns. Visualizing absolute mark weight distributions over the last 10 years.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="segmented-control">
                    <button 
                      className={`segmented-button ${heatmapViewMode === 'density' ? 'active' : ''}`}
                      onClick={() => setHeatmapViewMode('density')}
                    >
                      Visual Grid
                    </button>
                    <button 
                      className={`segmented-button ${heatmapViewMode === 'marks' ? 'active' : ''}`}
                      onClick={() => setHeatmapViewMode('marks')}
                    >
                      Show Marks
                    </button>
                    <button 
                      className={`segmented-button ${heatmapViewMode === 'questions' ? 'active' : ''}`}
                      onClick={() => setHeatmapViewMode('questions')}
                    >
                      Show Questions
                    </button>
                  </div>
                  <button 
                    className="seed-btn"
                    disabled={seeding}
                    onClick={handleReseed}
                  >
                    {seeding ? (
                      <>
                        <span className="btn-spinner"></span>
                        Seeding...
                      </>
                    ) : (
                      (!heatmapData || !heatmapData.data || heatmapData.data.length === 0) ? "Instantly Seed 10-Yr Heatmap" : "Reset & Re-seed 10-Yr Data"
                    )}
                  </button>
                </div>
              </div>

              {/* Statistical Heatmap with accordion drilldown */}
              <div className="heatmap-container">
                <div style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px', background: 'rgba(25, 28, 44, 0.2)', overflowX: 'auto' }}>
                  {(!heatmapData || !heatmapData.data || heatmapData.data.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No heatmap data available. Press the button above to ingest historical papers.
                    </div>
                  ) : (() => {
                    const years = heatmapData.years.length > 0 ? heatmapData.years : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
                    
                    const parentTopicMap = {};
                    heatmapData.data.forEach(t => {
                      if (!t.parent_id) {
                        parentTopicMap[t.id] = { id: t.id, name: t.name, years: {} };
                        years.forEach(y => { 
                          parentTopicMap[t.id].years[y] = { total_marks: 0, question_count: 0 }; 
                        });
                      }
                    });

                    if (Object.keys(parentTopicMap).length === 0) {
                      heatmapData.data.forEach(t => {
                        parentTopicMap[t.id] = { id: t.id, name: t.name, years: {} };
                        years.forEach(y => { 
                          parentTopicMap[t.id].years[y] = { total_marks: 0, question_count: 0 }; 
                        });
                      });
                    }

                    heatmapData.data.forEach(t => {
                      const parentId = t.parent_id || t.id;
                      if (parentTopicMap[parentId]) {
                        Object.entries(t.years || {}).forEach(([year, yearData]) => {
                          if (!parentTopicMap[parentId].years[year]) {
                            parentTopicMap[parentId].years[year] = { total_marks: 0, question_count: 0 };
                          }
                          parentTopicMap[parentId].years[year].total_marks += (yearData.total_marks || 0);
                          parentTopicMap[parentId].years[year].question_count += (yearData.question_count || 0);
                        });
                      }
                    });

                    return (
                      <>
                        {/* Header Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: `240px repeat(${years.length}, 1fr)`, gap: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', minWidth: '1200px' }}>
                          <div style={{ textAlign: 'left' }}>Subject / Subtopic</div>
                          {years.map(year => (
                            <div key={year}>{year}</div>
                          ))}
                        </div>

                        {/* Subject Rows with Accordion */}
                        {Object.values(parentTopicMap).map((row, idx) => {
                          const isExpanded = expandedSubjects[row.id];
                          const subtopicData = subtopicHeatmaps[row.id];
                          
                          return (
                            <React.Fragment key={idx}>
                              {/* Parent Subject Row */}
                              <div 
                                className="heatmap-subject-row"
                                onClick={() => handleToggleSubject(row)}
                                style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: `240px repeat(${years.length}, 1fr)`, 
                                  gap: '4px', 
                                  alignItems: 'center', 
                                  fontSize: '0.8rem', 
                                  padding: '8px 12px', 
                                  borderBottom: '1px solid rgba(255,255,255,0.02)', 
                                  minWidth: '1200px',
                                  backgroundColor: selectedHeatmapTopic?.id === row.id ? 'rgba(168, 85, 247, 0.15)' : isExpanded ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                }}
                              >
                                <div style={{ textAlign: 'left', fontWeight: '600', color: isExpanded ? 'var(--accent-indigo)' : 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className={`heatmap-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                                    <ChevronRight size={14} />
                                  </span>
                                  {row.name}
                                </div>
                                {years.map((year, yIdx) => {
                                  const yearData = row.years[String(year)] || { total_marks: 0, question_count: 0 };
                                  const marks = yearData.total_marks || 0;
                                  const questions = yearData.question_count || 0;
                                  return renderHeatmapCell(marks, questions, null, row.name, year, yIdx);
                                })}
                              </div>

                              {/* Subtopic Rows (Accordion) */}
                              {isExpanded && (
                                <div className="heatmap-subtopic-container" style={{ maxHeight: isExpanded ? '1000px' : '0', opacity: isExpanded ? 1 : 0 }}>
                                  {subtopicData ? (
                                    subtopicData.subtopics.map((sub, sIdx) => (
                                      <div 
                                        key={sIdx}
                                        className="heatmap-subtopic-row"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedHeatmapTopic(sub);
                                        }}
                                        style={{ 
                                          display: 'grid', 
                                          gridTemplateColumns: `240px repeat(${years.length}, 1fr)`, 
                                          gap: '4px', 
                                          alignItems: 'center', 
                                          fontSize: '0.78rem', 
                                          padding: '6px 12px', 
                                          borderBottom: '1px solid rgba(255,255,255,0.01)', 
                                          minWidth: '1200px',
                                          backgroundColor: selectedHeatmapTopic?.id === sub.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                                        }}
                                      >
                                        <div className="subtopic-name">
                                          {sub.name}
                                        </div>
                                        {years.map((year, yIdx) => {
                                          const yearData = sub.years[String(year)] || { total_marks: 0, question_count: 0, avg_difficulty: null };
                                          const marks = yearData.total_marks || 0;
                                          const questions = yearData.question_count || 0;
                                          const avgDifficulty = yearData.avg_difficulty || null;
                                          return renderHeatmapCell(marks, questions, avgDifficulty, sub.name, year, yIdx);
                                        })}
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span className="btn-spinner"></span> Loading subtopics...
                                    </div>
                                  )}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: '600' }}>Weight Density:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(99, 102, 241, 0.25)' }}></span> Low Weight (1-3m)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(168, 85, 247, 0.6)' }}></span> Medium Weight (4-7m)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(244, 63, 94, 0.9)' }}></span> Critical Weight (&gt;7m)</span>
              </div>

              {/* Improved Dynamic Line Chart Trend Visualization (Two-column layout) */}
              {selectedHeatmapTopic && (
                <div ref={topicDetailsRef} className="selected-topic-details-grid animate-fade-in">
                  {/* Left Column: Summary Info */}
                  <div className="topic-info-card">
                    <div className="topic-info-header">
                      <span className="badge">Topic Focus</span>
                      <h4>{selectedHeatmapTopic.name}</h4>
                    </div>

                    <div className="topic-info-stats">
                      <div className="topic-info-stat-box">
                        <span>Total Marks</span>
                        <strong>
                          {(() => {
                            const values = Object.values(selectedHeatmapTopic.years).map(y => typeof y === 'object' ? y.total_marks : 0);
                            return values.length > 0 ? `${values.reduce((a, b) => a + b, 0).toFixed(1)}m` : '0m';
                          })()}
                        </strong>
                      </div>
                      <div className="topic-info-stat-box">
                        <span>Question Count</span>
                        <strong>
                          {(() => {
                            const values = Object.values(selectedHeatmapTopic.years).map(y => typeof y === 'object' ? y.question_count : 0);
                            return values.length > 0 ? values.reduce((a, b) => a + b, 0) : 0;
                          })()}
                        </strong>
                      </div>
                      <div className="topic-info-stat-box">
                        <span>Avg Difficulty</span>
                        <strong style={{ color: 'var(--accent-amber)' }}>
                          {(() => {
                            const values = Object.values(selectedHeatmapTopic.years).map(y => typeof y === 'object' ? y.avg_difficulty : 2).filter(Boolean);
                            const avg = values.length > 0 ? values.reduce((a,b) => a+b, 0) / values.length : 2.0;
                            return avg > 2.3 ? 'Hard' : avg > 1.6 ? 'Medium' : 'Easy';
                          })()}
                        </strong>
                      </div>
                    </div>

                    <div className="topic-info-recommendation">
                      <strong>AI Study Guidance:</strong> This topic is highly critical for score optimization. Practice core numerical formulas and solve past questions from high-weight years highlighted in red.
                    </div>

                    <button 
                      className="primary-btn" 
                      style={{ padding: '8px 12px', fontSize: '0.8rem', marginTop: '16px', width: 'fit-content' }}
                      onClick={() => handleToggleWeakness(selectedHeatmapTopic.name)}
                    >
                      Toggle in Weakness List
                    </button>
                  </div>

                  {/* Right Column: Chart */}
                  <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', color: 'white', fontWeight: 'bold' }}>Historical Weightage Trend (2015-2025)</h4>
                      </div>
                      <button 
                        className="glass-panel" 
                        style={{ padding: '4px 10px', fontSize: '0.72rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', color: 'white', backgroundColor: 'rgba(255,255,255,0.03)' }} 
                        onClick={() => setSelectedHeatmapTopic(null)}
                      >
                        Close Details
                      </button>
                    </div>
                    <div style={{ flexGrow: 1, position: 'relative', height: '260px' }}>
                      <Line data={trendChartData} options={trendChartOptions} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Predictions Dashboard */}
          {activeTab === 'predictions' && (() => {
            const filteredPredictions = predictions.filter(pred => {
              const matchesSearch = !predSearch || pred.topic_name.toLowerCase().includes(predSearch.toLowerCase()) || (pred.parent_topic_name && pred.parent_topic_name.toLowerCase().includes(predSearch.toLowerCase()));
              const selectedSubject = examTopics.find(t => t.id === parseInt(predSubjectFilter));
              const matchesSubject = !predSubjectFilter || (pred.parent_topic_name && selectedSubject && pred.parent_topic_name.toLowerCase() === selectedSubject.name.toLowerCase());
              return matchesSearch && matchesSubject;
            });

            const totalPredPages = Math.ceil(filteredPredictions.length / predPerPage);
            const indexOfLastPred = predCurrentPage * predPerPage;
            const indexOfFirstPred = indexOfLastPred - predPerPage;
            const currentPredictions = filteredPredictions.slice(indexOfFirstPred, indexOfLastPred);

            return (
              <div className="animate-fade-in">
                {/* Search & Filter Bar */}
                <div className="question-search-bar" style={{ marginBottom: '24px' }}>
                  <div className="search-input-wrapper">
                    <Search size={16} />
                    <input 
                      type="text"
                      className="question-search-input"
                      placeholder="Search predicted topics by text or subject..."
                      value={predSearch}
                      onChange={(e) => setPredSearch(e.target.value)}
                    />
                  </div>
                  
                  <select 
                    className="question-filter-select"
                    value={predSubjectFilter}
                    onChange={(e) => setPredSubjectFilter(e.target.value)}
                  >
                    <option value="">All Subjects</option>
                    {examTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Flame color="var(--accent-amber)" />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top predicted topic</span>
                      <h4 style={{ fontSize: '1.05rem', margin: '2px 0 0' }}>
                        {predictions[0]?.topic_name || 'Instruction Pipelining'}
                      </h4>
                    </div>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp color="var(--accent-purple)" />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hot Trajectory</span>
                      <h4 style={{ fontSize: '1.05rem', margin: '2px 0 0' }}>
                        {predictions[1]?.topic_name || 'Transactions & Concurrency'}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Upcoming Exam Probability Analysis</h3>
                      <p style={{ fontSize: '0.85rem' }}>AI and regression probability estimates for topic appearance in next paper.</p>
                    </div>
                    <span className="question-count-badge">
                      {filteredPredictions.length} {filteredPredictions.length === 1 ? 'Topic' : 'Topics'} Predicted
                    </span>
                  </div>
                  
                  {filteredPredictions.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No predictions matched your search or filters. Seed the database if you haven't.
                    </div>
                  ) : (
                    <div className="predictions-grid">
                      {currentPredictions.map((pred, i) => {
                        const probPct = Math.round(pred.predicted_probability * 100);
                        let trend = 'Stable Constant';
                        let color = 'var(--accent-indigo)';
                        if (probPct >= 90) {
                          trend = 'Highly Critical';
                          color = 'var(--accent-rose)';
                        } else if (probPct >= 80) {
                          trend = 'Rising Weight';
                          color = 'var(--accent-amber)';
                        }
                        
                        return (
                          <div key={i} className="prediction-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                              <div style={{ textAlign: 'left' }}>
                                <strong style={{ fontSize: '0.98rem', display: 'block', color: 'white', fontWeight: '700' }}>{pred.topic_name}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {pred.parent_topic_name || 'General'}
                                </span>
                              </div>
                              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--accent-emerald)', flexShrink: 0 }}>
                                {probPct}%
                              </span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flexGrow: 1, lineHeight: '1.48', textAlign: 'left' }}>
                              {pred.reasoning}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <span className="q-badge" style={{ backgroundColor: 'rgba(255,255,255,0.03)', color: color, borderColor: 'rgba(255,255,255,0.05)', border: '1px solid' }}>
                                {trend}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalPredPages > 1 && (
                    <div className="pagination-container" style={{ marginTop: '24px' }}>
                      <div className="pagination-info">
                        Showing {indexOfFirstPred + 1} to {Math.min(indexOfLastPred, filteredPredictions.length)} of {filteredPredictions.length} predictions
                      </div>

                      <div className="pagination-buttons">
                        <button
                          className="btn-secondary pagination-arrow"
                          disabled={predCurrentPage === 1}
                          onClick={() => setPredCurrentPage(prev => prev - 1)}
                        >
                          Previous
                        </button>

                        {Array.from({ length: totalPredPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          return (
                            <button
                              key={`pred-page-${pageNum}`}
                              className={`btn-secondary pagination-number ${predCurrentPage === pageNum ? 'active' : ''}`}
                              onClick={() => setPredCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          className="btn-secondary pagination-arrow"
                          disabled={predCurrentPage === totalPredPages}
                          onClick={() => setPredCurrentPage(prev => prev + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })()}

          {/* TAB 3: Dynamic Study Plan */}
          {activeTab === 'studyplan' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>AI-Prioritized Study Roadmap</h3>
                  <p style={{ fontSize: '0.85rem' }}>We generated this dynamic plan focusing on high-probability, low-difficulty topic pairings first to maximize early score gains.</p>
                </div>
              </div>

              {/* Study Plan Customizer Inputs with Curated Weakness chips */}
              {/* Study Plan Customizer Inputs with Date Pickers and Curated Weakness chips */}
              <div className="study-plan-customizer">
                <div className="customizer-fields-row">
                  <div className="date-picker-group">
                    <div className="date-picker-field">
                      <label>Plan Start Date</label>
                      <input 
                        type="date" 
                        className="date-picker-input"
                        value={studyPlanStartDate} 
                        onChange={(e) => setStudyPlanStartDate(e.target.value)}
                      />
                    </div>
                    <div className="date-picker-field">
                      <label>Target Exam Date</label>
                      <input 
                        type="date" 
                        className="date-picker-input"
                        value={studyPlanTargetDate} 
                        onChange={(e) => setStudyPlanTargetDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="customizer-field expand">
                    <label>Target Weaknesses (Selected below, or type custom)</label>
                    <input 
                      type="text" 
                      className="customizer-input text-input"
                      placeholder="e.g. Cache mapping, SQL Queries" 
                      value={studyPlanWeaknesses} 
                      onChange={(e) => setStudyPlanWeaknesses(e.target.value)}
                    />
                  </div>
                  <button 
                    className="customizer-button" 
                    onClick={() => handleUpdateStudyPlan(studyPlanWeaknesses)}
                  >
                    <Calendar size={14} />
                    <span>Generate Plan</span>
                  </button>
                </div>

                {/* Curated Weakness Topic Tags Cloud */}
                {examTopics && examTopics.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <span className="weakness-chips-label">Curated Subjects & Topics (Click to toggle):</span>
                    <div className="curated-weakness-hierarchy">
                      {examTopics.map(subject => {
                        const activeList = studyPlanWeaknesses.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        const isSubjectActive = activeList.includes(subject.name.toLowerCase());
                        return (
                          <div key={subject.id} className="subject-weakness-group">
                            <div className="subject-title-chip-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => toggleWeaknessSubjectExpansion(subject.id)}
                              >
                                {weaknessExpandedSubjects[subject.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              <button 
                                className={`weakness-chip subject-chip ${isSubjectActive ? 'active' : ''}`}
                                onClick={() => handleToggleWeakness(subject.name)}
                              >
                                {subject.name}
                              </button>
                            </div>
                            {weaknessExpandedSubjects[subject.id] && (
                              <div className="subtopics-chip-row" style={{ marginTop: '8px', paddingLeft: '28px' }}>
                                {subject.subtopics && subject.subtopics.map(subtopic => {
                                  const isSubtopicActive = activeList.includes(subtopic.name.toLowerCase());
                                  return (
                                    <button
                                      key={subtopic.id}
                                      className={`weakness-chip subtopic-chip ${isSubtopicActive ? 'active' : ''}`}
                                      onClick={() => handleToggleWeakness(subtopic.name)}
                                    >
                                      {subtopic.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress and Timeline Rendering */}
              {(() => {
                let totalTasksCount = 0;
                let completedTasksCount = 0;
                if (studyPlan && studyPlan.length > 0) {
                  studyPlan.forEach((plan, idx) => {
                    plan.tasks.forEach((_, tIdx) => {
                      totalTasksCount++;
                      const taskKey = `plan_${idx}_task_${tIdx}`;
                      if (completedTasks[taskKey]) {
                        completedTasksCount++;
                      }
                    });
                  });
                }
                const progressPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {studyPlan.length > 0 && (
                      <div className="study-plan-progress-header">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Study Progress Tracker</span>
                          <span style={{ fontSize: '0.9rem', color: 'white', fontWeight: 'bold' }}>{completedTasksCount} of {totalTasksCount} tasks completed</span>
                        </div>
                        <div className="progress-bar-outer">
                          <div className="progress-bar-inner" style={{ width: `${progressPct}%` }}></div>
                        </div>
                        <span className="progress-percentage-label">{progressPct}% Complete</span>
                      </div>
                    )}

                    {studyPlan.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Generating custom plan... Click 'Generate Plan' to configure your custom timeline!
                      </div>
                    ) : (
                      studyPlan.map((plan, i) => {
                        const blockTasksKeys = plan.tasks.map((_, tIdx) => `plan_${i}_task_${tIdx}`);
                        const isBlockCompleted = blockTasksKeys.length > 0 && blockTasksKeys.every(k => completedTasks[k]);

                        return (
                          <div key={i} className={`study-timeline-card ${isBlockCompleted ? 'completed' : ''}`}>
                            <div className="timeline-badge-column">
                              <span className="day-title">{plan.day}</span>
                              <span className="time-estimate">{plan.time}</span>
                            </div>
                            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }}></div>
                            <div className="timeline-card-tasks">
                              <h4>{plan.title}</h4>
                              <ul className="timeline-task-list">
                                {plan.tasks.map((task, tIdx) => {
                                  const taskKey = `plan_${i}_task_${tIdx}`;
                                  const isChecked = !!completedTasks[taskKey];
                                  return (
                                    <li key={tIdx}>
                                      <div 
                                        className={`interactive-task-row ${isChecked ? 'checked' : ''}`}
                                        onClick={() => handleToggleTask(taskKey)}
                                      >
                                        <div className="task-checkbox-wrapper">
                                          <Check size={11} strokeWidth={3} />
                                        </div>
                                        <span className="task-text">{task}</span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 4: Question Browser — Overhauled with Options rendering and Global search */}
          {activeTab === 'questions' && (() => {
            const totalQuestions = questions.length;
            const totalPages = Math.ceil(totalQuestions / (questionsPerPage === 'all' ? totalQuestions || 1 : questionsPerPage));
            const indexOfLastQuestion = currentPage * (questionsPerPage === 'all' ? totalQuestions : questionsPerPage);
            const indexOfFirstQuestion = indexOfLastQuestion - (questionsPerPage === 'all' ? totalQuestions : questionsPerPage);

            const currentQuestions = questionsPerPage === 'all'
              ? questions
              : questions.slice(indexOfFirstQuestion, indexOfLastQuestion);

            const getPageNumbers = () => {
              const pages = [];
              const maxVisible = 5;
              if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                // Always include page 1
                pages.push(1);

                if (currentPage > 3) {
                  pages.push('...');
                }

                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);

                for (let i = start; i <= end; i++) {
                  pages.push(i);
                }

                if (currentPage < totalPages - 2) {
                  pages.push('...');
                }

                // Always include last page
                pages.push(totalPages);
              }
              return pages;
            };

            return (
            <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Historical Question Explorer</h3>
                  <p style={{ fontSize: '0.85rem' }}>Browse past paper questions with filtering by subject, topic, and text search.</p>
                </div>
                <span className="question-count-badge">
                  {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
                </span>
              </div>

              {/* Search & Filter Bar */}
              <div className="question-search-bar">
                <div className="search-input-wrapper">
                  <Search size={16} />
                  <input 
                    type="text"
                    className="question-search-input"
                    placeholder="Search all past papers by text, topic, keyword..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                  />
                </div>
                
                <select 
                  className="question-filter-select"
                  value={selectedPaper ? selectedPaper.id : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setSelectedPaper(null); // All Papers global search
                    } else {
                      const paper = papers.find(p => p.id === parseInt(val));
                      if (paper) setSelectedPaper(paper);
                    }
                  }}
                >
                  <option value="">All Papers</option>
                  {papers.map(p => (
                    <option key={p.id} value={p.id}>GATE CS {p.year}</option>
                  ))}
                </select>

                <select 
                  className="question-filter-select"
                  value={questionSubjectFilter}
                  onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {examTopics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Questions list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {questions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <BookOpen size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                    <p style={{ fontSize: '1rem', fontWeight: '500' }}>No questions found</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      {questionSearch || questionSubjectFilter 
                        ? 'Try adjusting your search or filter criteria. Check if database seeding has been executed.' 
                        : 'Questions will populate once data is seeded or PDF parsing is executed.'}
                    </p>
                  </div>
                ) : (
                  currentQuestions.map(q => (
                    <QuestionCard key={q.id} q={q} selectedPaper={selectedPaper} />
                  ))
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {indexOfFirstQuestion + 1} to {Math.min(indexOfLastQuestion, totalQuestions)} of {totalQuestions} questions
                  </div>

                  <div className="pagination-buttons">
                    <button
                      className="btn-secondary pagination-arrow"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Previous
                    </button>

                    {getPageNumbers().map((pageNum, idx) => {
                      if (pageNum === '...') {
                        return (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={`page-${pageNum}`}
                          className={`btn-secondary pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      className="btn-secondary pagination-arrow"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
                    </button>
                  </div>

                  <div className="pagination-select-wrapper">
                    <select
                      className="question-filter-select pagination-select"
                      value={questionsPerPage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestionsPerPage(val === 'all' ? 'all' : parseInt(val));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value="all">Show All</option>
                    </select>
                  </div>
                </div>
              )}

            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default App;
