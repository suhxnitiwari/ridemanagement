import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { aiApi, setAuthToken } from '../services/api';

const WELCOME = "Hi! I'm the RideFlow Assistant. Ask me anything about booking rides, pricing, payments, safety, becoming a driver, or your account.";

const CHIPS = [
  'How do I book a ride?',
  'How is my fare calculated?',
  'Is there a cancellation fee?',
  'How do I become a driver?',
  'What if I feel unsafe?',
  'What payment methods work?',
];

const ChatWidget = ({ onClose }) => {
  const { getToken } = useAuth();
  const [messages,    setMessages]    = useState([{ role: 'assistant', content: WELCOME }]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [chipsShown,  setChipsShown]  = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setInput('');
    setChipsShown(false);
    const updated = [...messages, { role: 'user', content: trimmed }];
    setMessages(updated);
    setLoading(true);
    try {
      const token = await getToken();
      if (token) setAuthToken(token);
      const res = await aiApi.chat(updated);
      const reply = res.data?.reply || 'No response — please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong — please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setInput('');
    setChipsShown(true);
  };

  return (
    <div className="chat-panel">
      <div className="strata-panel-header">
        <span>🚗 RideFlow Assistant</span>
        <div className="chat-header-actions">
          <button className="chat-new-btn" onClick={newChat} title="Start a new conversation">↺ New chat</button>
          <button className="strata-panel-close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg-${m.role}`}>
            {m.role === 'assistant' && <div className="chat-msg-avatar">🚗</div>}
            <div className="chat-msg-bubble">{m.content}</div>
          </div>
        ))}

        {chipsShown && messages.length === 1 && (
          <div className="chat-chips">
            {CHIPS.map((c) => (
              <button key={c} className="chat-chip" onClick={() => send(c)}>{c}</button>
            ))}
          </div>
        )}

        {loading && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-avatar">🚗</div>
            <div className="chat-msg-bubble chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about RideFlow…"
          disabled={loading}
          autoFocus
        />
        <button className="chat-send-btn" onClick={() => send()} disabled={!input.trim() || loading}>→</button>
      </div>
    </div>
  );
};

const TripAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="strata-widget">
      {isOpen && (
        <div className="strata-panel">
          <ChatWidget onClose={() => setIsOpen(false)} />
        </div>
      )}
      <button
        className={`strata-fab${isOpen ? ' strata-fab-open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="RideFlow assistant chat"
      >
        {isOpen ? '×' : '🚗'}
      </button>
    </div>
  );
};

export default TripAssistant;
