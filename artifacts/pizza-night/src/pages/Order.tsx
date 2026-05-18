import { useState, useEffect } from "react";
import { useGetMe, useGetSummary, useListOrders, useCreateOrder, getListOrdersQueryKey, getGetSummaryQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

type PizzaChoice = "Margherita" | "Pepperoni" | "Special";
const PIZZA_CHOICES: PizzaChoice[] = ["Margherita", "Pepperoni", "Special"];

interface PizzaItem {
  pizzaChoice: PizzaChoice;
  quantity: number;
}

export function Order() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: summary, isLoading: summaryLoading } = useGetSummary();
  const { data: orders, isLoading: ordersLoading } = useListOrders();
  const createOrder = useCreateOrder();

  const [pickupSlot, setPickupSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [totalQty, setTotalQty] = useState(1);
  const [pizzaItems, setPizzaItems] = useState<PizzaItem[]>([{ pizzaChoice: "Margherita", quantity: 1 }]);

  const selectedSlotData = summary?.slots.find((s) => s.slot === pickupSlot);
  const slotAvailable = selectedSlotData?.available ?? 0;
  const maxAllowed = Math.min(summary?.totalRemaining ?? 0, slotAvailable, 3);

  // When total quantity changes, rebuild the per-pizza items list
  useEffect(() => {
    setPizzaItems((prev) => {
      if (totalQty === 1) {
        return [{ pizzaChoice: prev[0]?.pizzaChoice ?? "Margherita", quantity: 1 }];
      }
      // Build one row per pizza
      const expanded: PizzaItem[] = [];
      for (let i = 0; i < totalQty; i++) {
        expanded.push({ pizzaChoice: prev[i]?.pizzaChoice ?? "Margherita", quantity: 1 });
      }
      return expanded;
    });
  }, [totalQty]);

  // Reset quantity when slot changes
  const handleSlotChange = (val: string) => {
    setPickupSlot(val);
    setTotalQty(1);
  };

  const updateItemChoice = (index: number, choice: PizzaChoice) => {
    setPizzaItems((prev) => prev.map((item, i) => (i === index ? { ...item, pizzaChoice: choice } : item)));
  };

  if (sessionLoading || summaryLoading || ordersLoading) {
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
    setLocation("/login");
    return null;
  }

  const myOrder = orders?.find((o) => o.userId === session.userId);

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
                <div className="border-b pb-4">
                  <span className="text-muted-foreground block mb-2">Pizzas</span>
                  {orderItems.length > 0 ? (
                    <div className="space-y-1">
                      {orderItems.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="font-medium text-foreground">{item.pizzaChoice}</span>
                          <span className="text-muted-foreground">{item.quantity}x</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-medium text-foreground">{(myOrder as any).pizzaChoice}</span>
                  )}
                </div>
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Pickup Slot</span>
                  <span className="font-medium text-foreground">{myOrder.pickupSlot}</span>
                </div>
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-foreground">{(orderItems.length > 0 ? total : myOrder.quantity) * 70} DKK</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
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
              <p className="text-muted-foreground">
                Sorry, the event is fully booked! All pizza slots have been claimed.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupSlot) {
      toast({ title: "Incomplete", description: "Please select a pickup slot.", variant: "destructive" });
      return;
    }

    createOrder.mutate(
      {
        data: {
          items: pizzaItems,
          pickupSlot,
          notes: notes || undefined,
        },
      },
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
              70 DKK per pizza. Collected money will go toward funding a future BBQ gathering.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* Pickup slot */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Select Pickup Slot</Label>
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
              </div>

              {/* How many pizzas */}
              {pickupSlot && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-base font-semibold">How Many Pizzas?</Label>
                  <Select
                    value={String(totalQty)}
                    onValueChange={(v) => setTotalQty(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxAllowed }).map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {i + 1} pizza{i > 0 ? "s" : ""} — {70 * (i + 1)} DKK
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {maxAllowed < 3 && (
                    <p className="text-xs text-muted-foreground">
                      Quantity limited by remaining slot capacity.
                    </p>
                  )}
                </div>
              )}

              {/* Per-pizza type selector */}
              {pickupSlot && pizzaItems.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-base font-semibold">
                    {pizzaItems.length === 1 ? "Choose Your Pizza" : "Choose Each Pizza"}
                  </Label>
                  <div className="space-y-3">
                    {pizzaItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        {pizzaItems.length > 1 && (
                          <span className="text-sm text-muted-foreground w-16 shrink-0">
                            Pizza {index + 1}
                          </span>
                        )}
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          {PIZZA_CHOICES.map((choice) => (
                            <button
                              key={choice}
                              type="button"
                              onClick={() => updateItemChoice(index, choice)}
                              className={`p-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer
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

              {/* Notes */}
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

              {/* Price summary */}
              <div className="bg-secondary/50 p-4 rounded-xl border border-border flex justify-between items-center">
                <span className="font-medium text-foreground">Total Price:</span>
                <span className="font-serif font-bold text-xl text-primary">{totalQty * 70} DKK</span>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg"
                disabled={createOrder.isPending || !pickupSlot}
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
