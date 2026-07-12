import { useEffect, useState } from "react";
import {
  useGetMe, useListOrders, useListEvents, useUpdateOrder, useGetSummary,
  getListOrdersQueryKey, getGetSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronRight, RefreshCw, ChefHat, LogOut, LayoutDashboard, X } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch { return dateStr; }
}

const STATUS_ORDER = ["pending", "confirmed", "completed", "declined"] as const;

function statusColor(status: string) {
  if (status === "pending")   return "border-amber-400 bg-amber-50";
  if (status === "confirmed") return "border-sky-400 bg-sky-50";
  if (status === "completed") return "border-gray-300 bg-gray-50 opacity-60";
  if (status === "declined")  return "border-red-300 bg-red-50 opacity-50";
  return "border-border bg-card";
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "pending"   ? "bg-amber-100 text-amber-800" :
    status === "confirmed" ? "bg-sky-100 text-sky-800" :
    status === "completed" ? "bg-gray-100 text-gray-600" :
    status === "declined"  ? "bg-red-100 text-red-700" :
    "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

interface TicketProps {
  order: Order;
  onConfirm: () => void;
  onComplete: () => void;
  onDecline: () => void;
  isPending: boolean;
}

function Ticket({ order, onConfirm, onComplete, onDecline, isPending }: TicketProps) {
  const isCompleted = order.status === "completed";
  const isDeclined  = order.status === "declined";
  const isDone = isCompleted || isDeclined;

  return (
    <div className={`relative border-2 rounded-xl p-4 flex flex-col gap-3 shadow-sm transition-all ${statusColor(order.status)}`}
         style={{ minWidth: 220, maxWidth: 260 }}>

      {/* Ticket header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground mb-0.5">#{order.id}</p>
          <p className="font-bold text-foreground leading-tight text-base">{order.userName}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={order.status} />
          {order.paid ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
              Paid
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
              Unpaid
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-current opacity-20" />

      {/* Dish items */}
      <ul className="space-y-1 flex-1">
        {(order.items ?? []).map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <ChefHat className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-foreground">{item.quantity}×</span>
            <span className="text-foreground">{item.pizzaChoice}</span>
          </li>
        ))}
      </ul>

      {/* Notes */}
      {order.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-dashed pt-2 opacity-70">
          "{order.notes}"
        </p>
      )}

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-dashed border-border/40">
          {order.status === "pending" && (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1 bg-sky-600 hover:bg-sky-700 text-white"
              onClick={onConfirm}
              disabled={isPending}
            >
              <Check className="w-3.5 h-3.5" /> Confirm
            </Button>
          )}
          {order.status === "confirmed" && (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={onComplete}
              disabled={isPending}
            >
              <Check className="w-3.5 h-3.5" /> Ready
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDecline}
            disabled={isPending}
            title="Decline order"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      {isDone && (
        <div className="pt-1 border-t border-dashed" />
      )}
    </div>
  );
}

