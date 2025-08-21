import ChatView from './components/ChatView';
import { useTheme } from '@/hooks/useTheme';

function App() {
  // Initialize theme on app startup
  useTheme();

  return <ChatView />;
}

export default App;
