import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { aiApi, setAuthToken } from '../services/api';

const WELCOME = 'Hi! I\'m your RideFlow Trip Assistant 🗺️\nAsk me about things to do at your destination, local tips, restaurants, attractions — anything about your trip!';

const ChatWidget = ({ onClose }) => {
  const { getToken } = useAuth();
  const [messages,    setMessages]    = useState([{ role: 'assistant', text: WELCOME }]);
  const [input,       setInput]       = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const send = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setChatLoading(true);
    try {
      const token = await getToken();
      if (token) setAuthToken(token);
      const res = await aiApi.getDestinationSuggestions(text);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.data?.suggestions || 'No response. Try again.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Something went wrong — please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const newChat = () => { setMessages([{ role: 'assistant', text: WELCOME }]); setInput(''); };

  return (
    <div className="chat-panel">
      <div className="strata-panel-header">
        <span>✦ Trip Assistant</span>
        <div className="chat-header-actions">
          <button className="chat-new-btn" onClick={newChat} title="Start a new conversation">↺ New chat</button>
          <button className="strata-panel-close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg-${m.role}`}>
            {m.role === 'assistant' && <div className="chat-msg-avatar">✦</div>}
            <div className="chat-msg-bubble">{m.text}</div>
          </div>
        ))}
        {chatLoading && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-avatar">✦</div>
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
          placeholder="Ask about your destination…"
          disabled={chatLoading}
          autoFocus
        />
        <button className="chat-send-btn" onClick={send} disabled={!input.trim() || chatLoading}>→</button>
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
        aria-label="Trip assistant chat"
      >
        {isOpen ? '×' : '💬'}
      </button>
    </div>
  );
};

export default TripAssistant;
