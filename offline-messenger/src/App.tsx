import { useEffect } from 'react';
import './App.css';
import Chat from './components/Chat';

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return <Chat />;
}

export default App;