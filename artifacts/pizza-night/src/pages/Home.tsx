import { useState, useEffect } from "react";
import {
  useGetSummary, useLogin, useListEvents, useGetMe,
  getGetMeQueryKey, getGetSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Event } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, Lock, CalendarDays, ArrowRight, Check, Search, Pizza } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return dateStr; }
}

function formatModalDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  } catch { return dateStr; }
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

// ─── Event picker modal ───────────────────────────────────────────────────────

interface EventPickerModalProps {
  events: Event[];
  selectedId: number | undefined;
  open: boolean;
  onSelect: (id: number) => void;
  onOpenChange: (open: boolean) => void;
}

function EventPickerModal({ events, selectedId, open, onSelect, onOpenChange }: EventPickerModalProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? events.filter((ev) => {
        const q = query.toLowerCase();
        const dateText = formatModalDate(ev.date).toLowerCase();
        const tags = (ev.segmentDescriptions ?? []).join(" ").toLowerCase();
        return (
          ev.name.toLowerCase().includes(q) ||
          dateText.includes(q) ||
          tags.includes(q) ||
          (ev.description ?? "").toLowerCase().includes(q)
        );
      })
    : events;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <div className="bg-primary/5 border-b border-border/50 px-6 pt-7 pb-5 text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold text-foreground text-center">
              Which evening are you joining?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1.5">
            Select the pizza night you were invited to.
          </p>
        </div>

        {events.length > 3 && (
          <div className="px-4 pt-4 pb-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, date, or tags…"
                className="pl-9 h-9 text-sm bg-background"
              />
            </div>
          </div>
        )}

        <div className="p-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">No events match your search.</p>
          )}
          {filtered.map((ev) => {
            const isSelected = ev.id === selectedId;
            const segDescs = (ev.segmentDescriptions ?? []).filter(Boolean);
            const subtitle = segDescs.length > 0 ? segDescs.join(", ") : ev.description ?? null;
            return (
              <button
                key={ev.id}
                onClick={() => onSelect(ev.id)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/3 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`font-serif font-bold text-lg leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {ev.name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{formatModalDate(ev.date)}</div>
                    {subtitle && (
                      <div className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed line-clamp-2">{subtitle}</div>
                    )}
                  </div>
                  <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "border-primary bg-primary" : "border-border group-hover:border-primary/40"
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-5">
          <Button
            className="w-full h-12 text-base gap-2"
            disabled={selectedId === undefined}
            onClick={() => onOpenChange(false)}
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session } = useGetMe();
  const isLoggedIn = session?.authenticated === true;
  const isUser = session?.role === "user";

  // Events list — server returns only the user's events when authenticated,
  // all active events when not authenticated.
  const { data: events } = useListEvents();
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerShownOnce, setPickerShownOnce] = useState(false);

  useEffect(() => {
    if (!events || events.length === 0) return;
    if (selectedEventId === undefined) setSelectedEventId(events[0].id);
    if (events.length > 1 && !pickerShownOnce) {
      setPickerOpen(true);
      setPickerShownOnce(true);
    }
  }, [events, selectedEventId, pickerShownOnce]);

  const handlePickerSelect = (id: number) => {
    setSelectedEventId(id);
    setSelectedGuestId("");
    setCode("");
  };

  const eventId = selectedEventId ?? events?.[0]?.id;
  const { data: summary, isLoading } = useGetSummary(
    { eventId },
    { query: { enabled: !!eventId, queryKey: getGetSummaryQueryKey({ eventId }) } }
  );
  const login = useLogin();
  const countdown = useCountdown(summary?.orderDeadline);

  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [code, setCode] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const guest = summary?.guests.find((g) => String(g.id) === selectedGuestId);
    if (!guest || !code) return;

    login.mutate(
      { data: { name: guest.name, code, eventId } },
      {
        onSuccess: async () => {
          await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/order");
        },
        onError: (err: any) => {
          const msg: string = err?.response?.data?.error ?? "";
          if (msg.includes("not on the guest list")) {
            toast({
              title: "Not on the guest list",
              description: "You're not invited to this event. Try selecting a different one.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Wrong code", description: "That code doesn't match. Try again.", variant: "destructive" });
          }
          setCode("");
        },
      }
    );
  };

  const showProgress = summary && summary.totalCapacity > 0 &&
    (summary.totalBooked / summary.totalCapacity) >= 0.25;
  const progressPct = summary
    ? Math.min(100, Math.round((summary.totalBooked / summary.totalCapacity) * 100))
    : 0;
  const multipleEvents = events && events.length > 1;

  return (
    <Layout>
      {/* Only show event picker when there are multiple events to choose from */}
      {multipleEvents && events && (
        <EventPickerModal
          events={events}
          selectedId={selectedEventId}
          open={pickerOpen}
          onSelect={handlePickerSelect}
          onOpenChange={setPickerOpen}
        />
      )}

      <div className="flex flex-col items-center max-w-2xl mx-auto space-y-8 text-center">
        {/* Header */}
        <div className="space-y-4">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <img src="/pizza-icon.png" alt="Pizza" className="w-16 h-16 opacity-80" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-foreground">
            Private Pizza Night
          </h1>
          {!isLoading && summary && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-base font-medium text-primary">
                {formatEventDate(summary.eventDate)} — {summary.eventName}
              </p>
              {multipleEvents && (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full border border-border/60 bg-secondary/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-sm text-muted-foreground transition-all"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  change event
                </button>
              )}
            </div>
          )}
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            You are invited to a private evening of handmade Neapolitan pizza. Limited spots available, pre-order only.
          </p>
        </div>

        {/* Hero image */}
        <div className="w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border relative">
          <img src="/pizza-hero.png" alt="Handmade pizza" className="w-full h-full object-cover" />
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
                  progressPct >= 70 ? "bg-orange-400" : "bg-primary"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {summary!.totalRemaining} spot{summary!.totalRemaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
        )}

        {/* Bottom action area */}
        {isLoading ? (
          <Skeleton className="w-full h-36 rounded-xl" />
        ) : summary ? (
          <>
            {/* ── Already logged in ── */}
            {isLoggedIn && isUser ? (
              <Card className="w-full bg-card shadow-sm">
                <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4">
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-foreground">Welcome back, {session!.userName}!</p>
                    <p className="text-sm text-muted-foreground">
                      {summary.orderingOpen
                        ? "Ready to place your order for this event?"
                        : "Ordering is closed. You can still view your order."}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg gap-2"
                    onClick={() => setLocation("/order")}
                  >
                    <Pizza className="w-5 h-5" />
                    {summary.orderingOpen ? "Place My Order" : "View My Order"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* ── Login form ── */
              <Card className="w-full bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-2xl">
                    {summary.orderingOpen ? "Reserve Your Spot" : "View Your Order"}
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
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}
