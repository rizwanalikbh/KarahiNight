import { useState, useEffect } from "react";
import {
  useGetMe, useGetSummary, useListOrders, useListEvents, useCreateOrder, useUpdateOrder,
  useSendOtp, useVerifyOtp,
  getListOrdersQueryKey, getGetSummaryQueryKey, getGetMeQueryKey
} from "@workspace/api-client-react";
import type { Event } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle2, AlertCircle, CalendarDays, Pencil, Plus, X, Check,
  ArrowRight, Lock, Pizza, Phone, User, ChevronLeft
} from "lucide-react";
import type { PizzaItem as APIPizzaItem } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

interface PizzaItem { pizzaChoice: string; quantity: number; }

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

interface EventPickerModalProps {
  events: Event[];
  selectedId: number | null;
  open: boolean;
  onSelect: (id: number) => void;
  onOpenChange: (open: boolean) => void;
}

function EventPickerModal({ events, selectedId, open, onSelect, onOpenChange }: EventPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <div className="bg-primary/5 border-b border-border/50 px-6 pt-7 pb-5 text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold text-foreground text-center">Which evening are you joining?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1.5">Select the pizza night you'd like to order for.</p>
        </div>
        <div className="p-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {events.map((ev) => {
            const isSelected = ev.id === selectedId;
            const segDescs = (ev.segmentDescriptions ?? []).filter(Boolean);
            const subtitle = segDescs.length > 0 ? segDescs.join(", ") : ev.description ?? null;
            return (
              <button key={ev.id} onClick={() => onSelect(ev.id)} className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`font-serif font-bold text-lg leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>{ev.name}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{formatModalDate(ev.date)}</div>
                    {subtitle && <div className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed line-clamp-2">{subtitle}</div>}
                  </div>
                  <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-primary bg-primary" : "border-border group-hover:border-primary/40"}`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 pb-5">
          <Button className="w-full h-12 text-base gap-2" disabled={selectedId === null} onClick={() => onOpenChange(false)}>
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CheckoutStep = 'form' | 'contact' | 'otp';

export function Order() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const isAuthenticated = session?.authenticated === true && session?.role === "user";

  const { data: events, isLoading: eventsLoading } = useListEvents();
  const { data: orders, isLoading: ordersLoading } = useListOrders(
    {},
    { query: { enabled: isAuthenticated, queryKey: getListOrdersQueryKey({}) } }
  );
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [eventPreview, setEventPreview] = useState(true);
  const [pickupSlot, setPickupSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [totalQty, setTotalQty] = useState(1);
  const [pizzaItems, setPizzaItems] = useState<PizzaItem[]>([{ pizzaChoice: "", quantity: 1 }]);
  const [editItems, setEditItems] = useState<PizzaItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('form');
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    if (events && events.length === 1 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const { data: summary, isLoading: summaryLoading } = useGetSummary(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: getGetSummaryQueryKey({ eventId: selectedEventId ?? undefined }) } }
  );

  const pizzaTypes: string[] = summary?.pizzaTypes ?? [];
  const pricePerPizza = summary?.price ?? 70;

  useEffect(() => {
    if (pizzaTypes.length > 0) {
      setPizzaItems((prev) =>
        Array.from({ length: totalQty }, (_, i) => ({
          pizzaChoice: prev[i]?.pizzaChoice && pizzaTypes.includes(prev[i].pizzaChoice) ? prev[i].pizzaChoice : pizzaTypes[0],
          quantity: 1,
        }))
      );
    }
  }, [pizzaTypes.join(","), totalQty]);

  const selectedSlotData = summary?.slots.find((s) => s.slot === pickupSlot);
  const slotAvailable = selectedSlotData?.available ?? 0;
  const guestLimit = summary?.maxPerGuest ?? Infinity;
  const maxAllowed = Math.min(summary?.totalRemaining ?? 0, slotAvailable, guestLimit);

  const handleSlotChange = (val: string) => { setPickupSlot(val); setTotalQty(1); };
  const updateItemChoice = (index: number, choice: string) =>
    setPizzaItems((prev) => prev.map((item, i) => (i === index ? { ...item, pizzaChoice: choice } : item)));

  const isLoading = sessionLoading || eventsLoading || (isAuthenticated && ordersLoading);

  const activeEventId = selectedEventId ?? (events && events.length > 0 ? events[0].id : undefined);
  const myOrder = isAuthenticated ? orders?.find((o) => o.userId === session?.userId && o.eventId === activeEventId) : undefined;
  const originalCount = myOrder ? (myOrder.items ?? []).length : 0;

  useEffect(() => {
    if (myOrder && !isEditing) {
      setEditItems((myOrder.items ?? []).map((i) => ({ pizzaChoice: i.pizzaChoice, quantity: i.quantity })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(myOrder?.items), isEditing]);

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

  if (!events || events.length === 0) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md text-center bg-secondary/20">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <CalendarDays className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">No Events Available</h2>
              <p className="text-muted-foreground">There are no active events right now. Check back soon!</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isAuthenticated && eventPreview) {
    const progressPct = summary ? Math.round((summary.totalBooked / summary.totalCapacity) * 100) : 0;
    const showProgress = summary ? progressPct >= 25 : false;
    return (
      <Layout>
        {events.length > 1 && (
          <EventPickerModal events={events} selectedId={selectedEventId} open={pickerOpen}
            onSelect={(id) => { setSelectedEventId(id); setPickupSlot(""); setTotalQty(1); setEventPreview(true); const s = events?.find((e) => e.id === id)?.slug; if (s) localStorage.setItem("lastEventSlug", s); }}
            onOpenChange={setPickerOpen}
          />
        )}
        <div className="flex flex-col items-center max-w-2xl mx-auto space-y-6 pt-8 text-center pb-12">
          <div className="space-y-3">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <img src="/pizza-icon.png" alt="Pizza" className="w-14 h-14 opacity-80" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">Private Pizza Night</h1>
            {summaryLoading ? <Skeleton className="h-5 w-64 mx-auto" /> : summary ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-base font-medium text-primary">{formatEventDate(summary.eventDate)} — {summary.eventName}</p>
                {events.length > 1 && (
                  <button onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full border border-border/60 bg-secondary/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-sm text-muted-foreground transition-all">
                    <CalendarDays className="w-3.5 h-3.5" /> change event
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <div className="w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border relative">
            <img src="/pizza-hero.png" alt="Handmade pizza" className="w-full h-full object-cover" />
            {summary && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-left">
                  <div className="text-white font-medium text-lg">{summary.price} DKK per pizza</div>
                  {summary.description && <div className="text-white/80 text-sm">{summary.description}</div>}
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
          {showProgress && summary && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Spots filling up</span>
                <span className="text-foreground font-semibold">{summary.totalBooked} / {summary.totalCapacity} pizzas ordered</span>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${progressPct >= 90 ? "bg-destructive" : progressPct >= 70 ? "bg-orange-400" : "bg-primary"}`} style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-right">{summary.totalRemaining} spot{summary.totalRemaining !== 1 ? "s" : ""} remaining</p>
            </div>
          )}
          <Card className="w-full bg-card shadow-sm">
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4">
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground">Welcome back, {session!.userName}!</p>
                <p className="text-sm text-muted-foreground">
                  {summaryLoading ? "Loading event details…" : summary?.orderingOpen ? (myOrder ? "You already have an order for this event." : "Ready to place your order?") : "Ordering is closed. You can still view your order."}
                </p>
              </div>
              {summaryLoading ? <Skeleton className="w-full h-14 rounded-xl" /> : (
                <Button size="lg" className="w-full h-14 text-lg gap-2" onClick={() => setEventPreview(false)}>
                  <Pizza className="w-5 h-5" />
                  {myOrder ? "View My Order" : summary?.orderingOpen ? "Place My Order" : "View My Order"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isAuthenticated && myOrder) {
    const displayItems = isEditing ? editItems : (myOrder.items ?? []);
    const slotAvailableForEdit = (summary?.slots.find((s) => s.slot === myOrder.pickupSlot)?.available ?? 0);
    const editGuestLimit = summary?.maxPerGuest ?? Infinity;
    const maxTotal = Math.min(myOrder.quantity + slotAvailableForEdit, editGuestLimit);
    const canAddMore = editItems.length < maxTotal;

    const handleSaveEdit = () => {
      if (editItems.some((i) => !i.pizzaChoice)) return;
      updateOrder.mutate({ id: myOrder.id, data: { items: editItems as APIPizzaItem[] } }, {
        onSuccess: () => {
          setIsEditing(false);
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
          toast({ title: "Order updated!" });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.response?.data?.error ?? "Could not update order.", variant: "destructive" });
        },
      });
    };

    const handleCancelEdit = () => {
      setEditItems((myOrder.items ?? []).map((i) => ({ pizzaChoice: i.pizzaChoice, quantity: i.quantity })));
      setIsEditing(false);
    };

    const updateEditChoice = (index: number, choice: string) =>
      setEditItems((prev) => prev.map((it, i) => (i === index ? { ...it, pizzaChoice: choice } : it)));
    const addEditPizza = () => { if (!canAddMore) return; setEditItems((prev) => [...prev, { pizzaChoice: pizzaTypes[0] ?? "", quantity: 1 }]); };
    const removeEditPizza = (index: number) => { if (index < originalCount) return; setEditItems((prev) => prev.filter((_, i) => i !== index)); };

    return (
      <Layout>
        {events.length > 1 && (
          <EventPickerModal events={events} selectedId={selectedEventId} open={pickerOpen}
            onSelect={(id) => { setSelectedEventId(id); setPickupSlot(""); setTotalQty(1); setEventPreview(true); }}
            onOpenChange={setPickerOpen}
          />
        )}
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md">
            <CardContent className="pt-8 pb-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-primary shrink-0" />
                  <div>
                    <h2 className="text-xl font-serif font-bold text-foreground">Order Received</h2>
                    <p className="text-sm text-muted-foreground">{myOrder.eventName}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{formatEventDate(myOrder.eventDate)} · {myOrder.pickupSlot} CET</p>
                    {events.length > 1 && (
                      <button onClick={() => setPickerOpen(true)} className="text-xs text-muted-foreground/60 hover:text-primary underline underline-offset-2 transition-colors mt-0.5">change event</button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${myOrder.status === "confirmed" ? "bg-accent/10 text-accent" : myOrder.status === "completed" ? "bg-gray-100 text-gray-800" : myOrder.status === "declined" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                    {myOrder.status}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${myOrder.paid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                    {myOrder.paid ? "Paid" : "Not paid"}
                  </span>
                  {!isEditing && myOrder.status !== "completed" && myOrder.status !== "declined" && summary?.orderingOpen && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">
                    {isEditing ? `Pizzas (${editItems.length}/${maxTotal} max)` : "Your Pizzas"}
                  </Label>
                  {isEditing && (
                    <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs gap-1" onClick={addEditPizza} disabled={!canAddMore}>
                      <Plus className="w-3 h-3" /> Add pizza
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    {editItems.map((item, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-14 shrink-0">Pizza {index + 1}{index < originalCount ? "" : " ✦"}</span>
                          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(pizzaTypes.length, 3)}, minmax(0, 1fr))` }}>
                            {pizzaTypes.map((choice) => (
                              <button key={choice} type="button" onClick={() => updateEditChoice(index, choice)} className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer truncate px-1 ${item.pizzaChoice === choice ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary/50 text-foreground"}`}>
                                {choice}
                              </button>
                            ))}
                          </div>
                          {index >= originalCount ? (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeEditPizza(index)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          ) : <div className="w-7 shrink-0" />}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-secondary/30 rounded-xl border border-border divide-y divide-border/50">
                    {Object.entries(
                      displayItems.reduce<Record<string, number>>((acc, item) => {
                        acc[item.pizzaChoice] = (acc[item.pizzaChoice] ?? 0) + item.quantity;
                        return acc;
                      }, {})
                    ).map(([choice, qty]) => (
                      <div key={choice} className="flex justify-between items-center px-4 py-3">
                        <span className="font-medium text-foreground">{choice}</span>
                        <span className="text-sm text-muted-foreground">×{qty}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-secondary/50 p-4 rounded-xl border border-border flex justify-between items-center mb-6">
                <span className="font-medium text-foreground">Total:</span>
                <span className="font-serif font-bold text-xl text-primary">{(myOrder.items ?? []).reduce((s, i) => s + i.quantity, 0) * pricePerPizza} DKK</span>
              </div>

              {myOrder.notes && (
                <div className="mb-6 p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
                  <p className="text-sm text-foreground">{myOrder.notes}</p>
                </div>
              )}

              {isEditing && (
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={handleSaveEdit} disabled={updateOrder.isPending || editItems.some((i) => !i.pizzaChoice)}>
                    {updateOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" />Save Changes</>}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={updateOrder.isPending}>Cancel</Button>
                </div>
              )}
              {!isEditing && myOrder.status !== "declined" && myOrder.status !== "completed" && (
                <p className="text-xs text-center text-muted-foreground">Need to change something? Tap the pencil icon above.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (summary && !summary.orderingOpen && !myOrder) {
    return (
      <Layout>
        {events.length > 1 && (
          <EventPickerModal events={events} selectedId={selectedEventId} open={pickerOpen}
            onSelect={(id) => { setSelectedEventId(id); setPickupSlot(""); setTotalQty(1); setEventPreview(true); const s = events?.find((e) => e.id === id)?.slug; if (s) localStorage.setItem("lastEventSlug", s); }}
            onOpenChange={setPickerOpen}
          />
        )}
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md text-center bg-secondary/20">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
                {summary.totalRemaining <= 0 ? "Fully Booked" : "Ordering Closed"}
              </h2>
              <p className="text-muted-foreground">
                {summary.totalRemaining <= 0 ? "All spots have been taken. See you there!" : "Orders are no longer being accepted for this event."}
              </p>
              {events.length > 1 && (
                <button onClick={() => setPickerOpen(true)} className="mt-4 text-sm text-muted-foreground/70 hover:text-primary underline underline-offset-2 transition-colors">change event</button>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const formReady = !!selectedEventId && !!pickupSlot && pizzaItems.every((i) => !!i.pizzaChoice) && maxAllowed > 0;

  const handleFormContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReady) return;
    if (isAuthenticated) {
      createOrder.mutate(
        { data: { eventId: selectedEventId!, items: pizzaItems as APIPizzaItem[], pickupSlot, notes: notes || undefined } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
            window.scrollTo(0, 0);
          },
          onError: (err: any) => {
            toast({ title: "Error", description: err?.response?.data?.error ?? "Could not place order.", variant: "destructive" });
          },
        }
      );
    } else {
      setCheckoutStep('contact');
      window.scrollTo(0, 0);
    }
  };

  const handleSendOtp = () => {
    if (!guestName.trim() || !guestMobile.trim()) return;
    sendOtpMutation.mutate(
      { data: { mobile: guestMobile.trim(), name: guestName.trim() } },
      {
        onSuccess: () => {
          setCheckoutStep('otp');
          setOtpCode('');
          window.scrollTo(0, 0);
        },
        onError: (err: any) => {
          toast({ title: "Failed to send code", description: err?.response?.data?.error ?? "Please check your number and try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleVerifyAndOrder = () => {
    if (otpCode.length !== 6) return;
    verifyOtpMutation.mutate(
      { data: { mobile: guestMobile.trim(), code: otpCode } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          createOrder.mutate(
            { data: { eventId: selectedEventId!, items: pizzaItems as APIPizzaItem[], pickupSlot, notes: notes || undefined } },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
                window.scrollTo(0, 0);
              },
              onError: (err: any) => {
                toast({ title: "Order failed", description: err?.response?.data?.error ?? "Could not place order.", variant: "destructive" });
              },
            }
          );
        },
        onError: (err: any) => {
          toast({ title: "Wrong code", description: err?.response?.data?.error ?? "That code didn't match. Try again.", variant: "destructive" });
          setOtpCode('');
        },
      }
    );
  };

  if (checkoutStep === 'contact') {
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setCheckoutStep('form')} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="font-serif text-2xl">Your Details</CardTitle>
              </div>
              <CardDescription>We'll send a one-time code to verify your number.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="font-semibold text-foreground">Order summary</div>
                <div className="text-muted-foreground">{events.find((e) => e.id === selectedEventId)?.name} · {pickupSlot} CET</div>
                <div className="text-muted-foreground">
                  {Object.entries(pizzaItems.reduce<Record<string, number>>((acc, i) => { acc[i.pizzaChoice] = (acc[i.pizzaChoice] ?? 0) + i.quantity; return acc; }, {})).map(([c, q]) => `${q}× ${c}`).join(", ")}
                  {pricePerPizza > 0 ? ` — ${totalQty * pricePerPizza} DKK` : ""}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guestName" className="text-sm font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" /> Your Name
                  </Label>
                  <Input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestMobile" className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Mobile Number
                  </Label>
                  <Input
                    id="guestMobile"
                    type="tel"
                    value={guestMobile}
                    onChange={(e) => setGuestMobile(e.target.value)}
                    placeholder="+45 12 34 56 78"
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">Include country code (e.g. +45 for Denmark)</p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={!guestName.trim() || !guestMobile.trim() || sendOtpMutation.isPending}
                onClick={handleSendOtp}
              >
                {sendOtpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send Code <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (checkoutStep === 'otp') {
    const isPlacing = verifyOtpMutation.isPending || createOrder.isPending;
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setCheckoutStep('contact')} className="text-muted-foreground hover:text-foreground transition-colors" disabled={isPlacing}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="font-serif text-2xl">Enter Code</CardTitle>
              </div>
              <CardDescription>
                We sent a 6-digit code to <span className="font-medium text-foreground">{guestMobile}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="otpCode" className="text-sm font-semibold">Verification Code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="h-16 text-center text-3xl tracking-[0.5em] font-mono"
                  disabled={isPlacing}
                />
              </div>

              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={otpCode.length !== 6 || isPlacing}
                onClick={handleVerifyAndOrder}
              >
                {isPlacing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Verify & Place Order</>}
              </Button>

              <div className="text-center">
                <button
                  onClick={handleSendOtp}
                  disabled={sendOtpMutation.isPending || isPlacing}
                  className="text-sm text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  {sendOtpMutation.isPending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {events.length > 1 && (
        <EventPickerModal events={events} selectedId={selectedEventId} open={pickerOpen}
          onSelect={(id) => { setSelectedEventId(id); setPickupSlot(""); setTotalQty(1); setEventPreview(true); }}
          onOpenChange={setPickerOpen}
        />
      )}
      <div className="max-w-xl mx-auto w-full">
        <Card className="border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Place Your Order</CardTitle>
            <CardDescription>
              {pricePerPizza} DKK per pizza.{summary?.description ? ` ${summary.description}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormContinue} className="space-y-8">

              {(() => {
                const ev = events.find((e) => e.id === selectedEventId) ?? events[0];
                return (
                  <div className="bg-secondary/40 rounded-xl p-4 flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{ev.name}</p>
                      <p className="text-sm text-muted-foreground">{formatEventDate(ev.date)}</p>
                    </div>
                    {events.length > 1 && (
                      <button type="button" onClick={() => setPickerOpen(true)} className="text-xs text-muted-foreground/70 hover:text-primary underline underline-offset-2 transition-colors shrink-0">
                        change event
                      </button>
                    )}
                  </div>
                );
              })()}

              {selectedEventId && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Select Pickup Slot</Label>
                  {summaryLoading ? <Skeleton className="h-12 w-full rounded-lg" /> : (
                    <Select value={pickupSlot} onValueChange={handleSlotChange}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Choose a time..." />
                      </SelectTrigger>
                      <SelectContent>
                        {summary?.slots.map((slot) => (
                          <SelectItem key={slot.slot} value={slot.slot} disabled={slot.available === 0}>
                            {slot.slot} CET {slot.available === 0 ? "(Full)" : `(${slot.available} spot${slot.available !== 1 ? "s" : ""} left)`}
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
                  {maxAllowed === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive font-medium">
                      This slot is now full — pick a different time.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground">You can order up to</span>
                      <span className="font-bold text-primary">{maxAllowed} pizza{maxAllowed !== 1 ? "s" : ""}</span>
                      <span className="text-muted-foreground">in this slot.</span>
                    </div>
                  )}
                  {maxAllowed > 0 && (
                    <Select value={String(totalQty)} onValueChange={(v) => setTotalQty(parseInt(v, 10))}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: maxAllowed }).map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {i + 1} pizza{i > 0 ? "s" : ""}{pricePerPizza > 0 ? ` — ${pricePerPizza * (i + 1)} DKK` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {pickupSlot && pizzaItems.length > 0 && pizzaTypes.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-base font-semibold">{pizzaItems.length === 1 ? "Choose Your Pizza" : "Choose Each Pizza"}</Label>
                  <div className="space-y-3">
                    {pizzaItems.map((item, index) => (
                      <div key={index} className="space-y-1.5">
                        {pizzaItems.length > 1 && <span className="text-sm text-muted-foreground">Pizza {index + 1}</span>}
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(pizzaTypes.length, 3)}, minmax(0, 1fr))` }}>
                          {pizzaTypes.map((choice) => (
                            <button key={choice} type="button" onClick={() => updateItemChoice(index, choice)} className={`p-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer truncate ${item.pizzaChoice === choice ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary/50 text-foreground"}`}>
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
                <Textarea id="notes" placeholder="Allergies, preferences, etc." value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none" />
              </div>

              {totalQty > 0 && pricePerPizza > 0 && (
                <div className="bg-secondary/50 p-4 rounded-xl border border-border flex justify-between items-center">
                  <span className="font-medium text-foreground">Total Price:</span>
                  <span className="font-serif font-bold text-xl text-primary">{totalQty * pricePerPizza} DKK</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={createOrder.isPending || !formReady}
              >
                {createOrder.isPending
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : isAuthenticated
                    ? "Place Order"
                    : <><span>Continue to Checkout</span><ArrowRight className="w-4 h-4" /></>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
