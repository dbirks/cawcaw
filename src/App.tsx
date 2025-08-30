import { useTheme } from '@/hooks/useTheme';
import ChatView from './components/ChatView';

function App() {
  // Initialize theme on app startup
  useTheme();

  return <ChatView />;
}

export default App;
