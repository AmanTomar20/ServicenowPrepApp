
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { quizMetadata, getQuestionsForQuiz } from './data/mcqData';
import { QuestionType, UserProgress, QuizMetadata } from './types';
import QuestionCard from './components/QuestionCard';
import Button from './components/Button';
import { getAiExplanation } from './services/geminiService';

const App: React.FC = () => {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem('mcq_progress');
    return saved ? JSON.parse(saved) : {
      score: 0,
      totalAnswered: 0,
      results: {},
      completedQuizzes: []
    };
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});

  useEffect(() => {
    localStorage.setItem('mcq_progress', JSON.stringify(progress));
  }, [progress]);

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

  const selectQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setCurrentIndex(0);
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
      return {
        ...prev,
        results: newResults
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

  const progressPercentage = isReviewMode 
    ? ((currentIndex + 1) / currentQuestionsSet.length) * 100 
    : (currentQuestionsSet.length > 0 ? ((currentIndex + 1) / currentQuestionsSet.length) * 100 : 0);

  // DASHBOARD VIEW
  if (!activeQuizId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
        <header className="mb-12 text-center max-w-2xl">
          <div className="inline-flex p-3 bg-indigo-600 text-white rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <i className="fas fa-graduation-cap text-3xl"></i>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">ServiceNow CAD Practice</h1>
          <p className="text-lg text-slate-600">Choose a study set to begin your preparation for the Certified Application Developer exam.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
          {quizMetadata.map((quiz) => {
            const isCompleted = progress.completedQuizzes.includes(quiz.id);
            return (
              <div key={quiz.id} className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      CAD ServiceNow
                    </span>
                    {isCompleted && (
                      <i className="fas fa-check-circle text-emerald-500 text-xl"></i>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{quiz.title}</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">{quiz.description}</p>
                  
                  <div className="flex items-center gap-4 mb-6 text-sm text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5"><i className="far fa-question-circle"></i> {quiz.questionCount} Questions</span>
                    <span className="flex items-center gap-1.5"><i className="far fa-clock"></i> 15-20 Min</span>
                  </div>

                  <Button onClick={() => selectQuiz(quiz.id)} className="w-full py-3.5">
                    Start Quiz <i className="fas fa-play ml-2 text-xs"></i>
                  </Button>
                </div>
                <div className="h-1.5 w-full bg-slate-100">
                   <div className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} style={{ width: isCompleted ? '100%' : '0%' }}></div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-16 text-slate-400 text-sm flex items-center gap-4">
          <span>&copy; 2024 ServiceNow CAD Master</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span>60 Premium Questions</span>
        </footer>
      </div>
    );
  }

  // RESULTS VIEW
  if (showResults) {
    const questionsInQuiz = getQuestionsForQuiz(activeQuizId);
    const quizResults = questionsInQuiz.map(q => progress.results[q.id]);
    const correctCount = quizResults.filter(r => r?.isCorrect).length;
    const mistakesCount = questionsInQuiz.length - correctCount;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            <i className="fas fa-star"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Set Complete!</h1>
          <p className="text-slate-500 mb-8">
            {correctCount === questionsInQuiz.length 
              ? "Flawless! You're ready for the exam." 
              : `You scored ${correctCount} out of ${questionsInQuiz.length}.`}
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl">
              <span className="block text-3xl font-bold text-indigo-600">{correctCount}</span>
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Correct</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl">
              <span className="block text-3xl font-bold text-slate-600">{Math.round((correctCount / questionsInQuiz.length) * 100)}%</span>
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Accuracy</span>
            </div>
          </div>

          <div className="space-y-3">
            {mistakesCount > 0 && (
              <Button onClick={startReview} variant="outline" className="w-full py-4 text-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-400">
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

  // QUIZ VIEW
  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => setActiveQuizId(null)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors">
            <i className="fas fa-chevron-left text-xs"></i> Dashboard
          </button>
          <div className="flex flex-col items-center">
            <div className="text-sm font-bold text-slate-800 tracking-tight">
              {isReviewMode ? 'Review Mode' : quizMetadata.find(m => m.id === activeQuizId)?.title}
            </div>
            <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">
              Question {currentIndex + 1} of {currentQuestionsSet.length}
            </div>
          </div>
          <div className="w-20"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="w-full h-1 bg-slate-100">
          <div 
            className={`h-full transition-all duration-500 ease-out ${isReviewMode ? 'bg-rose-500' : 'bg-indigo-600'}`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-8">
        {isReviewMode && (
          <div className="mb-4 flex justify-between items-center">
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
              <i className="fas fa-history mr-1.5"></i> Reviewing Mistakes
            </span>
            <button onClick={() => setShowResults(true)} className="text-xs text-slate-400 hover:text-slate-600 underline">
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
          isLast={currentIndex === currentQuestionsSet.length - 1}
          aiExplanation={aiExplanations[currentQuestion.id]}
          onAskAi={handleAskAi}
          isAiLoading={isAiLoading}
        />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 md:hidden">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          <div className="text-center">
             <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
             <span className="font-bold text-indigo-600">{currentIndex + 1}/{currentQuestionsSet.length}</span>
          </div>
          <div className="h-8 w-px bg-slate-100"></div>
          <div className="text-center">
             <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topic</span>
             <span className="font-bold text-slate-700 text-sm">CAD Prep</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
