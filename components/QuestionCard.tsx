import React from 'react';
import { Question, QuestionType } from '../types';
import Button from './Button';

interface QuestionCardProps {
  question: Question;
  selectedIndices: number[];
  onSelect: (index: number) => void;
  onSubmit: () => void;
  isSubmitted: boolean;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  aiExplanation?: string;
  onAskAi: () => void;
  isAiLoading: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedIndices,
  onSelect,
  onSubmit,
  isSubmitted,
  onNext,
  onPrev,
  isFirst,
  isLast,
  aiExplanation,
  onAskAi,
  isAiLoading
}) => {
  const isMultiple = question.type === QuestionType.MULTIPLE;

  const getOptionStyles = (index: number) => {
    const isSelected = selectedIndices.includes(index);
    const isCorrect = question.correctIndices.includes(index);

    if (!isSubmitted) {
      return isSelected 
        ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200" 
        : "border-slate-200 bg-white hover:border-indigo-300";
    }

    if (isCorrect) {
      if (isSelected) {
        return "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200";
      } else {
        return "border-emerald-400 border-dashed bg-emerald-50/50 text-emerald-800 ring-1 ring-emerald-100";
      }
    }
    
    if (isSelected && !isCorrect) {
      return "border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-200";
    }
    
    return "border-slate-200 bg-slate-50 opacity-50";
  };

  const getIcon = (index: number) => {
    const isSelected = selectedIndices.includes(index);
    const isCorrect = question.correctIndices.includes(index);

    if (isSubmitted) {
      if (isCorrect && isSelected) return <i className="fas fa-check-circle text-emerald-600"></i>;
      if (isCorrect && !isSelected) return <i className="fas fa-check-circle text-emerald-400/70" title="Correct answer missed"></i>;
      if (isSelected && !isCorrect) return <i className="fas fa-times-circle text-rose-600"></i>;
    }

    if (isMultiple) {
      return <div className={`w-5 h-5 border-2 rounded transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
        {isSelected && <i className="fas fa-check text-white text-[10px] flex items-center justify-center h-full"></i>}
      </div>;
    } else {
      return <div className={`w-5 h-5 border-2 rounded-full transition-all flex items-center justify-center ${isSelected ? 'border-indigo-600' : 'border-slate-300'}`}>
        {isSelected && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
      </div>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-indigo-600 p-6 text-white">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">{question.category}</span>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{isMultiple ? 'Multiple Correct' : 'Single Correct'}</span>
        </div>
        {/* Fixed: added whitespace-pre-wrap to respect \n characters in question text */}
        <h2 className="text-xl md:text-2xl font-semibold leading-snug whitespace-pre-wrap">{question.text}</h2>
      </div>

      {/* Options */}
      <div className="p-6 space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            disabled={isSubmitted}
            onClick={() => onSelect(index)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${getOptionStyles(index)}`}
          >
            <div className="mt-1 flex-shrink-0">
              {getIcon(index)}
            </div>
            <div className="flex-grow flex justify-between items-center">
              <span className="font-medium whitespace-pre-wrap">{option}</span>
              {isSubmitted && question.correctIndices.includes(index) && !selectedIndices.includes(index) && (
                <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">Correct Answer</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer / Actions */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        {/* Navigation Left */}
        <div className="flex justify-start order-2 sm:order-1">
          {!isFirst && (
            <Button variant="outline" onClick={onPrev} className="w-full sm:w-auto">
              <i className="fas fa-chevron-left mr-2"></i> Previous
            </Button>
          )}
        </div>

        {/* Primary Action Middle */}
        <div className="flex justify-center order-1 sm:order-2">
          {!isSubmitted ? (
            <Button 
              className="w-full sm:w-auto px-8"
              onClick={onSubmit}
              disabled={selectedIndices.length === 0}
            >
              Check Answer
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={onAskAi} 
              isLoading={isAiLoading}
              className="bg-white w-full sm:w-auto"
            >
              <i className="fas fa-robot text-indigo-500"></i> AI Explanation
            </Button>
          )}
        </div>

        {/* Navigation Right */}
        <div className="flex justify-end order-3 sm:order-3">
          <Button 
            variant={isSubmitted ? "primary" : "secondary"}
            onClick={onNext} 
            className="w-full sm:w-auto px-8"
          >
            {isLast ? 'Finish' : 'Next'} <i className="fas fa-chevron-right ml-2"></i>
          </Button>
        </div>
      </div>

      {/* AI Explanation Section */}
      {aiExplanation && isSubmitted && (
        <div className="p-6 border-t border-slate-100 bg-indigo-50 animate-in zoom-in-95 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-robot text-indigo-600"></i>
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 text-sm mb-1 uppercase tracking-wider">AI Insight</h4>
              <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-wrap">{aiExplanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Static Explanation (if provided in data) */}
      {!aiExplanation && isSubmitted && question.explanation && (
        <div className="p-6 border-t border-slate-100 bg-emerald-50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-info-circle text-emerald-600"></i>
            </div>
            <div>
              <h4 className="font-bold text-emerald-900 text-sm mb-1 uppercase tracking-wider">Explanation</h4>
              <p className="text-emerald-800 text-sm leading-relaxed whitespace-pre-wrap">{question.explanation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;