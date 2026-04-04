import { createRoot } from 'react-dom/client';
import { ParticipantApp } from './ParticipantApp';
import './index.css';

createRoot(document.getElementById('participant-root')!).render(<ParticipantApp />);
