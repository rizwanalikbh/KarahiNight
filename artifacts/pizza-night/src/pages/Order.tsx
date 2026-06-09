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

interface PizzaType { name: string; price: number; discountedPrice?: number; }
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

function effectivePrice(pt: PizzaType): number {
  return pt.discountedPrice ?? pt.price;
}

function computeItemsTotal(items: PizzaItem[], pizzaTypes: PizzaType[]): number {
  return items.reduce((sum, item) => {
    const pt = pizzaTypes.find((p) => p.name === item.pizzaChoice);
    return sum + effectivePrice(pt ?? { name: "", price: 70 }) * item.quantity;
  }, 0);
}

function priceLabel(pizzaTypes: PizzaType[]): string {
  if (pizzaTypes.length === 0) return "70 DKK per pizza";
  const prices = pizzaTypes.map(effectivePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `${min} DKK per pizza`;
  return `from ${min} DKK per pizza`;
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
            return (
              <button key={ev.id} onClick={() => onSelect(ev.id)} className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`font-serif font-bold text-lg leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>{ev.name}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{formatModalDate(ev.date)}</div>
                    {ev.description && <div className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed line-clamp-2">{ev.description}</div>}
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

type CheckoutStep = 'form' | 'mobile' | 'name' | 'otp';

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
  const [isPlacingAnother, setIsPlacingAnother] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('form');
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isMobileKnown, setIsMobileKnown] = useState(false);
  const [checkingMobile, setCheckingMobile] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentText, setConsentText] = useState(
    "Your mobile number and name are stored solely to organise this event — for example to confirm your order or contact you on the day. Your data will never be used for marketing purposes. It will be permanently deleted after one year."
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [orderTermsText, setOrderTermsText] = useState(
    "By placing this order you confirm that you will collect your pizza(s) at the selected pickup slot, that payment of 70 DKK per pizza is due at pickup, and that orders can only be cancelled by messaging the organiser before the event."
  );

  useEffect(() => {
    fetch("/api/settings/consent-text")
      .then((r) => r.json())
      .then((d: { value?: string }) => { if (typeof d.value === "string") setConsentText(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/order-terms")
      .then((r) => r.json())
      .then((d: { value?: string }) => { if (typeof d.value === "string") setOrderTermsText(d.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events && events.length === 1 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const { data: summary, isLoading: summaryLoading } = useGetSummary(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: getGetSummaryQueryKey({ eventId: selectedEventId ?? undefined }) } }
  );

  const pizzaTypes: PizzaType[] = (summary?.pizzaTypes ?? []).map((pt: any) =>
    typeof pt === "string" ? { name: pt, price: 70 } : pt
  );
  const pizzaNames = pizzaTypes.map((pt) => pt.name);

  useEffect(() => {
    if (pizzaNames.length > 0) {
      setPizzaItems((prev) =>
        Array.from({ length: totalQty }, (_, i) => ({
          pizzaChoice: prev[i]?.pizzaChoice && pizzaNames.includes(prev[i].pizzaChoice)
            ? prev[i].pizzaChoice
            : pizzaNames[0],
          quantity: 1,
        }))
      );
    }
  }, [pizzaNames.join(","), totalQty]);

  const selectedSlotData = summary?.slots.find((s) => s.slot === pickupSlot);
  const slotAvailable = selectedSlotData?.available ?? 0;
  const isLoading = sessionLoading || eventsLoading || (isAuthenticated && ordersLoading);

  const activeEventId = selectedEventId ?? (events && events.length > 0 ? events[0].id : undefined);
  const myOrders = isAuthenticated ? (orders?.filter((o) => o.userId === session?.userId && o.eventId === activeEventId) ?? []) : [];
  const myOrder = myOrders[0];
  const myTotalOrdered = myOrders.reduce((sum, o) => sum + o.quantity, 0);
  const guestLimitRemaining = summary?.maxPerGuest != null ? Math.max(0, summary.maxPerGuest - myTotalOrdered) : Infinity;

  const guestLimit = isPlacingAnother ? guestLimitRemaining : (summary?.maxPerGuest ?? Infinity);
  const maxAllowed = Math.min(summary?.totalRemaining ?? 0, slotAvailable, guestLimit);

  const handleSlotChange = (val: string) => { setPickupSlot(val); setTotalQty(1); };
  const updateItemChoice = (index: number, choice: string) =>
    setPizzaItems((prev) => prev.map((item, i) => (i === index ? { ...item, pizzaChoice: choice } : item)));

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
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">No Active Events</h2>
              <p className="text-muted-foreground">Stay tuned on the WhatsApp group for the next pizza night announcement!</p>
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
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">{summary?.eventName ?? "Pizza Night"}</h1>
            {summaryLoading ? <Skeleton className="h-5 w-64 mx-auto" /> : summary ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-base font-medium text-primary">{formatEventDate(summary.eventDate)} — {summary.eventName}</p>
                {summary.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    📍{" "}
                    {summary.locationUrl
                      ? <a href={summary.locationUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary transition-colors">{summary.location}</a>
                      : summary.location}
                  </p>
                )}
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
                  <div className="text-white font-medium text-lg">{priceLabel(pizzaTypes)}</div>
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
                  {summaryLoading ? "Loading event details…" : summary?.orderingOpen
                    ? (myOrders.length > 0
                      ? `You've ordered ${myTotalOrdered} pizza${myTotalOrdered !== 1 ? "s" : ""} so far.${guestLimitRemaining < Infinity && guestLimitRemaining > 0 ? ` You can add ${guestLimitRemaining} more.` : guestLimitRemaining <= 0 ? " You've reached your limit." : ""}`
                      : "Ready to place your order?")
                    : "Ordering is closed. You can still view your order."}
                </p>
              </div>
              {summaryLoading ? <Skeleton className="w-full h-14 rounded-xl" /> : (
                <div className="w-full space-y-2">
                  <Button size="lg" className="w-full h-14 text-lg gap-2" onClick={() => setEventPreview(false)}>
                    <Pizza className="w-5 h-5" />
                    {myOrders.length > 0 ? "View My Orders" : summary?.orderingOpen ? "Place My Order" : "View Order Status"}
                  </Button>
                  {myOrders.length > 0 && summary?.orderingOpen && guestLimitRemaining > 0 && (
                    <Button size="lg" variant="outline" className="w-full h-12 text-base gap-2"
                      onClick={() => { setPizzaItems([{ pizzaChoice: pizzaNames[0] ?? "", quantity: 1 }]); setPickupSlot(""); setNotes(""); setTotalQty(1); setIsPlacingAnother(true); setEventPreview(false); }}>
                      <Plus className="w-4 h-4" />
                      Add Another Order ({guestLimitRemaining} pizza{guestLimitRemaining !== 1 ? "s" : ""} left)
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isAuthenticated && myOrders.length > 0 && !isPlacingAnother) {
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
    const addEditPizza = () => { if (!canAddMore) return; setEditItems((prev) => [...prev, { pizzaChoice: pizzaNames[0] ?? "", quantity: 1 }]); };
    const removeEditPizza = (index: number) => { if (index < originalCount) return; setEditItems((prev) => prev.filter((_, i) => i !== index)); };

    const orderTotal = computeItemsTotal(displayItems, pizzaTypes);

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
                    {summary?.location && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        📍{" "}
                        {summary.locationUrl
                          ? <a href={summary.locationUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary transition-colors">{summary.location}</a>
                          : summary.location}
                      </p>
                    )}
                    {myOrder.orderCode && (
                      <span className="inline-block mt-1.5 text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded tracking-wide">
                        #{myOrder.orderCode}
                      </span>
                    )}
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
                          <div className="flex-1 flex flex-wrap gap-1.5">
                            {pizzaTypes.map((pt) => (
                              <button key={pt.name} type="button" onClick={() => updateEditChoice(index, pt.name)}
                                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${item.pizzaChoice === pt.name ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary/50 text-foreground"}`}>
                                {pt.name}
                                <span className={`ml-1 ${item.pizzaChoice === pt.name ? "text-primary/60" : "text-muted-foreground"}`}>
                                  {pt.discountedPrice !== undefined ? <><s>{pt.price}</s> {pt.discountedPrice}</> : pt.price} kr
                                </span>
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
                    ).map(([choice, qty]) => {
                      const pt = pizzaTypes.find((p) => p.name === choice);
                      return (
                        <div key={choice} className="flex justify-between items-center px-4 py-3">
                          <span className="font-medium text-foreground">{choice}</span>
                          <span className="text-sm text-muted-foreground">×{qty}{pt ? <> · {effectivePrice(pt) * qty} DKK</> : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-secondary/50 p-4 rounded-xl border border-border flex justify-between items-center mb-6">
                <span className="font-medium text-foreground">Total:</span>
                <span className="font-serif font-bold text-xl text-primary">{orderTotal} DKK</span>
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

          {myOrders.slice(1).map((extraOrder) => (
            <Card key={extraOrder.id} className="border-card-border shadow-sm">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{extraOrder.pickupSlot} CET</p>
                    <p className="text-xs font-mono font-semibold text-primary/80">
                      {extraOrder.orderCode ? `#${extraOrder.orderCode}` : `Order #${extraOrder.id}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${extraOrder.status === "confirmed" ? "bg-accent/10 text-accent" : extraOrder.status === "completed" ? "bg-gray-100 text-gray-800" : extraOrder.status === "declined" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {extraOrder.status}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${extraOrder.paid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                      {extraOrder.paid ? "Paid" : "Not paid"}
                    </span>
                  </div>
                </div>
                <div className="bg-secondary/30 rounded-xl border border-border divide-y divide-border/50">
                  {Object.entries(
                    (extraOrder.items ?? []).reduce<Record<string, number>>((acc, item) => {
                      acc[item.pizzaChoice] = (acc[item.pizzaChoice] ?? 0) + item.quantity;
                      return acc;
                    }, {})
                  ).map(([choice, qty]) => (
                    <div key={choice} className="flex justify-between items-center px-4 py-2.5">
                      <span className="font-medium text-foreground text-sm">{choice}</span>
                      <span className="text-xs text-muted-foreground">×{qty}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {summary?.orderingOpen && guestLimitRemaining > 0 && !isEditing && (
            <Button size="lg" variant="outline" className="w-full gap-2"
              onClick={() => { setPizzaItems([{ pizzaChoice: pizzaNames[0] ?? "", quantity: 1 }]); setPickupSlot(""); setNotes(""); setTotalQty(1); setIsPlacingAnother(true); window.scrollTo(0, 0); }}>
              <Plus className="w-4 h-4" />
              Add Another Order ({guestLimitRemaining} pizza{guestLimitRemaining !== 1 ? "s" : ""} left)
            </Button>
          )}
          {summary?.maxPerGuest != null && guestLimitRemaining <= 0 && !isEditing && (
            <p className="text-xs text-center text-muted-foreground py-2">
              You've ordered the maximum of {summary.maxPerGuest} pizza{summary.maxPerGuest !== 1 ? "s" : ""} for this event.
            </p>
          )}
        </div>
      </Layout>
    );
  }

  if (summary && !summary.orderingOpen && myOrders.length === 0) {
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

  const currentTotal = computeItemsTotal(pizzaItems, pizzaTypes);
  const formReady = !!selectedEventId && !!pickupSlot && pizzaItems.every((i) => !!i.pizzaChoice) && maxAllowed > 0 && termsAccepted;

  const handleFormContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReady) return;
    if (isAuthenticated) {
      createOrder.mutate(
        { data: { eventId: selectedEventId!, items: pizzaItems as APIPizzaItem[], pickupSlot, notes: notes || undefined, termsText: orderTermsText } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
            setIsPlacingAnother(false);
            window.scrollTo(0, 0);
          },
          onError: (err: any) => {
            toast({ title: "Error", description: err?.response?.data?.error ?? "Could not place order.", variant: "destructive" });
          },
        }
      );
    } else {
      setCheckoutStep('mobile');
      window.scrollTo(0, 0);
    }
  };

  const handleCheckMobile = async () => {
    if (guestMobile.trim().length !== 8) return;
    setCheckingMobile(true);
    try {
      const mobile = encodeURIComponent(`+45${guestMobile.trim()}`);
      const resp = await fetch(`/api/users/check-mobile?mobile=${mobile}`);
      const data = await resp.json();
      const exists = !!data.exists;
      setIsMobileKnown(exists);
      if (exists) {
        sendOtpMutation.mutate(
          { data: { mobile: guestMobile.trim() } },
          {
            onSuccess: () => { setCheckoutStep('otp'); setOtpCode('123456'); window.scrollTo(0, 0); },
            onError: (err: any) => { toast({ title: "Failed to send code", description: err?.response?.data?.error ?? "Please try again.", variant: "destructive" }); },
          }
        );
      } else {
        setCheckoutStep('name');
        window.scrollTo(0, 0);
      }
    } catch {
      toast({ title: "Error", description: "Could not verify mobile number. Please try again.", variant: "destructive" });
    } finally {
      setCheckingMobile(false);
    }
  };


  const handleSendOtp = () => {
    if (!isMobileKnown && !guestName.trim()) return;
    if (!isMobileKnown && !consentAccepted) return;
    const payload = isMobileKnown
      ? { mobile: guestMobile.trim() }
      : { mobile: guestMobile.trim(), name: guestName.trim(), consentText };
    sendOtpMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          setCheckoutStep('otp');
          setOtpCode('123456');
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
            { data: { eventId: selectedEventId!, items: pizzaItems as APIPizzaItem[], pickupSlot, notes: notes || undefined, termsText: orderTermsText } },
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

  if (checkoutStep === 'mobile') {
    const isChecking = checkingMobile || sendOtpMutation.isPending;
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setCheckoutStep('form')} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="font-serif text-2xl">Your Mobile Number</CardTitle>
              </div>
              <CardDescription>We'll send a one-time code to confirm your order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="font-semibold text-foreground">Order summary</div>
                <div className="text-muted-foreground">{events.find((e) => e.id === selectedEventId)?.name} · {pickupSlot} CET</div>
                <div className="text-muted-foreground">
                  {Object.entries(pizzaItems.reduce<Record<string, number>>((acc, i) => { acc[i.pizzaChoice] = (acc[i.pizzaChoice] ?? 0) + i.quantity; return acc; }, {})).map(([c, q]) => `${q}× ${c}`).join(", ")}
                  {currentTotal > 0 ? ` — ${currentTotal} DKK` : ""}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestMobile" className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Mobile Number
                </Label>
                <div className="flex items-center gap-2">
                  <span className="h-12 px-3 flex items-center rounded-md border border-input bg-muted text-sm font-medium text-muted-foreground shrink-0">+45</span>
                  <Input
                    id="guestMobile"
                    type="tel"
                    inputMode="numeric"
                    value={guestMobile}
                    onChange={(e) => setGuestMobile(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={(e) => { if (e.key === "Enter" && guestMobile.length === 8) handleCheckMobile(); }}
                    placeholder="31 70 53 42"
                    className="h-12"
                    autoFocus
                    maxLength={8}
                  />
                </div>
                <p className="text-xs text-muted-foreground">8-digit Danish mobile number</p>
              </div>
              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={guestMobile.length !== 8 || isChecking}
                onClick={handleCheckMobile}
              >
                {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (checkoutStep === 'name') {
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setCheckoutStep('mobile')} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="font-serif text-2xl">Your Name</CardTitle>
              </div>
              <CardDescription>
                First time here — just tell us your name and we'll send a code to{" "}
                <span className="font-medium text-foreground">+45 {guestMobile}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="guestName" className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" /> Your Name
                </Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && guestName.trim() && consentAccepted) handleSendOtp(); }}
                  placeholder="Full name"
                  className="h-12"
                  autoFocus
                />
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data & Privacy</p>
                <p className="text-sm text-foreground leading-relaxed">{consentText}</p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                  />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                    I understand and accept
                  </span>
                </label>
              </div>

              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={!guestName.trim() || !consentAccepted || sendOtpMutation.isPending}
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
                <button onClick={() => setCheckoutStep(isMobileKnown ? 'mobile' : 'name')} className="text-muted-foreground hover:text-foreground transition-colors" disabled={isPlacing}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="font-serif text-2xl">Enter Code</CardTitle>
              </div>
              <CardDescription>
                We sent a 6-digit code to <span className="font-medium text-foreground">{guestMobile}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <span>🔧</span>
                <span>Test mode — code is <strong className="font-mono tracking-widest">123456</strong></span>
              </div>
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
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Terms &amp; Conditions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line pt-1">{orderTermsText}</p>
        </DialogContent>
      </Dialog>

      {events.length > 1 && (
        <EventPickerModal events={events} selectedId={selectedEventId} open={pickerOpen}
          onSelect={(id) => { setSelectedEventId(id); setPickupSlot(""); setTotalQty(1); setEventPreview(true); }}
          onOpenChange={setPickerOpen}
        />
      )}
      {isPlacingAnother && (
        <div className="max-w-xl mx-auto w-full mb-2">
          <button type="button" onClick={() => { setIsPlacingAnother(false); window.scrollTo(0, 0); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
            <ChevronLeft className="w-4 h-4" /> Back to my orders
          </button>
        </div>
      )}
      <div className="max-w-xl mx-auto w-full">
        <Card className="border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">{isPlacingAnother ? "Add Another Order" : "Place Your Order"}</CardTitle>
            <CardDescription>
              {priceLabel(pizzaTypes)}{summary?.description ? ` — ${summary.description}` : ""}
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
                            {i + 1} pizza{i > 0 ? "s" : ""}
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
                        <div className="flex flex-wrap gap-2">
                          {pizzaTypes.map((pt) => (
                            <button key={pt.name} type="button" onClick={() => updateItemChoice(index, pt.name)}
                              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${item.pizzaChoice === pt.name ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary/50 text-foreground"}`}>
                              <span className="block">{pt.name}</span>
                              <span className={`block text-xs mt-0.5 ${item.pizzaChoice === pt.name ? "text-primary/60" : "text-muted-foreground"}`}>
                                {pt.discountedPrice !== undefined ? <><s>{pt.price}</s> {pt.discountedPrice}</> : pt.price} DKK
                              </span>
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

              {(() => {
                const PREVIEW_LIMIT = 220;
                const isLong = orderTermsText.length > PREVIEW_LIMIT;
                const preview = isLong ? orderTermsText.slice(0, PREVIEW_LIMIT).trimEnd() : orderTermsText;
                return (
                  <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
                    <p className="text-sm font-semibold text-foreground">Order Terms &amp; Conditions</p>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {preview}{isLong && "…"}
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setTermsOpen(true)}
                          className="ml-1 text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                        >
                          Read full terms
                        </button>
                      )}
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-sm text-foreground leading-snug group-hover:text-primary transition-colors">
                        I have read and accept the order terms &amp; conditions
                      </span>
                    </label>
                  </div>
                );
              })()}

              {currentTotal > 0 && pickupSlot && pizzaItems.every((i) => !!i.pizzaChoice) && (
                <div className="bg-secondary/50 p-4 rounded-xl border border-border flex justify-between items-center">
                  <span className="font-medium text-foreground">Total Price:</span>
                  <span className="font-serif font-bold text-xl text-primary">{currentTotal} DKK</span>
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