export function Kitchen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logout = useLogout();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: events, isLoading: eventsLoading } = useListEvents();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [mutatingIds, setMutatingIds] = useState<Set<number>>(new Set());
  const updateOrder = useUpdateOrder();

  useEffect(() => {
    if (events && events.length > 0 && selectedEventId === null) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const ordersParams = { eventId: selectedEventId ?? undefined };
  const { data: orders, isLoading: ordersLoading, dataUpdatedAt } = useListOrders(
    ordersParams,
    { query: { enabled: !!selectedEventId, refetchInterval: 15_000, queryKey: getListOrdersQueryKey(ordersParams) } }
  );

  const { data: summary } = useGetSummary(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: getGetSummaryQueryKey({ eventId: selectedEventId ?? undefined }) } }
  );

  useEffect(() => {
    if (!sessionLoading && (!session?.authenticated || session.role !== "admin")) {
      setLocation("/admin");
    }
  }, [sessionLoading, session, setLocation]);

  const mutate = (orderId: number, status: "confirmed" | "completed" | "declined") => {
    setMutatingIds((s) => new Set(s).add(orderId));
    updateOrder.mutate(
      { id: orderId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        },
        onError: () => {
          toast({ title: "Could not update order", variant: "destructive" });
        },
        onSettled: () => {
          setMutatingIds((s) => { const n = new Set(s); n.delete(orderId); return n; });
        },
      }
    );
  };

  if (sessionLoading || eventsLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#faf9f6]">
        <KitchenHeader session={null} onLogout={() => {}} onDashboard={() => {}} />
        <div className="flex gap-4 p-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-60 rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!session?.authenticated || session.role !== "admin") return null;

  const selectedEvent = events?.find((e) => e.id === selectedEventId);
  const slots: string[] = summary?.slots.map((s) => s.slot) ?? [];

  const activeOrders = (orders ?? []).filter((o) => o.status !== "declined");
  const declinedOrders = (orders ?? []).filter((o) => o.status === "declined");

  const ordersBySlot = new Map<string, Order[]>();
  for (const slot of slots) {
    const slotOrders = activeOrders
      .filter((o) => o.pickupSlot === slot)
      .sort((a, b) => STATUS_ORDER.indexOf(a.status as any) - STATUS_ORDER.indexOf(b.status as any));
    if (slotOrders.length > 0) ordersBySlot.set(slot, slotOrders);
  }
  const unslotted = activeOrders.filter((o) => !slots.includes(o.pickupSlot));
  if (unslotted.length > 0) ordersBySlot.set("Other", unslotted);

  const totalPending   = activeOrders.filter((o) => o.status === "pending").length;
  const totalConfirmed = activeOrders.filter((o) => o.status === "confirmed").length;
  const totalDone      = activeOrders.filter((o) => o.status === "completed").length;

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f6]">
      <KitchenHeader
        session={session}
        onLogout={() => { setLocation("/"); logout.mutate(undefined); }}
        onDashboard={() => setLocation("/admin/dashboard")}
      >
        {/* Event selector + stats */}
        <div className="flex items-center gap-4 flex-wrap">
          {events && events.length > 1 && (
            <Select
              value={selectedEventId ? String(selectedEventId) : ""}
              onValueChange={(v) => setSelectedEventId(Number(v))}
            >
              <SelectTrigger className="h-9 w-56 bg-white/90 border-border text-sm">
                <SelectValue placeholder="Select event…" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name} — {formatEventDate(e.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {totalPending} pending
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 text-sky-800">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
              {totalConfirmed} in progress
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {totalDone} done
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto shrink-0">
          <RefreshCw className="w-3 h-3" />
          {lastUpdated}
        </div>
      </KitchenHeader>

      {/* Ticket rail */}
      <div className="flex-1 overflow-x-auto">
        {ordersLoading ? (
          <div className="flex gap-6 p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shrink-0 space-y-3">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-52 w-56 rounded-xl" />
                <Skeleton className="h-52 w-56 rounded-xl" />
              </div>
            ))}
          </div>
        ) : ordersBySlot.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <ChefHat className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-xl font-serif font-semibold text-muted-foreground">No orders yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {selectedEvent ? `${selectedEvent.name} — ${formatEventDate(selectedEvent.date)}` : "Select an event above"}
            </p>
          </div>
        ) : (
          <div className="flex gap-0 min-h-full">
            {[...ordersBySlot.entries()].map(([slot, slotOrders], colIdx) => (
              <div
                key={slot}
                className={`flex flex-col shrink-0 min-w-[280px] max-w-[300px] border-r border-border/50 ${colIdx % 2 === 0 ? "bg-[#faf9f6]" : "bg-[#f4f2ee]"}`}
              >
                {/* Slot header */}
                <div className="sticky top-0 z-10 px-4 py-3 border-b border-border/60 bg-inherit backdrop-blur-sm flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-foreground text-lg">{slot}</p>
                    <p className="text-xs text-muted-foreground">{slotOrders.length} order{slotOrders.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {slotOrders.filter((o) => o.status === "pending").length > 0 && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {slotOrders.filter((o) => o.status === "pending").length} pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Tickets */}
                <div className="flex flex-col gap-3 p-4 pb-8 flex-1">
                  {slotOrders.map((order) => (
                    <Ticket
                      key={order.id}
                      order={order}
                      isPending={mutatingIds.has(order.id)}
                      onConfirm={() => mutate(order.id, "confirmed")}
                      onComplete={() => mutate(order.id, "completed")}
                      onDecline={() => mutate(order.id, "declined")}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Declined column — only if there are any */}
            {declinedOrders.length > 0 && (
              <div className="flex flex-col shrink-0 min-w-[280px] max-w-[300px] border-r border-border/50 bg-red-50/40">
                <div className="sticky top-0 z-10 px-4 py-3 border-b border-border/60 bg-inherit backdrop-blur-sm">
                  <p className="font-mono font-bold text-red-700 text-lg">Declined</p>
                  <p className="text-xs text-muted-foreground">{declinedOrders.length} order{declinedOrders.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex flex-col gap-3 p-4 pb-8 flex-1">
                  {declinedOrders.map((order) => (
                    <Ticket
                      key={order.id}
                      order={order}
                      isPending={mutatingIds.has(order.id)}
                      onConfirm={() => mutate(order.id, "confirmed")}
                      onComplete={() => mutate(order.id, "completed")}
                      onDecline={() => mutate(order.id, "declined")}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenHeader({
  session,
  onLogout,
  onDashboard,
  children,
}: {
  session: any;
  onLogout: () => void;
  onDashboard: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-card shadow-sm">
      <div className="px-4 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2 text-primary font-serif font-bold text-lg shrink-0">
          <ChefHat className="w-5 h-5" />
          <span>Kitchen</span>
        </div>

        <div className="flex-1 flex items-center gap-4 overflow-x-auto">
          {children}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 text-xs" onClick={onDashboard}>
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 text-xs" onClick={onLogout}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
