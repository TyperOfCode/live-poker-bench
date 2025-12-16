import { useEffect } from 'react';
import { useReplayStore, selectCurrentFrame } from './state/replayStore';
import { useAutoPlay, useKeyboardControls } from './hooks';
import { PokerTable } from './components/table';
import { PlaybackControls, SpeedControl, StreetJump, Timeline, HandNavigation } from './components/controls';
import { HandList, EliminationTracker } from './components/navigation';
import { AIReasoningPanel } from './components/reasoning';
import { getBlindLevelForHand } from './data/tournament';

function Header() {
  const tournament = useReplayStore((state) => state.tournament);
  const tournamentId = useReplayStore((state) => state.tournamentId);
  const availableTournaments = useReplayStore((state) => state.availableTournaments);
  const loadTournament = useReplayStore((state) => state.loadTournament);
  const currentHandNumber = useReplayStore((state) => state.currentHandNumber);
  const handData = useReplayStore((state) => state.handData);

  if (!tournament || !handData) return null;

  const blinds = getBlindLevelForHand(currentHandNumber, tournament.meta);

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">
            Poker Tournament Replay
          </h1>
          <select
            value={tournamentId || ''}
            onChange={(e) => loadTournament(e.target.value)}
            className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-gray-500 focus:outline-none focus:border-blue-500"
          >
            {availableTournaments.map((id) => (
              <option key={id} value={id}>
                Tournament {parseInt(id, 10)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-6">
          <HandNavigation />
          <div className="text-gray-400 text-sm">
            Level {blinds.level} ({blinds.sb}/{blinds.bb})
          </div>
        </div>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <div className="text-gray-400">Loading tournament...</div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  const loadTournament = useReplayStore((state) => state.loadTournament);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-6xl mb-4">!</div>
        <div className="text-white text-xl mb-2">Error Loading Data</div>
        <div className="text-gray-400 mb-6">{error}</div>
        <button
          onClick={() => loadTournament('001')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function MainContent() {
  const handData = useReplayStore((state) => state.handData);
  const agentData = useReplayStore((state) => state.agentData);
  const frames = useReplayStore((state) => state.frames);
  const currentFrameIndex = useReplayStore((state) => state.currentFrameIndex);
  const currentFrame = useReplayStore(selectCurrentFrame);
  const selectedSeat = useReplayStore((state) => state.selectedSeat);
  const selectSeat = useReplayStore((state) => state.selectSeat);

  if (!handData) return null;

  // Build player states for table
  const players = handData.players.map((player) => {
    // Get more accurate stack from agent data if available
    let stack = player.stack_start;

    // Check if player has folded by looking at frames up to current frame
    const hasFolded = frames.slice(0, currentFrameIndex + 1).some(
      (f) => f.seat === player.seat && f.action === 'fold'
    );

    // Try to get better stack estimate from agent observations
    if (agentData) {
      const decisions = agentData.decisions[String(player.seat)];
      if (decisions && decisions.length > 0) {
        const latestDecision = decisions[decisions.length - 1];
        stack = latestDecision.observation.my_stack;
      }
    }

    return {
      seat: player.seat,
      name: player.name,
      stack,
      holeCards: handData.hole_cards[String(player.seat)] as [string, string] | undefined,
      hasFolded,
      isEliminated: stack <= 0,
    };
  });

  return (
    <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
      {/* Left sidebar - Navigation */}
      <div className="w-64 flex-shrink-0 bg-gray-900 rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
        <div className="flex-1 overflow-hidden">
          <HandList />
        </div>
        <div className="border-t border-gray-700 flex-shrink-0">
          <EliminationTracker />
        </div>
      </div>

      {/* Main area - Table + Controls */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Poker Table */}
        <div className="flex-1 flex items-center justify-center">
          <PokerTable
            players={players}
            communityCards={currentFrame?.communityCards || []}
            pot={currentFrame?.potAfterAction || 0}
            buttonSeat={handData.button_seat}
            currentFrame={currentFrame}
            selectedSeat={selectedSeat}
            onSelectSeat={selectSeat}
          />
        </div>

        {/* Playback Controls */}
        <div className="bg-gray-900 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <StreetJump />
            <PlaybackControls />
            <SpeedControl />
          </div>
          <Timeline />
        </div>
      </div>

      {/* Right sidebar - AI Reasoning */}
      <div className="w-96 flex-shrink-0 max-h-[calc(100vh-100px)] overflow-hidden">
        <AIReasoningPanel />
      </div>
    </div>
  );
}

export default function App() {
  const loadAvailableTournaments = useReplayStore((state) => state.loadAvailableTournaments);
  const loadTournament = useReplayStore((state) => state.loadTournament);
  const isLoadingTournament = useReplayStore((state) => state.isLoadingTournament);
  const tournament = useReplayStore((state) => state.tournament);
  const error = useReplayStore((state) => state.error);

  // Set up hooks
  useAutoPlay();
  useKeyboardControls();

  // Auto-load available tournaments and first tournament on mount
  useEffect(() => {
    loadAvailableTournaments();
    loadTournament('001');
  }, [loadAvailableTournaments, loadTournament]);

  if (error) {
    return <ErrorState error={error} />;
  }

  if (isLoadingTournament || !tournament) {
    return <LoadingState />;
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <Header />
      <MainContent />
    </div>
  );
}
