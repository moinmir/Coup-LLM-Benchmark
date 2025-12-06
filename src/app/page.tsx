"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RunGame } from "./_components/run-game";
import { Results } from "./_components/results";
import { Strategy } from "./_components/strategy";
import { Rules } from "./_components/rules";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("run");

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-50">
        <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xl text-primary-foreground">
              ♔
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-wider text-foreground">
                Coup LLM Arena
              </h1>
              <p className="font-mono text-xs text-muted-foreground">
                AI benchmark for strategic deception
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 w-fit border border-border/30 bg-card/80">
            <TabsTrigger value="run" className="font-mono text-xs uppercase tracking-wider">
              Play
            </TabsTrigger>
            <TabsTrigger value="results" className="font-mono text-xs uppercase tracking-wider">
              Results
            </TabsTrigger>
            <TabsTrigger value="strategy" className="font-mono text-xs uppercase tracking-wider">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="rules" className="font-mono text-xs uppercase tracking-wider">
              Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="run" className="animate-in fade-in-50 duration-200">
            <RunGame />
          </TabsContent>

          <TabsContent value="results" className="animate-in fade-in-50 duration-200">
            <Results />
          </TabsContent>

          <TabsContent value="strategy" className="animate-in fade-in-50 duration-200">
            <Strategy />
          </TabsContent>

          <TabsContent value="rules" className="animate-in fade-in-50 duration-200">
            <Rules />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
