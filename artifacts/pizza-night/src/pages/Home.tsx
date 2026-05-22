import { useState } from "react";
import { useGetSummary, useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
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

export function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useGetSummary({});
  const login = useLogin();

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

        <div className="w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border relative">
          <img
            src="/pizza-hero.png"
            alt="Handmade pizza"
            className="w-full h-full object-cover"
          />
          {!isLoading && summary && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-left">
              <div className="text-white font-medium text-lg">{summary.price} DKK per pizza</div>
              {summary.description && (
                <div className="text-white/80 text-sm">{summary.description}</div>
              )}
            </div>
          )}
        </div>

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
