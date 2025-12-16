import { useState, useEffect, useRef, useCallback } from 'react';
import type { TournamentStatistics, OverallStatistics } from '../types';
import { calculateTournamentStatistics } from '../utils/statistics/tournamentStats';
import { calculateOverallStatistics } from '../utils/statistics/crossTournamentStats';
import { useReplayStore } from '../state/replayStore';

/**
 * Hook to calculate and cache tournament statistics
 */
export function useTournamentStatistics(tournamentId: string | null) {
  const tournament = useReplayStore((state) => state.tournament);
  const [stats, setStats] = useState<TournamentStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Cache stats by tournament ID
  const cache = useRef<Map<string, TournamentStatistics>>(new Map());

  useEffect(() => {
    if (!tournamentId || !tournament) {
      setStats(null);
      return;
    }

    // Check cache first
    if (cache.current.has(tournamentId)) {
      setStats(cache.current.get(tournamentId)!);
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ loaded: 0, total: tournament.handCount });

    calculateTournamentStatistics(
      tournamentId,
      tournament,
      (loaded, total) => setProgress({ loaded, total })
    )
      .then((result) => {
        cache.current.set(tournamentId, result);
        setStats(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to calculate statistics');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tournamentId, tournament]);

  return { stats, loading, progress, error };
}

/**
 * Hook to calculate overall statistics across all tournaments
 */
export function useOverallStatistics() {
  const availableTournaments = useReplayStore((state) => state.availableTournaments);
  const [stats, setStats] = useState<OverallStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Cache overall stats
  const cache = useRef<OverallStatistics | null>(null);
  const cachedTournaments = useRef<string[]>([]);

  const loadStats = useCallback(async () => {
    if (availableTournaments.length === 0) {
      return;
    }

    // Check if cache is still valid
    if (
      cache.current &&
      JSON.stringify(cachedTournaments.current) === JSON.stringify(availableTournaments)
    ) {
      setStats(cache.current);
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ loaded: 0, total: availableTournaments.length });

    try {
      const result = await calculateOverallStatistics(
        availableTournaments,
        (loaded, total) => setProgress({ loaded, total })
      );
      cache.current = result;
      cachedTournaments.current = [...availableTournaments];
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate overall statistics');
    } finally {
      setLoading(false);
    }
  }, [availableTournaments]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, progress, error, reload: loadStats };
}
