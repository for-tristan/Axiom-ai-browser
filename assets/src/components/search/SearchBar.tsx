import React, { useState } from 'react';
import './SearchBar.css';

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const executeSearch = () => {
    if (!query.trim()) return;

    const formattedQuery = query.trim();
    if (formattedQuery.startsWith('http://') || formattedQuery.startsWith('https://') || formattedQuery.includes('.')) {
      const targetUrl = formattedQuery.startsWith('http') ? formattedQuery : `https://${formattedQuery}`;
      window.open(targetUrl, '_blank');
    } else {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(formattedQuery)}`, '_blank');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  };

  const onMicPress = () => {
    alert('Voice search feature coming soon');
  };

  return (
    <div className="search-bar-wrapper">
      <span className="search-icon" onClick={executeSearch}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </span>

      <input
        type="text"
        className="search-input"
        placeholder="Search or type a URL"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyPress}
      />

      <span className="mic-icon" onClick={onMicPress}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      </span>
    </div>
  );
};
