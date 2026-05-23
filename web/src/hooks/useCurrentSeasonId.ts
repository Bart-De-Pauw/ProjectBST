import { useCallback, useEffect, useState } from "react";
import { apiFetch, jsonArray } from "../api/client";

type SeasonRow = { seasonId: number; seasonName: string };

export function pickLatestSeasonId(seasons: SeasonRow[]): number | null {
  if (seasons.length === 0) return null;
  return seasons.reduce((best, s) => (s.seasonId > best ? s.seasonId : best), seasons[0].seasonId);
}

export function useCurrentSeasonId(enabled: boolean) {
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSeasonId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch("/seasons");
    if (!res.ok) {
      setSeasonId(null);
      setLoading(false);
      return;
    }
    const seasons = jsonArray<SeasonRow>(await res.json());
    setSeasonId(pickLatestSeasonId(seasons));
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { seasonId, loading, refresh };
}
