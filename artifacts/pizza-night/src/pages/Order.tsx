import { useState } from "react";
import { useGetMe, useGetSummary, useListOrders, useCreateOrder, getListOrdersQueryKey, getGetSummaryQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { OrderInputPizzaChoice } from "@workspace/api-client-react/src/generated/api.schemas";

export function Order() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: summary, isLoading: summaryLoading } = useGetSummary();
  const { data: orders, isLoading: ordersLoading } = useListOrders();
  const createOrder = useCreateOrder();

  const [pizzaChoice, setPizzaChoice] = useState<OrderInputPizzaChoice>("Margherita");
  const [quantity, setQuantity] = useState("1");
  const [pickupSlot, setPickupSlot] = useState("");
  const [notes, setNotes] = useState("");

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

  const myOrder = orders?.find(o => o.userId === session.userId);

  if (myOrder) {
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
                  <span className="text-muted-foreground">Pizza</span>
                  <span className="font-medium text-foreground">{myOrder.quantity}x {myOrder.pizzaChoice}</span>
                </div>
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Pickup Slot</span>
                  <span className="font-medium text-foreground">{myOrder.pickupSlot}</span>
                </div>
                <div className="flex justify-between border-b pb-4">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-foreground">{myOrder.quantity * 70} DKK</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                    ${myOrder.status === 'confirmed' ? 'bg-accent/10 text-accent' : 
                      myOrder.status === 'completed' ? 'bg-gray-100 text-gray-800' : 
                      myOrder.status === 'declined' ? 'bg-destructive/10 text-destructive' :
                      'bg-primary/10 text-primary'}`}>
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

  const selectedSlotData = summary?.slots.find(s => s.slot === pickupSlot);
  const slotAvailable = selectedSlotData?.available || 0;
  const maxAllowedQuantity = Math.min(
    summary?.totalRemaining || 0,
    slotAvailable,
    3 // hard limit per order just in case
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupSlot || !pizzaChoice) {
      toast({ title: "Incomplete", description: "Please select a pizza and a pickup slot.", variant: "destructive" });
      return;
    }

    createOrder.mutate({
      data: {
        pizzaChoice,
        quantity: parseInt(quantity, 10),
        pickupSlot,
        notes: notes || undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        window.scrollTo(0, 0);
      },
      onError: () => {
        toast({ title: "Error", description: "Could not place order. Maybe slots filled up?", variant: "destructive" });
      }
    });
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
              
              <div className="space-y-4">
                <Label className="text-base font-semibold">Choose Your Pizza</Label>
                <RadioGroup value={pizzaChoice} onValueChange={(v) => setPizzaChoice(v as OrderInputPizzaChoice)} className="grid gap-3">
                  <Label
                    htmlFor="margherita"
                    className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors ${pizzaChoice === 'Margherita' ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="Margherita" id="margherita" />
                      <span className="font-medium text-lg">Margherita</span>
                    </div>
                  </Label>
                  <Label
                    htmlFor="pepperoni"
                    className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors ${pizzaChoice === 'Pepperoni' ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="Pepperoni" id="pepperoni" />
                      <span className="font-medium text-lg">Pepperoni</span>
                    </div>
                  </Label>
                  <Label
                    htmlFor="special"
                    className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors ${pizzaChoice === 'Special' ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="Special" id="special" />
                      <span className="font-medium text-lg">Special</span>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Select Pickup Slot</Label>
                <Select value={pickupSlot} onValueChange={(val) => {
                  setPickupSlot(val);
                  setQuantity("1"); // Reset quantity when slot changes
                }}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose a time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {summary?.slots.map((slot) => (
                      <SelectItem 
                        key={slot.slot} 
                        value={slot.slot}
                        disabled={slot.available === 0}
                      >
                        {slot.slot} {slot.available === 0 ? "(Full)" : `(${slot.available} spots left)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pickupSlot && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                  <Label className="text-base font-semibold">Quantity</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="How many?" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxAllowedQuantity }).map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} pizza{i > 0 ? 's' : ''} ({70 * (i + 1)} DKK)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {maxAllowedQuantity < 3 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantity is limited by remaining capacity for this slot.
                    </p>
                  )}
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
                <span className="font-serif font-bold text-xl text-primary">
                  {parseInt(quantity || "0", 10) * 70} DKK
                </span>
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-14 text-lg" 
                disabled={createOrder.isPending || !pickupSlot || !pizzaChoice}
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