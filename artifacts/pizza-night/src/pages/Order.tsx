import { useState, useEffect } from "react";
import {
  useGetMe, useGetSummary, useListOrders, useCreateOrder, useListEvents,
  getListOrdersQueryKey, getGetSummaryQueryKey
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, CalendarDays } from "lucide-react";
import type { PizzaItem as APIPizzaItem } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

interface PizzaItem {
  pizzaChoice: string;
  quantity: number;
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function Order() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: events, isLoading: eventsLoading } = useListEvents();
  const { data: orders, isLoading: ordersLoading } = useListOrders({});
  const createOrder = useCreateOrder();

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [pickupSlot, setPickupSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [totalQty, setTotalQty] = useState(1);
  const [pizzaItems, setPizzaItems] = useState<PizzaItem[]>([{ pizzaChoice: "", quantity: 1 }]);

  useEffect(() => {
    if (events && events.length === 1 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const { data: summary, isLoading: summaryLoading } = useGetSummary(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: getGetSummaryQueryKey() } }
  );

  const pizzaTypes: string[] = summary?.pizzaTypes ?? [];
  const pricePerPizza = summary?.price ?? 70;

  // Reset pizza items when pizza types load or event changes
  useEffect(() => {
    if (pizzaTypes.length > 0) {
      setPizzaItems((prev) =>
        Array.from({ length: totalQty }, (_, i) => ({
          pizzaChoice: prev[i]?.pizzaChoice && pizzaTypes.includes(prev[i].pizzaChoice)
            ? prev[i].pizzaChoice
            : pizzaTypes[0],
          quantity: 1,
        }))
      );
    }
  }, [pizzaTypes.join(","), totalQty]);

  const selectedSlotData = summary?.slots.find((s) => s.slot === pickupSlot);
  const slotAvailable = selectedSlotData?.available ?? 0;
  const maxAllowed = Math.min(summary?.totalRemaining ?? 0, slotAvailable, 3);

  const handleSlotChange = (val: string) => {
    setPickupSlot(val);
    setTotalQty(1);
  };

  const updateItemChoice = (index: number, choice: string) => {
    setPizzaItems((prev) => prev.map((item, i) => (i === index ? { ...item, pizzaChoice: choice } : item)));
  };

  const isLoading = sessionLoading || eventsLoading || ordersLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full max-w-xl mx-auto rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!session?.authenticated || session.role !== "user") {
    setLocation("/");
    return null;
  }

  if (!events || events.length === 0) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md text-center bg-secondary/20">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <CalendarDays className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">No Events Yet</h2>
              <p className="text-muted-foreground">You have not been added to any events. Check back later.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const activeEventId = selectedEventId ?? events[0]?.id;
  const myOrder = orders?.find((o) => o.userId === session.userId && o.eventId === activeEventId);

  if (myOrder) {
    const orderItems = myOrder.items ?? [];
    const total = orderItems.reduce((s, i) => s + i.quantity, 0);
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md text-center">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <CheckCircle2 className="w-16 h-16 text-primary mb-4" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Order Received!</h2>
              <p className="text-muted-foreground mb-8">
                Thanks! Your order request has been received. I will confirm it by private message.
              </p>
              <div className="w-full bg-secondary/30 rounded-xl p-6 text-left space-y-4 border border-border">
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium text-foreground">{myOrder.eventName}</span>
                </div>
                <div className="border-b pb-4">
                  <span className="text-muted-foreground block mb-2">Pizzas</span>
                  <div className="space-y-1">
                    {orderItems.length > 0 ? (
                      orderItems.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="font-medium text-foreground">{item.pizzaChoice}</span>
                          <span className="text-muted-foreground">{item.quantity}x</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Pickup Slot</span>
                  <span className="font-medium text-foreground">{myOrder.pickupSlot}</span>
                </div>
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-foreground">{total * pricePerPizza} DKK</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                    ${myOrder.status === "confirmed" ? "bg-accent/10 text-accent" :
                      myOrder.status === "completed" ? "bg-gray-100 text-gray-800" :
                      myOrder.status === "declined" ? "bg-destructive/10 text-destructive" :
                      "bg-primary/10 text-primary"}`}
                  >
                    {myOrder.status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (summary && summary.totalRemaining <= 0) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md text-center bg-secondary/20">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Fully Booked</h2>
              <p className="text-muted-foreground">Sorry, the event is fully booked!</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !pickupSlot) {
      toast({ title: "Incomplete", description: "Please select a slot.", variant: "destructive" });
      return;
    }
    createOrder.mutate(
      { data: { eventId: selectedEventId, items: pizzaItems as APIPizzaItem[], pickupSlot, notes: notes || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
          window.scrollTo(0, 0);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Could not place order. Maybe slots filled up?";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto w-full">
        <Card className="border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Place Your Order</CardTitle>
            <CardDescription>
              {pricePerPizza} DKK per pizza.{summary?.description ? ` ${summary.description}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">

              {events.length > 1 ? (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Select Event</Label>
                  <Select
                    value={selectedEventId ? String(selectedEventId) : ""}
                    onValueChange={(v) => {
                      setSelectedEventId(parseInt(v, 10));
                      setPickupSlot("");
                      setTotalQty(1);
                    }}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Choose an event..." />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={String(event.id)}>
                          {event.name} — {formatEventDate(event.date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="bg-secondary/40 rounded-xl p-4 flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">{events[0].name}</p>
                    <p className="text-sm text-muted-foreground">{formatEventDate(events[0].date)}</p>
                  </div>
                </div>
              )}

              {selectedEventId && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Select Pickup Slot</Label>
                  {summaryLoading ? (
                    <Skeleton className="h-12 w-full rounded-lg" />
                  ) : (
                    <Select value={pickupSlot} onValueChange={handleSlotChange}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Choose a time..." />
                      </SelectTrigger>
                      <SelectContent>
                        {summary?.slots.map((slot) => (
                          <SelectItem key={slot.slot} value={slot.slot} disabled={slot.available === 0}>
                            {slot.slot} {slot.available === 0 ? "(Full)" : `(${slot.available} spot${slot.available !== 1 ? "s" : ""} left)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {pickupSlot && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-base font-semibold">How Many Pizzas?</Label>
                  <Select value={String(totalQty)} onValueChange={(v) => setTotalQty(parseInt(v, 10))}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxAllowed }).map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {i + 1} pizza{i > 0 ? "s" : ""} — {pricePerPizza * (i + 1)} DKK
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {maxAllowed < 3 && (
                    <p className="text-xs text-muted-foreground">Quantity limited by remaining slot capacity.</p>
                  )}
                </div>
              )}

              {pickupSlot && pizzaItems.length > 0 && pizzaTypes.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-base font-semibold">
                    {pizzaItems.length === 1 ? "Choose Your Pizza" : "Choose Each Pizza"}
                  </Label>
                  <div className="space-y-3">
                    {pizzaItems.map((item, index) => (
                      <div key={index} className="space-y-1.5">
                        {pizzaItems.length > 1 && (
                          <span className="text-sm text-muted-foreground">Pizza {index + 1}</span>
                        )}
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(pizzaTypes.length, 3)}, minmax(0, 1fr))` }}>
                          {pizzaTypes.map((choice) => (
                            <button
                              key={choice}
                              type="button"
                              onClick={() => updateItemChoice(index, choice)}
                              className={`p-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer truncate
                                ${item.pizzaChoice === choice
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border hover:bg-secondary/50 text-foreground"
                                }`}
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-base font-semibold">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Allergies, preferences, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="bg-secondary/50 p-4 rounded-xl border border-border flex justify-between items-center">
                <span className="font-medium text-foreground">Total Price:</span>
                <span className="font-serif font-bold text-xl text-primary">{totalQty * pricePerPizza} DKK</span>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg"
                disabled={createOrder.isPending || !pickupSlot || !selectedEventId || pizzaItems.some(i => !i.pizzaChoice)}
              >
                {createOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Place Order"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
