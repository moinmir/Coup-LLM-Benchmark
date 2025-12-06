"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { api } from "~/trpc/react";

function getModelShortName(model: string): string {
  return model.split("/").pop() ?? model;
}

export function Strategy() {
  const { data: analytics, isLoading } = api.game.getAnalytics.useQuery();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 text-4xl">⏳</div>
        <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
          Analyzing strategies...
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totalGames === 0) {
    return (
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardContent className="py-16 text-center">
          <div className="mb-4 text-6xl opacity-20">🧠</div>
          <p className="font-display text-xl tracking-wider text-foreground">
            No Data to Analyze
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run some games to see strategic insights and behavior patterns.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { bluffStats, challengeStats, blockStats, invalidActionStats } = analytics;

  // Check for any invalid actions
  const hasInvalidActions = Object.values(invalidActionStats).some(s => s.total > 0);

  return (
    <div className="space-y-8">
      {/* Summary */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardContent className="p-6">
          <div className="text-center">
            <span className="font-display text-4xl text-primary">{analytics.totalGames}</span>
            <span className="ml-2 font-mono text-sm text-muted-foreground">games analyzed</span>
          </div>
        </CardContent>
      </Card>

      {/* Invalid Actions Alert - Most Important */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardHeader className="border-b border-border/30 bg-muted/30">
          <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
            <span className={hasInvalidActions ? "text-destructive" : "text-emerald-400"}>
              {hasInvalidActions ? "⚠️" : "✓"}
            </span>
            Game Engine Integrity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {hasInvalidActions ? (
            <div className="space-y-4">
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                <AlertTitle className="font-display tracking-wider">Parse Errors Detected</AlertTitle>
                <AlertDescription>
                  Some models had trouble following the response format.
                </AlertDescription>
              </Alert>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase tracking-wider">Model</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Errors</TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wider">Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(invalidActionStats)
                    .filter(([, s]) => s.total > 0)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([model, stats]) => (
                      <TableRow key={model} className="border-border/30">
                        <TableCell className="font-mono text-sm">
                          {getModelShortName(model)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {stats.total}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {stats.types.slice(0, 2).join(", ")}
                          {stats.types.length > 2 && "..."}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <AlertTitle className="font-display tracking-wider text-emerald-400">All Systems Nominal</AlertTitle>
              <AlertDescription>
                All models followed the response format correctly.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Strategy Stats Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bluff Stats */}
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="border-b border-border/30 bg-muted/30">
            <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
              <span className="text-primary">🎭</span>
              Bluff Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {Object.keys(bluffStats).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase tracking-wider">Model</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Bluffs</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Got Away</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Caught</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(bluffStats)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([model, stats]) => (
                    <TableRow key={model} className="border-border/30">
                      <TableCell className="font-mono text-sm">
                        {getModelShortName(model)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{stats.total}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-400">
                        {stats.successful}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-400">
                        {stats.caught}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-muted-foreground">No bluff data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Challenge Stats */}
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="border-b border-border/30 bg-muted/30">
            <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
              <span className="text-primary">⚔️</span>
              Challenge Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {Object.keys(challengeStats).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase tracking-wider">Model</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Challenges</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Correct</TableHead>
                    <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Accuracy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(challengeStats)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([model, stats]) => (
                    <TableRow key={model} className="border-border/30">
                      <TableCell className="font-mono text-sm">
                        {getModelShortName(model)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{stats.total}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-400">
                        {stats.successful}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {stats.total > 0
                          ? ((stats.successful / stats.total) * 100).toFixed(0)
                          : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-muted-foreground">No challenge data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Block Stats */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardHeader className="border-b border-border/30 bg-muted/30">
          <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
            <span className="text-primary">🛡️</span>
            Blocking Behavior
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Object.keys(blockStats).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase tracking-wider">Model</TableHead>
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Blocks</TableHead>
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Successful</TableHead>
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Bluff Blocks</TableHead>
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider">Success Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(blockStats)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([model, stats]) => (
                  <TableRow key={model} className="border-border/30">
                    <TableCell className="font-mono text-sm">
                      {getModelShortName(model)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{stats.total}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-400">
                      {stats.successful}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-400">
                      {stats.bluffs}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {stats.total > 0
                        ? ((stats.successful / stats.total) * 100).toFixed(0)
                        : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-muted-foreground">No block data yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
