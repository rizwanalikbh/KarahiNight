import { useState, useEffect } from "react";
import { useGetSummary, useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

interface Countdown { h: number; m: number; s: number }

function useCountdown(targetIso: string | null | undefined): Countdown | null {
  const [timeLeft, setTimeLeft] = useState<Countdown | null>(null);

  useEffect(() => {
    if (!targetIso) { setTimeLeft(null); return; }
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        h: Math.floor(diff / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1_000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return timeLeft;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function CountdownDisplay({ t }: { t: Countdown }) {
  const days = Math.floor(t.h / 24);
  const hours = t.h % 24;
  return (
    <div className="flex items-center gap-1.5 text-white">
      <Clock className="w-4 h-4 shrink-0 opacity-80" />
      <span className="font-mono text-sm font-semibold tabular-nums">
        {days > 0 ? `${days}d ` : ""}{pad(hours)}:{pad(t.m)}:{pad(t.s)}
      </span>
    </div>
  );
}

export function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useGetSummary({});
  const login = useLogin();
  const countdown = useCountdown(summary?.orderDeadline);

  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [code, setCode] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const guest = summary?.guests.find((g) => String(g.id) === selectedGuestId);
    if (!guest || !code) return;

    login.mutate(
      { data: { name: guest.name, code } },
      {
        onSuccess: async () => {
          await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/order");
        },
        onError: () => {
          toast({ title: "Wrong code", description: "That code doesn't match. Try again.", variant: "destructive" });
          setCode("");
        },
      }
    );
  };

  const showProgress = summary && summary.totalCapacity > 0 &&
    (summary.totalBooked / summary.totalCapacity) >= 0.25;
  const progressPct = summary ? Math.min(100, Math.round((summary.totalBooked / summary.totalCapacity) * 100)) : 0;

  return (
    <Layout>
      <div className="flex flex-col items-center max-w-2xl mx-auto space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <img src="/pizza-icon.png" alt="Pizza" className="w-16 h-16 opacity-80" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-foreground">
            Private Pizza Night
          </h1>
          {!isLoading && summary && (
            <p className="text-base font-medium text-primary">
              {formatEventDate(summary.eventDate)} — {summary.eventName}
            </p>
          )}
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            You are invited to a private evening of handmade Neapolitan pizza. Limited spots available, pre-order only.
          </p>
        </div>

        {/* Hero image */}
        <div className="w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border relative">
          <img
            src="/pizza-hero.png"
            alt="Handmade pizza"
            className="w-full h-full object-cover"
          />

          {!isLoading && summary && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-left">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-white font-medium text-lg">{summary.price} DKK per pizza</div>
                    {summary.description && (
                      <div className="text-white/80 text-sm">{summary.description}</div>
                    )}
                  </div>
                  {summary.orderingOpen && countdown && (
                    <div className="shrink-0 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
                      <div className="text-white/60 text-[10px] uppercase tracking-widest mb-0.5">Closes in</div>
                      <CountdownDisplay t={countdown} />
                    </div>
                  )}
                </div>
              </div>
              {!summary.orderingOpen && (
                /* Closed badge — top-left, doesn't cover the pizza */
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 bg-black/55 backdrop-blur-sm rounded-full pl-3 pr-4 py-2">
                    <Lock className="w-3.5 h-3.5 text-white/80 shrink-0" />
                    <span className="text-white text-sm font-semibold leading-none">
                      {summary.totalRemaining <= 0 ? "Fully Booked" : "Orders Closed"}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Progress bar — only when ≥25% booked */}
        {!isLoading && showProgress && (
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Spots filling up</span>
              <span className="text-foreground font-semibold">
                {summary!.totalBooked} / {summary!.totalCapacity} pizzas ordered
              </span>
            </div>
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  progressPct >= 90 ? "bg-destructive" :
                  progressPct >= 70 ? "bg-orange-400" :
                  "bg-primary"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {summary!.totalRemaining} spot{summary!.totalRemaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
        )}

        {/* Login card */}
        {isLoading ? (
          <Skeleton className="w-full h-48 rounded-xl" />
        ) : summary ? (
          <Card className="w-full bg-card border-card-border shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">
                {summary.orderingOpen ? "Reserve Your Spot" : "Your Order"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!summary.orderingOpen && (
                <p className="text-sm text-muted-foreground text-center mb-5 pb-5 border-b border-border">
                  {summary.totalRemaining <= 0 ? "All spots have been taken." : "Ordering is now closed."}{" "}
                  Log in below to view your order.
                </p>
              )}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2 text-left">
                  <Label className="text-sm font-semibold">Your Name</Label>
                  <Select value={selectedGuestId} onValueChange={setSelectedGuestId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select your name..." />
                    </SelectTrigger>
                    <SelectContent>
                      {summary.guests.map((guest) => (
                        <SelectItem key={guest.id} value={String(guest.id)}>
                          {guest.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="code" className="text-sm font-semibold">4-Digit Code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg"
                  disabled={!selectedGuestId || code.length !== 4 || login.isPending}
                >
                  {login.isPending
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : summary.orderingOpen ? "Order My Pizza" : "View My Order"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}
