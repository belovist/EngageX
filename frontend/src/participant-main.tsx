import { createRoot } from 'react-dom/client';
import ParticipantApp from './apps/participant/ParticipantApp';
import './index.css';

createRoot(document.getElementById('participant-root')!).render(<ParticipantApp />);
