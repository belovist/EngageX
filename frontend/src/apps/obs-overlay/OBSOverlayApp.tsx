import { useAttentionScores } from "../host/hooks/useAttentionScores";
import { ParticipantGrid } from "./components/ParticipantGrid";

export default function OBSOverlayApp() {
  const { participants } = useAttentionScores();

  return (
    <main className="h-screen w-screen bg-transparent">
      <ParticipantGrid participants={participants} />
    </main>
  );
}
