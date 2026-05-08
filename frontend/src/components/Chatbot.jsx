import { useState, useRef, useEffect, useCallback } from 'react'

const API = '/api'
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Hello! I\'m InfraWatch AI 🏗️ Ask me about infrastructure risks, maintenance priorities, or any asset in the system. You can also use the mic to speak!' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const messagesEnd = useRef(null)
  const recogRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Speak AI response
  const speak = useCallback((text) => {
    if (!voiceOn || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const cleaned = text.replace(/[*#_`]/g, '').replace(/\n+/g, '. ')
    const utter = new SpeechSynthesisUtterance(cleaned)
    utter.rate = 1.05
    utter.pitch = 1.0
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
    if (preferred) utter.voice = preferred
    window.speechSynthesis.speak(utter)
  }, [voiceOn])

  // Send message to API
  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const history = newMessages.slice(1).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        content: m.content,
      }))

      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(0, -1) }),
      })
      const data = await res.json()
      const reply = data.response || data.error || 'Sorry, something went wrong.'
      setMessages(prev => [...prev, { role: 'model', content: reply }])
      speak(reply)
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', content: 'Connection error — is the Flask server running?' }])
    }
    setLoading(false)
  }, [input, messages, loading, speak])

  // Voice input
  const toggleVoice = () => {
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Try Chrome.')
      return
    }

    if (listening) {
      recogRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
      // Auto-send after voice input
      setTimeout(() => sendMessage(transcript), 200)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recogRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        className={`chat-toggle ${open ? 'active' : ''}`}
        onClick={() => { setOpen(!open); window.speechSynthesis?.cancel() }}
        title="InfraWatch AI Chat"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-avatar">🤖</div>
              <div>
                <div className="chat-header-title">InfraWatch AI</div>
                <div className="chat-header-sub">Infrastructure Assistant</div>
              </div>
            </div>
            <button
              className={`chat-voice-toggle ${voiceOn ? 'on' : 'off'}`}
              onClick={() => { setVoiceOn(!voiceOn); window.speechSynthesis?.cancel() }}
              title={voiceOn ? 'Voice on' : 'Voice off'}
            >
              {voiceOn ? '🔊' : '🔇'}
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === 'model' && <span className="chat-msg-avatar">🤖</span>}
                <div className="chat-msg-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg model">
                <span className="chat-msg-avatar">🤖</span>
                <div className="chat-msg-bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          <div className="chat-input-bar">
            <button
              className={`chat-mic ${listening ? 'active' : ''}`}
              onClick={toggleVoice}
              title={listening ? 'Listening...' : 'Voice input'}
            >
              🎙️
            </button>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder={listening ? 'Listening...' : 'Ask about infrastructure...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading || listening}
            />
            <button
              className="chat-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
