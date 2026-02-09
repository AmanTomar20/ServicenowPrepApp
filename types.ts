
export enum QuestionType {
  SINGLE = 'single',
  MULTIPLE = 'multiple'
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctIndices: number[];
  explanation?: string;
  category: string;
}

export interface QuestionResult {
  selectedIndices: number[];
  isCorrect: boolean;
  submitted: boolean;
}

export interface QuizMetadata {
  id: string;
  title: string;
  description: string;
  questionCount: number;
}

export interface UserProgress {
  score: number;
  totalAnswered: number;
  results: Record<string, QuestionResult>;
  completedQuizzes: string[]; // Store IDs of completed quizzes
}
