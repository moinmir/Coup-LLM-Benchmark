"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function Rules() {
  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/30 p-8">
        <div className="absolute -right-8 -top-8 text-[12rem] opacity-5">♔</div>
        <h2 className="font-display text-4xl tracking-wider text-foreground">
          The Art of Deception
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          In Coup, truth is a luxury and deception is a weapon. Each player schemes 
          for power in a corrupt Italian city-state, wielding influence through 
          bluffs, betrayals, and bold accusations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Setup */}
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="border-b border-border/30 bg-muted/30">
            <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
              <span className="text-primary">♠</span>
              The Deal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="space-y-4 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">1</span>
                <span>Each player receives <strong className="text-foreground">2 coins</strong> and <strong className="text-foreground">2 face-down character cards</strong> (your influence)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">2</span>
                <span>The deck contains <strong className="text-foreground">5 characters</strong> with 3 copies each</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">3</span>
                <span>Your cards are <strong className="text-foreground">secret</strong> — but you may lie about them</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Victory */}
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="border-b border-border/30 bg-muted/30">
            <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
              <span className="text-primary">♛</span>
              Victory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-4xl">
                👑
              </div>
              <div>
                <p className="text-lg text-foreground">
                  <strong>Eliminate all opponents</strong>
                </p>
                <p className="mt-2 text-muted-foreground">
                  The last player with at least one unrevealed card claims 
                  dominion over the court.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Characters */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <CardHeader className="border-b border-border/30 bg-muted/30">
          <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
            <span className="text-primary">♦</span>
            The Court
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Duke */}
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <h4 className="font-display text-lg tracking-wider text-violet-400">Duke</h4>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                <strong className="text-foreground">Tax:</strong> Take 3 coins
              </p>
              <p className="text-xs text-violet-400/70">
                Blocks Foreign Aid
              </p>
            </div>

            {/* Assassin */}
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl">🗡️</span>
                <h4 className="font-display text-lg tracking-wider text-red-400">Assassin</h4>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                <strong className="text-foreground">Kill:</strong> Pay 3, target loses card
              </p>
              <p className="text-xs text-red-400/70">
                Cannot block
              </p>
            </div>

            {/* Captain */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl">⚓</span>
                <h4 className="font-display text-lg tracking-wider text-blue-400">Captain</h4>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                <strong className="text-foreground">Steal:</strong> Take 2 coins from player
              </p>
              <p className="text-xs text-blue-400/70">
                Blocks Stealing
              </p>
            </div>

            {/* Ambassador */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl">📜</span>
                <h4 className="font-display text-lg tracking-wider text-emerald-400">Ambassador</h4>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                <strong className="text-foreground">Exchange:</strong> Swap cards with deck
              </p>
              <p className="text-xs text-emerald-400/70">
                Blocks Stealing
              </p>
            </div>

            {/* Contessa */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl">👸</span>
                <h4 className="font-display text-lg tracking-wider text-amber-400">Contessa</h4>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                <strong className="text-foreground">None</strong>
              </p>
              <p className="text-xs text-amber-400/70">
                Blocks Assassination
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="border-b border-border/30 bg-muted/30">
            <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
              <span className="text-primary">♣</span>
              General Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Available to all players regardless of cards:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
                <span className="font-mono text-2xl">💰</span>
                <div>
                  <p className="font-medium text-foreground">Income</p>
                  <p className="text-sm text-muted-foreground">Take 1 coin • Cannot be blocked or challenged</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
                <span className="font-mono text-2xl">💵</span>
                <div>
                  <p className="font-medium text-foreground">Foreign Aid</p>
                  <p className="text-sm text-muted-foreground">Take 2 coins • Can be blocked by Duke</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg bg-destructive/10 p-3">
                <span className="font-mono text-2xl">⚔️</span>
                <div>
                  <p className="font-medium text-foreground">Coup</p>
                  <p className="text-sm text-muted-foreground">Pay 7 coins • Target loses influence • <strong>Mandatory at 10+ coins</strong></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bluffing */}
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardHeader className="border-b border-border/30 bg-muted/30">
            <CardTitle className="flex items-center gap-3 font-display text-xl tracking-wider">
              <span className="text-primary">♥</span>
              Bluffing & Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h5 className="mb-2 font-medium text-foreground">🎭 The Art of the Bluff</h5>
                <p className="text-sm text-muted-foreground">
                  You may claim <strong className="text-foreground">any character action</strong> even 
                  if you don&apos;t have the card. The key is making others believe you.
                </p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h5 className="mb-2 font-medium text-foreground">⚡ Challenges</h5>
                <p className="text-sm text-muted-foreground">
                  Any player can challenge a claim:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• <strong className="text-emerald-400">Challenger wins:</strong> Bluffer loses influence, action fails</li>
                  <li>• <strong className="text-red-400">Challenger loses:</strong> Challenger loses influence, action succeeds</li>
                </ul>
              </div>
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
                <h5 className="mb-2 font-medium text-foreground">🛡️ Blocks</h5>
                <p className="text-sm text-muted-foreground">
                  Blocks can also be bluffed — and challenged! A failed block challenge 
                  means the blocker loses influence but the action is still blocked.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
