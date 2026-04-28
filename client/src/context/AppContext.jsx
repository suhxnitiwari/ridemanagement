import { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

const initialState = {
  theme:       localStorage.getItem('rideflow-theme') || 'light',
  userRole:    null,
  activeRide:  null,
  toasts:      [],
};

let toastId = 0;

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_THEME':
      localStorage.setItem('rideflow-theme', action.payload);
      document.documentElement.setAttribute('data-theme', action.payload);
      return { ...state, theme: action.payload };

    case 'SET_ROLE':
      return { ...state, userRole: action.payload };

    case 'SET_ACTIVE_RIDE':
      return { ...state, activeRide: action.payload };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, { id: ++toastId, ...action.payload }] };

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };

    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' });
  }, [state.theme]);

  const setRole       = useCallback((role) => dispatch({ type: 'SET_ROLE',        payload: role }),  []);
  const setActiveRide = useCallback((ride) => dispatch({ type: 'SET_ACTIVE_RIDE', payload: ride }),  []);
  const addToast      = useCallback((message, type = 'success') => dispatch({ type: 'ADD_TOAST',    payload: { message, type } }), []);
  const removeToast   = useCallback((id) => dispatch({ type: 'REMOVE_TOAST',  payload: id }), []);

  return (
    <AppContext.Provider value={{ ...state, toggleTheme, setRole, setActiveRide, addToast, removeToast }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
