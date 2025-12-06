"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export function Results() {
  const { data: results = [], isLoading } = api.game.getResults.useQuery();
  const clearResults = api.game.clearResults.useMutation();
  const utils = api.useUtils();

  const handleClear = async () => {
    await clearResults.mutateAsync();
    await utils.game.getResults.invalidate();
    toast.success("The records have been expunged");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 text-4xl">⏳</div>
        <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
          Consulting the archives...
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardContent className="py-16 text-center">
          <div className="mb-4 text-6xl opacity-20">📊</div>
          <p className="font-display text-xl tracking-wider text-foreground">
            The Archives Are Empty
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run some games to populate the hall of records.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const totalGames = results.length;
  const avgTurns =
    results.reduce((sum, r) => sum + r.totalTurns, 0) / totalGames;

  // Win counts by model
  const winCounts = new Map<string, number>();
  const gameCounts = new Map<string, number>();

  for (const result of results) {
    if (result.winnerModel) {
      winCounts.set(
        result.winnerModel,
        (winCounts.get(result.winnerModel) ?? 0) + 1
      );
    }
    for (const player of result.players) {
      gameCounts.set(player.model, (gameCounts.get(player.model) ?? 0) + 1);
    }
  }

  // Calculate win rates
  const modelStats = Array.from(gameCounts.entries()).map(([model, games]) => ({
    model,
    games,
    wins: winCounts.get(model) ?? 0,
    winRate: ((winCounts.get(model) ?? 0) / games) * 100,
  }));

  modelStats.sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="space-y-8">
      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Total Battles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-4xl tracking-wider text-primary">
              {totalGames}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Average Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-4xl tracking-wider text-primary">
              {avgTurns.toFixed(1)}
              <span className="ml-2 text-xl text-muted-foreground">turns</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Contestants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-4xl tracking-wider text-primary">
              {gameCounts.size}
              <span className="ml-2 text-xl text-muted-foreground">models</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Win rates table */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/30 bg-muted/30">
          <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
            <span className="text-primary">👑</span>
            Leaderboard
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="font-mono text-xs uppercase tracking-wider"
          >
            Clear Records
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider">Rank</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider">Model</TableHead>
                <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Games</TableHead>
                <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Wins</TableHead>
                <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelStats.map(({ model, games, wins, winRate }, index) => (
                <TableRow key={model} className="border-border/30">
                  <TableCell>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm ${
                      index === 0 ? "bg-primary/20 text-primary" :
                      index === 1 ? "bg-muted text-muted-foreground" :
                      index === 2 ? "bg-amber-500/10 text-amber-500" :
                      "text-muted-foreground"
                    }`}>
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {model.split("/").pop()}
                  </TableCell>
                  <TableCell className="text-right font-mono">{games}</TableCell>
                  <TableCell className="text-right font-mono">{wins}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono font-semibold ${
                        winRate > 50
                          ? "text-emerald-400"
                          : winRate > 25
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {winRate.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent games */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardHeader className="border-b border-border/30 bg-muted/30">
          <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
            <span className="text-primary">📜</span>
            Recent Battles
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider">#</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider">Victor</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider">Model</TableHead>
                <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.slice(-10).reverse().map((result, i) => (
                <TableRow key={i} className="border-border/30">
                  <TableCell className="font-mono text-muted-foreground">
                    {results.length - i}
                  </TableCell>
                  <TableCell className="font-medium">{result.winnerName}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {result.winnerModel?.split("/").pop()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {result.totalTurns} turns
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
