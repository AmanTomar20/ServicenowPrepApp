import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { quizMetadata, getQuestionsForQuiz } from './data/mcqData';
import { QuestionType, UserProgress, QuizMetadata, Question } from './types';
import QuestionCard from './components/QuestionCard';
import Button from './components/Button';
import DarkModeToggle from './components/DarkModeToggle';
import { getAiExplanation } from './services/geminiService';
import { db } from './services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Use a single, unified user ID for cross-device synchronization
  const userId = 'shared_master_user';

  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem('mcq_progress');
    const defaultProgress = {
      score: 0,
      totalAnswered: 0,
      results: {},
      completedQuizzes: [],
      lastIndices: {}
    };
    return saved ? { ...defaultProgress, ...JSON.parse(saved) } : defaultProgress;
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});

  // Fetch initial progress from Firebase on mount
  useEffect(() => {
    const fetchCloudProgress = async () => {
      try {
        const userDoc = doc(db, "users", userId);
        const docSnap = await getDoc(userDoc);
        if (docSnap.exists()) {
          const cloudProgress = docSnap.data().progress as UserProgress;
          setProgress(prev => ({
            ...prev,
            ...cloudProgress,
            lastIndices: cloudProgress.lastIndices || {}
          }));
          localStorage.setItem('mcq_progress', JSON.stringify(cloudProgress));
        }
        setSyncError(null);
      } catch (e: any) {
        console.error("Firebase Fetch Error:", e);
        if (e.code === 'permission-denied') {
          setSyncError("Cloud access denied. Please check Firestore permissions.");
        }
      }
    };
    fetchCloudProgress();
  }, [userId]);

  // Track the current index as the user navigates
  useEffect(() => {
    if (activeQuizId && !isReviewMode && !showResults) {
      setProgress(prev => {
        const currentLastIndex = prev.lastIndices?.[activeQuizId];
        if (currentLastIndex === currentIndex) return prev;
        
        return {
          ...prev,
          lastIndices: {
            ...prev.lastIndices,
            [activeQuizId]: currentIndex
          }
        };
      });
    }
  }, [currentIndex, activeQuizId, isReviewMode, showResults]);

  // Sync state to Cloud and LocalStorage with debouncing
  useEffect(() => {
    localStorage.setItem('mcq_progress', JSON.stringify(progress));
    
    const syncToCloud = async () => {
      setIsSyncing(true);
      try {
        const userDoc = doc(db, "users", userId);
        await setDoc(userDoc, { progress }, { merge: true });
        setSyncError(null);
      } catch (e: any) {
        console.error("Firebase Sync Error:", e);
        if (e.code === 'permission-denied') {
          setSyncError("Cloud Sync Error: Check Firestore Rules or API status.");
        }
      } finally {
        setIsSyncing(false);
      }
    };

    const timeout = setTimeout(syncToCloud, 1500);
    return () => clearTimeout(timeout);
  }, [progress, userId]);

  const currentQuestionsSet = useMemo(() => {
    if (!activeQuizId) return [];
    const fullSet = getQuestionsForQuiz(activeQuizId);
    if (isReviewMode) {
      return fullSet.filter(q => progress.results[q.id] && !progress.results[q.id].isCorrect);
    }
    return fullSet;
  }, [activeQuizId, isReviewMode, progress.results]);

  const currentQuestion = currentQuestionsSet[currentIndex];
  
  const currentResult = useMemo(() => {
    if (!currentQuestion) return { selectedIndices: [], isCorrect: false, submitted: false };
    return progress.results[currentQuestion.id] || { 
      selectedIndices: [], 
      isCorrect: false, 
      submitted: false 
    };
  }, [currentQuestion, progress.results]);

  const handleSelect = useCallback((index: number) => {
    if (currentResult.submitted || !currentQuestion) return;

    setProgress(prev => {
      const existing = prev.results[currentQuestion.id]?.selectedIndices || [];
      let newSelected: number[];

      if (currentQuestion.type === QuestionType.SINGLE) {
        newSelected = [index];
      } else {
        newSelected = existing.includes(index)
          ? existing.filter(i => i !== index)
          : [...existing, index];
      }

      return {
        ...prev,
        results: {
          ...prev.results,
          [currentQuestion.id]: {
            ...prev.results[currentQuestion.id],
            selectedIndices: newSelected,
            submitted: false,
            isCorrect: false
          }
        }
      };
    });
  }, [currentQuestion, currentResult.submitted]);

  const handleSubmit = useCallback(() => {
    if (!currentQuestion) return;
    const selected = currentResult.selectedIndices;
    const correct = currentQuestion.correctIndices;
    const isCorrect = selected.length === correct.length && selected.every(idx => correct.includes(idx));

    setProgress(prev => ({
      ...prev,
      score: !isReviewMode && isCorrect ? prev.score + 1 : prev.score,
      totalAnswered: !isReviewMode ? prev.totalAnswered + 1 : prev.totalAnswered,
      results: {
        ...prev.results,
        [currentQuestion.id]: {
          ...prev.results[currentQuestion.id],
          submitted: true,
          isCorrect
        }
      }
    }));
  }, [currentQuestion, currentResult, isReviewMode]);

  const handleNext = useCallback(() => {
    if (currentIndex < currentQuestionsSet.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowResults(true);
      setIsReviewMode(false);
      if (activeQuizId && !isReviewMode) {
        setProgress(prev => ({
          ...prev,
          completedQuizzes: prev.completedQuizzes.includes(activeQuizId) 
            ? prev.completedQuizzes 
            : [...prev.completedQuizzes, activeQuizId]
        }));
      }
    }
  }, [currentIndex, currentQuestionsSet.length, activeQuizId, isReviewMode]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const selectQuiz = (quizId: string) => {
    const questions = getQuestionsForQuiz(quizId);
    
    // 1. Check if we have a saved index for this quiz
    const savedIndex = progress.lastIndices?.[quizId];
    
    // 2. Otherwise find first unsubmitted question
    const firstUnattemptedIndex = questions.findIndex(q => !progress.results[q.id]?.submitted);
    
    // 3. Decide starting point
    let startAt = 0;
    if (savedIndex !== undefined) {
      startAt = savedIndex;
    } else if (firstUnattemptedIndex !== -1) {
      startAt = firstUnattemptedIndex;
    }

    setActiveQuizId(quizId);
    setCurrentIndex(startAt);
    setShowResults(false);
    setIsReviewMode(false);
    setAiExplanations({});
  };

  const startReview = () => {
    setCurrentIndex(0);
    setShowResults(false);
    setIsReviewMode(true);
  };

  const handleRestart = () => {
    if (!activeQuizId) return;
    const qIds = getQuestionsForQuiz(activeQuizId).map(q => q.id);
    
    setProgress(prev => {
      const newResults = { ...prev.results };
      qIds.forEach(id => delete newResults[id]);
      
      const newLastIndices = { ...prev.lastIndices };
      delete newLastIndices[activeQuizId];

      return {
        ...prev,
        results: newResults,
        lastIndices: newLastIndices
      };
    });
    
    setCurrentIndex(0);
    setShowResults(false);
    setIsReviewMode(false);
    setAiExplanations({});
  };

  const handleAskAi = async () => {
    if (!currentQuestion || aiExplanations[currentQuestion.id] || isAiLoading) return;
    setIsAiLoading(true);
    const selectedLabels = currentResult.selectedIndices.map(i => currentQuestion.options[i]);
    const explanation = await getAiExplanation(currentQuestion, selectedLabels);
    setAiExplanations(prev => ({ ...prev, [currentQuestion.id]: explanation }));
    setIsAiLoading(false);
  };

  const progressPercentage = currentQuestionsSet.length > 0 ? ((currentIndex + 1) / currentQuestionsSet.length) * 100 : 0;

  const getQuizProgressStats = (quizId: string) => {
    const questions = getQuestionsForQuiz(quizId);
    const attempted = questions.filter(q => progress.results[q.id]?.submitted).length;
    const percent = questions.length > 0 ? Math.round((attempted / questions.length) * 100) : 0;
    return { attempted, total: questions.length, percent };
  };

  if (!activeQuizId) {
    return (
      <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-300 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="absolute top-6 right-6">
          <DarkModeToggle />
        </div>
        <header className="mb-12 text-center max-w-2xl w-full">
          <div className="inline-flex p-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl mb-4 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
            <i className="fas fa-graduation-cap text-3xl"></i>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2 text-center w-full">ServiceNow CAD Practice</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">Unified progress synced across all your devices.</p>
          
          {syncError ? (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-amber-800 dark:text-amber-300 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <i className="fas fa-exclamation-triangle text-amber-500 text-lg"></i>
              <div className="text-left">
                <p className="font-bold">Sync Problem</p>
                <p>{syncError}</p>
              </div>
            </div>
          ) : isSyncing && (
            <div className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 font-bold animate-pulse">
              <i className="fas fa-cloud-upload-alt mr-1"></i> Syncing global progress...
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
          {quizMetadata.map((quiz) => {
            const stats = getQuizProgressStats(quiz.id);
            const isCompleted = progress.completedQuizzes.includes(quiz.id);
            const isStarted = stats.attempted > 0 || (progress.lastIndices?.[quiz.id] !== undefined && progress.lastIndices[quiz.id] > 0);
            
            return (
              <div key={quiz.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 flex flex-col">
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                      CAD ServiceNow
                    </span>
                    {isCompleted && (
                      <i className="fas fa-check-circle text-emerald-500 text-xl animate-in zoom-in duration-300"></i>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{quiz.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">{quiz.description}</p>
                  
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-400 dark:text-slate-500 uppercase tracking-widest">Global Progress</span>
                      <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}>
                        {stats.percent}% ({stats.attempted}/{stats.total})
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-indigo-500'}`}
                        style={{ width: `${stats.percent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-6 text-sm text-slate-400 dark:text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5"><i className="far fa-question-circle"></i> {quiz.questionCount} Questions</span>
                  </div>

                  <Button onClick={() => selectQuiz(quiz.id)} className="w-full py-3.5">
                    {isStarted && !isCompleted ? 'Resume Quiz' : isCompleted ? 'Retake Quiz' : 'Start Quiz'} 
                    <i className={`fas ${isStarted && !isCompleted ? 'fa-forward' : 'fa-play'} ml-2 text-xs`}></i>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-16 text-slate-400 dark:text-slate-600 text-sm flex items-center gap-4">
          <span>&copy; 2024 ServiceNow CAD Master</span>
          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
          <span>Shared Learning Mode Active</span>
        </footer>
      </div>
    );
  }

  if (showResults) {
    const questionsInQuiz = getQuestionsForQuiz(activeQuizId);
    const quizResults = questionsInQuiz.map(q => progress.results[q.id]);
    const correctCount = quizResults.filter(r => r?.isCorrect).length;
    const mistakesCount = questionsInQuiz.length - correctCount;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-500 border border-slate-200 dark:border-slate-800">
          <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            <i className="fas fa-star"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Set Complete!</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {correctCount === questionsInQuiz.length 
              ? "Flawless! You're ready for the exam." 
              : `You scored ${correctCount} out of ${questionsInQuiz.length}.`}
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
              <span className="block text-3xl font-bold text-indigo-600 dark:text-indigo-400">{correctCount}</span>
              <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Correct</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
              <span className="block text-3xl font-bold text-slate-600 dark:text-slate-300">{Math.round((correctCount / questionsInQuiz.length) * 100)}%</span>
              <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Accuracy</span>
            </div>
          </div>

          <div className="space-y-3">
            {mistakesCount > 0 && (
              <Button onClick={startReview} variant="outline" className="w-full py-4 text-lg border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-400">
                Review Mistakes <i className="fas fa-search ml-2 text-sm"></i>
              </Button>
            )}
            <Button onClick={() => setActiveQuizId(null)} variant="secondary" className="w-full py-4 text-lg">
              Return to Dashboard
            </Button>
            <Button onClick={handleRestart} className="w-full py-4 text-lg">
              Retake This Quiz <i className="fas fa-redo ml-2 text-sm"></i>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen pb-20 transition-colors duration-300 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => setActiveQuizId(null)} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
            <i className="fas fa-chevron-left text-xs"></i> Dashboard
          </button>
          <div className="flex flex-col items-center">
            <div className="text-sm font-bold text-slate-800 dark:text-white tracking-tight text-center">
              {isReviewMode ? 'Review Mode' : quizMetadata.find(m => m.id === activeQuizId)?.title}
            </div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">
              Question {currentIndex + 1} of {currentQuestionsSet.length}
            </div>
          </div>
          <div className="flex items-center gap-4">
             <DarkModeToggle />
             <div className="w-10 text-right">
                {isSyncing ? <i className="fas fa-sync fa-spin text-indigo-400 text-xs"></i> : syncError && <i className="fas fa-cloud-slash text-rose-400 text-xs" title={syncError}></i>}
             </div>
          </div>
        </div>
        
        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800">
          <div 
            className={`h-full transition-all duration-500 ease-out ${isReviewMode ? 'bg-rose-500' : 'bg-indigo-600 dark:bg-indigo-500'}`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-8">
        {isReviewMode && (
          <div className="mb-4 flex justify-between items-center">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-900/50">
              <i className="fas fa-history mr-1.5"></i> Reviewing Mistakes
            </span>
            <button onClick={() => setShowResults(true)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline">
              Stop Review
            </button>
          </div>
        )}
        
        <QuestionCard
          question={currentQuestion}
          selectedIndices={currentResult.selectedIndices}
          onSelect={handleSelect}
          onSubmit={handleSubmit}
          isSubmitted={currentResult.submitted}
          onNext={handleNext}
          onPrev={handlePrev}
          isFirst={currentIndex === 0}
          isLast={currentIndex === currentQuestionsSet.length - 1}
          aiExplanation={aiExplanations[currentQuestion.id]}
          onAskAi={handleAskAi}
          isAiLoading={isAiLoading}
        />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 md:hidden">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          <div className="text-center">
             <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Progress</span>
             <span className="font-bold text-indigo-600 dark:text-indigo-400">{currentIndex + 1}/{currentQuestionsSet.length}</span>
          </div>
          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800"></div>
          <div className="text-center">
             <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Global Sync</span>
             <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;