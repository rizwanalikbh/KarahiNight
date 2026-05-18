import { useState } from "react";
import {
  useGetMe, useGetSummary, useListOrders, useUpdateOrder, useDeleteOrder,
  useListUsers, useUpdateUser, useDeleteUser, useRegenerateCode, useCreateUser,
  useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  useListEventUsers, useAddUserToEvent, useRemoveUserFromEvent,
  getListOrdersQueryKey, getListUsersQueryKey, getGetSummaryQueryKey,
  getListEventsQueryKey, getListEventUsersQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, UserPlus, Plus, CalendarDays, Users, ChevronDown, ChevronUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderUpdateStatus } from "@workspace/api-client-react";

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Sub-component: manage users within a single event
function EventUserManager({ eventId, allUsers }: { eventId: number; allUsers: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: eventUsers } = useListEventUsers(eventId, { query: { enabled: expanded, queryKey: getListEventUsersQueryKey(eventId) } });
  const addUser = useAddUserToEvent();
  const removeUser = useRemoveUserFromEvent();

  const eventUserIds = new Set((eventUsers ?? []).map((u) => u.id));
  const usersNotInEvent = allUsers.filter((u) => !eventUserIds.has(u.id));

  const handleAdd = () => {
    if (!addUserId) return;
    addUser.mutate({ id: eventId, data: { userId: parseInt(addUserId, 10) } }, {
      onSuccess: () => {
        toast({ title: "User added to event" });
        setAddUserId("");
        queryClient.invalidateQueries({ queryKey: getListEventUsersQueryKey(eventId) });
      },
    });
  };

  const handleRemove = (userId: number) => {
    removeUser.mutate({ id: eventId, userId }, {
      onSuccess: () => {
        toast({ title: "User removed from event" });
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
          {/* Current users */}
          {(eventUsers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No guests assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(eventUsers ?? []).map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1.5 pr-1">
                  {u.name}
                  <button
                    type="button"
                    onClick={() => handleRemove(u.id)}
                    className="hover:text-destructive transition-colors ml-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Add user */}
          {usersNotInEvent.length > 0 && (
            <div className="flex gap-2 items-center">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Add a guest..." />
                </SelectTrigger>
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

export function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: events } = useListEvents();
  const { data: orders } = useListOrders({});
  const { data: users } = useListUsers();

  // Summary state: pick first event by default
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
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [newUserName, setNewUserName] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("2026-05-24");
  const [newEventCapacity, setNewEventCapacity] = useState("10");
  const [newEventSlot, setNewEventSlot] = useState("3");
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

  const handleRegenerateCode = (id: number) => {
    regenerateCode.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Code regenerated" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    });
  };

  const handleDeleteUser = (id: number) => {
    if (!confirm("Delete this user?")) return;
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "User deleted" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
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
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Event created" });
          setNewEventName("");
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

          {/* SUMMARY TAB */}
          <TabsContent value="summary" className="space-y-4 pt-4">
            {/* Event picker for summary */}
            {events && events.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-sm font-medium">Event</Label>
                <Select
                  value={summaryEventId ? String(summaryEventId) : String(events[0]?.id ?? "")}
                  onValueChange={(v) => setSummaryEventId(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-64 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Booked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-primary">{summary?.totalBooked || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">out of {summary?.totalCapacity ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Est)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif">{(summary?.totalBooked || 0) * 70} DKK</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Dough</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-accent">{summary?.totalRemaining ?? "—"}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Slot Breakdown{summary ? ` — ${summary.eventName}` : ""}</CardTitle>
              </CardHeader>
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

          {/* ORDERS TAB */}
          <TabsContent value="orders" className="pt-4 space-y-3">
            {events && events.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-sm font-medium">Filter by event</Label>
                <Select value={filterEventId} onValueChange={setFilterEventId}>
                  <SelectTrigger className="w-52 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                            <div className="text-xs text-muted-foreground">{order.quantity * 70} DKK</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{order.pickupSlot}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">{order.notes || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(val) => handleStatusChange(order.id, val as OrderUpdateStatus)}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
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

          {/* EVENTS TAB */}
          <TabsContent value="events" className="pt-4 space-y-4">
            {/* Create event form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Create Event</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Event Name</Label>
                      <Input
                        placeholder="e.g. Neapolitan Pizza Night"
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Date</Label>
                      <Input
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Total Capacity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newEventCapacity}
                        onChange={(e) => setNewEventCapacity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Pizzas per Slot</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newEventSlot}
                        onChange={(e) => setNewEventSlot(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={createEvent.isPending || !newEventName.trim() || !newEventDate}>
                    <Plus className="w-4 h-4 mr-2" /> Create Event
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Events list */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!events || events.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No events yet.</TableCell>
                      </TableRow>
                    )}
                    {events?.map((event) => (
                      <>
                        <TableRow key={event.id} className={!event.active ? "opacity-60" : ""}>
                          <TableCell className="font-medium">{event.name}</TableCell>
                          <TableCell className="text-sm">{formatEventDate(event.date)}</TableCell>
                          <TableCell className="text-sm">{event.totalCapacity} total / {event.slotCapacity} per slot</TableCell>
                          <TableCell>
                            <Switch
                              checked={event.active}
                              onCheckedChange={(val) => handleToggleEvent(event.id, val)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow key={`${event.id}-users`} className={!event.active ? "opacity-60" : ""}>
                          <TableCell colSpan={5} className="pt-0 pb-4 px-4">
                            <EventUserManager eventId={event.id} allUsers={users ?? []} />
                          </TableCell>
                        </TableRow>
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GUESTS (USERS) TAB */}
          <TabsContent value="users" className="pt-4 space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Add Guest</CardTitle>
              </CardHeader>
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
                          <Switch
                            checked={user.active}
                            onCheckedChange={(val) => handleToggleUser(user.id, val)}
                          />
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => handleRegenerateCode(user.id)} title="Regenerate Code" className="h-8 w-8">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} title="Delete Guest" className="h-8 w-8 text-destructive hover:bg-destructive/10">
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
