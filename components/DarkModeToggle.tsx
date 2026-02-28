import React, { useEffect, useState } from 'react';

const DarkModeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    localStorage.setItem('dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

  return (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm"
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? (
        <i className="fas fa-sun text-amber-400"></i>
      ) : (
        <i className="fas fa-moon text-indigo-600"></i>
      )}
    </button>
  );
};

export default DarkModeToggle;
