import { useState } from "react";
import {
  useGetMe, useGetSummary, useListOrders, useUpdateOrder, useDeleteOrder,
  useListUsers, useUpdateUser, useDeleteUser, useRegenerateCode, useCreateUser,
  useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  useListEventUsers, useAddUserToEvent, useRemoveUserFromEvent,
  getListOrdersQueryKey, getListUsersQueryKey, getGetSummaryQueryKey,
  getListEventsQueryKey, getListEventUsersQueryKey,
} from "@workspace/api-client-react";
import type { Event } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Trash2, RefreshCw, UserPlus, Plus, CalendarDays,
  Users, ChevronDown, ChevronUp, Pencil, X, Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderUpdateStatus } from "@workspace/api-client-react";

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PIZZA_TYPES = ["Margherita","Pepperoni","Special"];

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

// ── Tag editor for slots / pizza types ──────────────────────────────────────
function TagEditor({
  label, tags, onChange, placeholder,
}: { label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1 text-xs">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-destructive ml-1">×</button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" size="sm" className="h-8 px-3" onClick={add} disabled={!input.trim()}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Inline event editor ──────────────────────────────────────────────────────
function EventEditPanel({ event, onClose }: { event: Event; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateEvent = useUpdateEvent();

  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date);
  const [totalCap, setTotalCap] = useState(String(event.totalCapacity));
  const [slotCap, setSlotCap] = useState(String(event.slotCapacity));
  const [price, setPrice] = useState(String(event.price));
  const [description, setDescription] = useState(event.description ?? "");
  const [slots, setSlots] = useState<string[]>(event.slots ?? DEFAULT_SLOTS);
  const [pizzaTypes, setPizzaTypes] = useState<string[]>(event.pizzaTypes ?? DEFAULT_PIZZA_TYPES);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateEvent.mutate(
      {
        id: event.id,
        data: {
          name, date,
          totalCapacity: parseInt(totalCap, 10) || 10,
          slotCapacity: parseInt(slotCap, 10) || 3,
          price: parseInt(price, 10) || 70,
          description: description || undefined,
          slots,
          pizzaTypes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Event updated" });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
          onClose();
        },
        onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={handleSave} className="border rounded-xl p-5 bg-secondary/10 space-y-4 mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Event Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Total Capacity</Label>
          <Input type="number" min={1} value={totalCap} onChange={(e) => setTotalCap(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Pizzas per Slot</Label>
          <Input type="number" min={1} value={slotCap} onChange={(e) => setSlotCap(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Price per Pizza (DKK)</Label>
          <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="resize-none"
          rows={2}
          placeholder="Shown on home &amp; order pages..."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TagEditor
          label="Pickup Slots"
          tags={slots}
          onChange={setSlots}
          placeholder="e.g. 17:00-17:30"
        />
        <TagEditor
          label="Pizza Types"
          tags={pizzaTypes}
          onChange={setPizzaTypes}
          placeholder="e.g. Quattro Stagioni"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={updateEvent.isPending}>
          {updateEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" />Save Changes</>}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4 mr-1.5" />Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Guest manager per event ──────────────────────────────────────────────────
function EventUserManager({ eventId, allUsers }: { eventId: number; allUsers: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: eventUsers } = useListEventUsers(eventId, {
    query: { enabled: expanded, queryKey: getListEventUsersQueryKey(eventId) },
  });
  const addUser = useAddUserToEvent();
  const removeUser = useRemoveUserFromEvent();

  const eventUserIds = new Set((eventUsers ?? []).map((u) => u.id));
  const usersNotInEvent = allUsers.filter((u) => !eventUserIds.has(u.id));

  const handleAdd = () => {
    if (!addUserId) return;
    addUser.mutate({ id: eventId, data: { userId: parseInt(addUserId, 10) } }, {
      onSuccess: () => {
        toast({ title: "Guest added" });
        setAddUserId("");
        queryClient.invalidateQueries({ queryKey: getListEventUsersQueryKey(eventId) });
      },
    });
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Users className="w-4 h-4" />
        {expanded ? "Hide" : "Manage"} guests
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 border rounded-xl p-4 space-y-3 bg-secondary/20">
          {(eventUsers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No guests assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(eventUsers ?? []).map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1.5 pr-1">
                  {u.name}
                  <button
                    type="button"
                    onClick={() => removeUser.mutate({ id: eventId, userId: u.id }, {
                      onSuccess: () => {
                        toast({ title: "Guest removed" });
                        queryClient.invalidateQueries({ queryKey: getListEventUsersQueryKey(eventId) });
                      },
                    })}
                    className="hover:text-destructive transition-colors ml-1"
                  >×</button>
                </Badge>
              ))}
            </div>
          )}
          {usersNotInEvent.length > 0 && (
            <div className="flex gap-2 items-center">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Add a guest..." /></SelectTrigger>
                <SelectContent>
                  {usersNotInEvent.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8" onClick={handleAdd} disabled={!addUserId || addUser.isPending}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: events } = useListEvents();
  const { data: orders } = useListOrders({});
  const { data: users } = useListUsers();

  const [summaryEventId, setSummaryEventId] = useState<number | undefined>(undefined);
  const activeEventId = summaryEventId ?? events?.[0]?.id;
  const { data: summary } = useGetSummary(
    { eventId: activeEventId },
    { query: { enabled: !!activeEventId, queryKey: getGetSummaryQueryKey() } }
  );

  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const regenerateCode = useRegenerateCode();
  const createUser = useCreateUser();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();

  // Event creation form state
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("2026-05-24");
  const [newEventCapacity, setNewEventCapacity] = useState("10");
  const [newEventSlot, setNewEventSlot] = useState("3");
  const [newEventPrice, setNewEventPrice] = useState("70");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventSlots, setNewEventSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [newEventPizzaTypes, setNewEventPizzaTypes] = useState<string[]>(DEFAULT_PIZZA_TYPES);

  // Event editing state
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [filterEventId, setFilterEventId] = useState<string>("all");

  if (sessionLoading) return <Layout><div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div></Layout>;
  if (!session?.authenticated || session.role !== "admin") {
    setLocation("/admin");
    return null;
  }

  const handleStatusChange = (id: number, status: OrderUpdateStatus) => {
    updateOrder.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const handleDeleteOrder = (id: number) => {
    if (!confirm("Delete this order?")) return;
    deleteOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order deleted" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  const handleToggleUser = (id: number, active: boolean) => {
    updateUser.mutate({ id, data: { active } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    });
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    createUser.mutate({ data: { name: newUserName } }, {
      onSuccess: () => {
        toast({ title: "Guest added" });
        setNewUserName("");
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;
    createEvent.mutate(
      {
        data: {
          name: newEventName,
          date: newEventDate,
          totalCapacity: parseInt(newEventCapacity, 10) || 10,
          slotCapacity: parseInt(newEventSlot, 10) || 3,
          price: parseInt(newEventPrice, 10) || 70,
          description: newEventDescription || undefined,
          slots: newEventSlots,
          pizzaTypes: newEventPizzaTypes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Event created" });
          setNewEventName("");
          setNewEventDescription("");
          setNewEventSlots(DEFAULT_SLOTS);
          setNewEventPizzaTypes(DEFAULT_PIZZA_TYPES);
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        },
      }
    );
  };

  const handleToggleEvent = (id: number, active: boolean) => {
    updateEvent.mutate({ id, data: { active } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  const handleDeleteEvent = (id: number) => {
    if (!confirm("Delete this event and all its orders?")) return;
    deleteEvent.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Event deleted" });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const filteredOrders = filterEventId === "all"
    ? (orders ?? [])
    : (orders ?? []).filter((o) => o.eventId === parseInt(filterEventId, 10));

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Kitchen Dashboard</h1>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="users">Guests</TabsTrigger>
          </TabsList>

          {/* SUMMARY */}
          <TabsContent value="summary" className="space-y-4 pt-4">
            {events && events.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-sm font-medium">Event</Label>
                <Select
                  value={summaryEventId ? String(summaryEventId) : String(events[0]?.id ?? "")}
                  onValueChange={(v) => setSummaryEventId(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-64 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Booked</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-primary">{summary?.totalBooked || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">out of {summary?.totalCapacity ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Est)</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif">{(summary?.totalBooked || 0) * (summary?.price ?? 70)} DKK</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-accent">{summary?.totalRemaining ?? "—"}</div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Slot Breakdown{summary ? ` — ${summary.eventName}` : ""}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary?.slots.map((slot) => (
                    <div key={slot.slot} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div className="font-medium">{slot.slot}</div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-primary font-bold">{slot.booked} booked</span>
                        <span className="text-muted-foreground w-20 text-right">{slot.available} available</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="pt-4 space-y-3">
            {events && events.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-sm font-medium">Filter by event</Label>
                <Select value={filterEventId} onValueChange={setFilterEventId}>
                  <SelectTrigger className="w-52 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      {events && events.length > 1 && <TableHead>Event</TableHead>}
                      <TableHead>Pizzas</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell>
                      </TableRow>
                    )}
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.userName}</TableCell>
                        {events && events.length > 1 && (
                          <TableCell className="text-xs text-muted-foreground">{order.eventName}</TableCell>
                        )}
                        <TableCell>
                          <div className="space-y-0.5">
                            {(order.items ?? []).map((item: any, i: number) => (
                              <div key={i} className="text-sm">{item.pizzaChoice}</div>
                            ))}
                            <div className="text-xs text-muted-foreground">
                              {order.quantity * (events?.find(e => e.id === order.eventId)?.price ?? 70)} DKK
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{order.pickupSlot}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">{order.notes || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(val) => handleStatusChange(order.id, val as OrderUpdateStatus)}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="declined">Declined</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS */}
          <TabsContent value="events" className="pt-4 space-y-4">
            {/* Create form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Create Event</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Event Name</Label>
                      <Input placeholder="e.g. Neapolitan Pizza Night" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Date</Label>
                      <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Total Capacity</Label>
                      <Input type="number" min={1} value={newEventCapacity} onChange={(e) => setNewEventCapacity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Pizzas per Slot</Label>
                      <Input type="number" min={1} value={newEventSlot} onChange={(e) => setNewEventSlot(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Price per Pizza (DKK)</Label>
                      <Input type="number" min={1} value={newEventPrice} onChange={(e) => setNewEventPrice(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Description</Label>
                    <Textarea
                      placeholder="Shown on home &amp; order pages..."
                      value={newEventDescription}
                      onChange={(e) => setNewEventDescription(e.target.value)}
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TagEditor label="Pickup Slots" tags={newEventSlots} onChange={setNewEventSlots} placeholder="e.g. 17:00-17:30" />
                    <TagEditor label="Pizza Types" tags={newEventPizzaTypes} onChange={setNewEventPizzaTypes} placeholder="e.g. Quattro Stagioni" />
                  </div>
                  <Button type="submit" disabled={createEvent.isPending || !newEventName.trim() || !newEventDate}>
                    <Plus className="w-4 h-4 mr-2" /> Create Event
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Events list */}
            <div className="space-y-3">
              {(!events || events.length === 0) && (
                <p className="text-center py-8 text-muted-foreground">No events yet.</p>
              )}
              {events?.map((event) => (
                <Card key={event.id} className={!event.active ? "opacity-60" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{event.name}</span>
                          <Badge variant={event.active ? "default" : "secondary"} className="text-xs">
                            {event.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                          <span>{formatEventDate(event.date)}</span>
                          <span>{event.totalCapacity} pizzas total · {event.slotCapacity}/slot · {event.price} DKK</span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{event.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(event.slots ?? []).map((s) => (
                            <Badge key={s} variant="outline" className="text-xs font-normal">{s}</Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(event.pizzaTypes ?? []).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={event.active} onCheckedChange={(v) => handleToggleEvent(event.id, v)} />
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setEditingEventId(editingEventId === event.id ? null : event.id)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteEvent(event.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {editingEventId === event.id && (
                      <EventEditPanel event={event} onClose={() => setEditingEventId(null)} />
                    )}

                    <EventUserManager eventId={event.id} allUsers={users ?? []} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* GUESTS */}
          <TabsContent value="users" className="pt-4 space-y-4">
            <Card>
              <CardHeader className="pb-4"><CardTitle className="text-lg">Add Guest</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddUser} className="flex gap-4">
                  <Input
                    placeholder="Guest name..."
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button type="submit" disabled={createUser.isPending || !newUserName.trim()}>
                    <UserPlus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="font-mono tracking-widest">{user.code}</TableCell>
                        <TableCell>
                          <Switch checked={user.active} onCheckedChange={(v) => handleToggleUser(user.id, v)} />
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => regenerateCode.mutate({ id: user.id }, { onSuccess: () => { toast({ title: "Code regenerated" }); queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); } })} className="h-8 w-8">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (!confirm("Delete this guest?")) return; deleteUser.mutate({ id: user.id }, { onSuccess: () => { toast({ title: "Guest deleted" }); queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); } }); }} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
