import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { register } from './registerServiceWorker';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Регистрация
register({
  onSuccess: (registration) => {
    console.log('PWA: Установлен и готов к оффлайну');
  },
  onUpdate: (registration) => {
    console.log('PWA: Доступно обновление');
    // Показ уведомлений
  }
});