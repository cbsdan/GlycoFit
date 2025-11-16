import React, { createContext, useContext, useReducer } from 'react';
import { ToastContainer } from '../components/Toast';

const ToastContext = createContext();

const initialState = {
  toasts: [],
  nextId: 1,
};

const ADD_TOAST = 'ADD_TOAST';
const REMOVE_TOAST = 'REMOVE_TOAST';

function toastReducer(state, action) {
  switch (action.type) {
    case ADD_TOAST:
      return {
        ...state,
        toasts: [...state.toasts, { ...action.payload, id: state.nextId }],
        nextId: state.nextId + 1,
      };
    case REMOVE_TOAST:
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload),
      };
    default:
      return state;
  }
}

export const ToastProvider = ({ children, position = 'top' }) => {
  const [state, dispatch] = useReducer(toastReducer, initialState);
  
  const showToast = (options) => {
    const { type, message, duration = 3000 } = options;
    
    dispatch({
      type: ADD_TOAST,
      payload: {
        type,
        message,
        duration,
        onHide: (id) => {
          dispatch({
            type: REMOVE_TOAST,
            payload: id,
          });
        },
      },
    });
  };
  
  const toast = {
    show: (message, options = {}) => showToast({ message, ...options }),
    success: (message, options = {}) => showToast({ message, type: 'SUCCESS', ...options }),
    error: (message, options = {}) => showToast({ message, type: 'ERROR', ...options }),
    info: (message, options = {}) => showToast({ message, type: 'INFO', ...options }),
    warning: (message, options = {}) => showToast({ message, type: 'WARNING', ...options }),
  };
  
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer
        toasts={state.toasts}
        position={position}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};
