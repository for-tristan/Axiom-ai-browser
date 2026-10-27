import { useState } from 'react'
import './App.css'

function App() {
  const [query, setQuery] = useState('')

  function handleSearch() {
  const value = query.trim()
  if (!value) return

  const isUrl = value.includes('.') && !value.includes(' ')

  let url = ''

  if (isUrl) {
      url = value.startsWith('http')
        ? value
        : `https://${value}`
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(value)}`
    }

    window.open(url, '_blank')
}

  return (
    <main className="home-page">
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch()
        }}
      >
        <button className="icon-button" type="submit" aria-label="Search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
        </button>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or type a URL"
          aria-label="Search or type a URL"
        />

        <button
          className="icon-button"
          type="button"
          aria-label="Voice search"
          title="Voice search is not available yet"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M6 11a6 6 0 0 0 12 0M12 17v4m-3 0h6" />
          </svg>
        </button>
      </form>
    </main>
  )
}

export default App