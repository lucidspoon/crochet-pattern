import { useState, useRef, useEffect } from 'react'
import './App.css'

// Colors the recognizer will detect
const COLORS = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink',
  'white', 'black', 'brown', 'gray', 'grey', 'beige', 'cream',
  'navy', 'teal', 'coral', 'magenta', 'cyan', 'violet', 'maroon',
  'tan', 'lavender', 'gold', 'silver', 'turquoise', 'indigo',
]

// CSS color values for swatches (only needed for colors that don't map directly)
const SWATCH_OVERRIDES = {
  grey: 'gray',
  cream: '#FFFDD0',
  beige: '#F5F5DC',
  lavender: '#E6E6FA',
}

// Spoken number words → integers (1–20 covers most crochet counts)
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
}

function parsePattern(text) {
  const lower = text.toLowerCase()
  const colorPattern = COLORS.join('|')
  const numWordPattern = Object.keys(NUMBER_WORDS).join('|')
  // Match "<number> <color>" — number can be digits or a spoken word
  const regex = new RegExp(
    `(\\d+|${numWordPattern})\\s+(${colorPattern})`,
    'gi',
  )

  const results = []
  let match
  while ((match = regex.exec(lower)) !== null) {
    const rawNum = match[1].toLowerCase()
    const rawColor = match[2].toLowerCase()
    const count = /^\d+$/.test(rawNum)
      ? parseInt(rawNum, 10)
      : NUMBER_WORDS[rawNum]

    if (count && count > 0) {
      // Normalize "grey" → "Gray" for display; capitalize everything else
      const display = rawColor === 'grey' ? 'Gray'
        : rawColor.charAt(0).toUpperCase() + rawColor.slice(1)
      results.push({ id: crypto.randomUUID(), count, color: display })
    }
  }
  return results
}

function swatchColor(colorName) {
  const lower = colorName.toLowerCase()
  return SWATCH_OVERRIDES[lower] ?? lower
}

export default function App() {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [supported, setSupported] = useState(true)
  const [copied, setCopied] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) {
          final += r[0].transcript
        } else {
          interim += r[0].transcript
        }
      }

      if (final) {
        const parsed = parsePattern(final)
        if (parsed.length > 0) {
          setEntries(prev => [...prev, ...parsed])
        }
        setInterimText('')
      } else {
        setInterimText(interim)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      if (event.error === 'network') {
        setError(
          'Speech recognition network error. ' +
          'In Edge, go to edge://settings/privacy and enable "Use online speech recognition". ' +
          'Then try again.'
        )
      } else {
        setError(`Microphone error: ${event.error}`)
      }
      setIsListening(false)
      setInterimText('')
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    return () => recognition.abort()
  }, [])

  const toggleListening = () => {
    if (!supported) return
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      setError('')
      setInterimText('')
      try {
        recognitionRef.current?.start()
        setIsListening(true)
      } catch {
        setError('Could not start microphone. Try refreshing the page.')
      }
    }
  }

  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id))

  const clearAll = () => setEntries([])

  const copyPattern = async () => {
    const text = entries.map(e => `${e.count} - ${e.color}`).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="yarn-icon">&#x1F9F6;</div>
        <h1>Crochet Pattern Recorder</h1>
        <p>Speak your stitch counts and colors to build your pattern</p>
      </header>

      {!supported && (
        <div className="banner banner--error">
          Speech recognition is not supported in this browser.
          Please use Chrome or Edge.
        </div>
      )}

      {error && <div className="banner banner--error">{error}</div>}

      <div className="record-area">
        <button
          className={`mic-btn${isListening ? ' mic-btn--active' : ''}`}
          onClick={toggleListening}
          disabled={!supported}
          aria-label={isListening ? 'Stop recording' : 'Start recording'}
        >
          <span className="mic-icon">{isListening ? '⏹' : '🎤'}</span>
          {isListening ? 'Stop Recording' : 'Start Recording'}
        </button>

        {isListening && (
          <div className="listening-indicator">
            <span className="dot" /><span className="dot" /><span className="dot" />
            Listening…
          </div>
        )}

        {interimText && (
          <div className="transcript">
            <span className="transcript-label">Hearing:</span>
            <span className="transcript-text">&ldquo;{interimText}&rdquo;</span>
          </div>
        )}
      </div>

      <div className="hint">
        Try saying: <em>&ldquo;4 black, 6 red, 2 blue&rdquo;</em>
      </div>

      {entries.length > 0 ? (
        <section className="pattern-card">
          <div className="pattern-card__header">
            <h2>Pattern</h2>
            <div className="pattern-card__actions">
              <button className="btn btn--copy" onClick={copyPattern}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="btn btn--clear" onClick={clearAll}>
                Clear All
              </button>
            </div>
          </div>

          <ul className="pattern-list">
            {entries.map((entry) => (
              <li key={entry.id} className="pattern-row">
                <span
                  className="swatch"
                  style={{ background: swatchColor(entry.color) }}
                  aria-hidden="true"
                />
                <span className="row-count">{entry.count}</span>
                <span className="row-sep">—</span>
                <span className="row-color">{entry.color}</span>
                <button
                  className="row-remove"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`Remove ${entry.count} ${entry.color}`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="empty-state">
          <p>No entries yet.</p>
          <p>Press <strong>Start Recording</strong> and speak your pattern.</p>
        </div>
      )}
    </div>
  )
}
