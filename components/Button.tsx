
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className, 
  ...props 
}) => {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-600",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400",
    danger: "bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <i className="fas fa-circle-notch fa-spin"></i>
      ) : children}
    </button>
  );
};

export default Button;
