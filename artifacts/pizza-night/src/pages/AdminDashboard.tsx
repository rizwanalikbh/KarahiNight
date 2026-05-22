import { useState, useRef, useEffect } from "react";
import {
  useGetMe, useGetSummary, useListOrders, useUpdateOrder, useDeleteOrder,
  useListUsers, useUpdateUser, useDeleteUser, useRegenerateCode, useCreateUser,
  useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  useListSegments, useCreateSegment, useDeleteSegment, useUpdateSegment,
  useListSegmentUsers, useAddUserToSegment, useRemoveUserFromSegment,
  useListEventSegments, useAddSegmentToEvent, useRemoveSegmentFromEvent,
  useImportUsers, useListUserSegments,
  getListOrdersQueryKey, getListUsersQueryKey, getGetSummaryQueryKey,
  getListEventsQueryKey,
  getListSegmentsQueryKey, getListSegmentUsersQueryKey, getListEventSegmentsQueryKey,
  getListUserSegmentsQueryKey,
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
  Users, ChevronDown, ChevronUp, Pencil, X, Check, FileText, Tag, Upload, Mail, Phone,
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
  const [maxPerGuest, setMaxPerGuest] = useState(event.maxPerGuest != null ? String(event.maxPerGuest) : "");
  const [description, setDescription] = useState(event.description ?? "");
  const [orderDeadline, setOrderDeadline] = useState<string>(() => {
    if (!event.orderDeadline) return "";
    const d = new Date(event.orderDeadline);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
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
          price: Number.isNaN(parseInt(price, 10)) ? 70 : parseInt(price, 10),
          maxPerGuest: maxPerGuest === "" ? null : (parseInt(maxPerGuest, 10) || null),
          description: description || undefined,
          orderDeadline: orderDeadline || null,
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
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Max Pizzas per Guest <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input type="number" min={1} placeholder="No limit" value={maxPerGuest} onChange={(e) => setMaxPerGuest(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Order Deadline</Label>
          <Input type="datetime-local" value={orderDeadline} onChange={(e) => setOrderDeadline(e.target.value)} />
          <p className="text-xs text-muted-foreground">After this time, no new orders or edits are accepted.</p>
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

// ── Segment manager per event ────────────────────────────────────────────────
function EventSegmentManager({ eventId, allSegments }: { eventId: number; allSegments: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addSegmentId, setAddSegmentId] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: eventSegments } = useListEventSegments(eventId, {
    query: { enabled: expanded, queryKey: getListEventSegmentsQueryKey(eventId) },
  });
  const addSegment = useAddSegmentToEvent();
  const removeSegment = useRemoveSegmentFromEvent();

  const eventSegmentIds = new Set((eventSegments ?? []).map((s) => s.id));
  const segmentsNotInEvent = allSegments.filter((s) => !eventSegmentIds.has(s.id));

  const handleAdd = () => {
    if (!addSegmentId) return;
    addSegment.mutate({ id: eventId, data: { segmentId: parseInt(addSegmentId, 10) } }, {
      onSuccess: () => {
        toast({ title: "Segment assigned" });
        setAddSegmentId("");
        queryClient.invalidateQueries({ queryKey: getListEventSegmentsQueryKey(eventId) });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Tag className="w-4 h-4" />
        {expanded ? "Hide" : "Manage"} segments
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 border rounded-xl p-4 space-y-3 bg-secondary/20">
          {(eventSegments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No segments assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(eventSegments ?? []).map((s) => (
                <Badge key={s.id} variant="secondary" className="gap-1.5 pr-1">
                  <Tag className="w-3 h-3" />
                  {s.name}
                  <span className="text-muted-foreground text-xs">({s.memberCount})</span>
                  <button
                    type="button"
                    onClick={() => removeSegment.mutate({ id: eventId, segmentId: s.id }, {
                      onSuccess: () => {
                        toast({ title: "Segment removed" });
                        queryClient.invalidateQueries({ queryKey: getListEventSegmentsQueryKey(eventId) });
                        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
                      },
                    })}
                    className="hover:text-destructive transition-colors ml-1"
                  >×</button>
                </Badge>
              ))}
            </div>
          )}
          {segmentsNotInEvent.length > 0 && (
            <div className="flex gap-2 items-center">
              <Select value={addSegmentId} onValueChange={setAddSegmentId}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Assign a segment..." /></SelectTrigger>
                <SelectContent>
                  {segmentsNotInEvent.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.memberCount} members)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8" onClick={handleAdd} disabled={!addSegmentId || addSegment.isPending}>
                <Plus className="w-3 h-3 mr-1" /> Assign
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline order editor ─────────────────────────────────────────────────────
function OrderEditPanel({
  order, event, onClose, onSave,
}: {
  order: any;
  event: any | undefined;
  onClose: () => void;
  onSave: (id: number, data: { items?: any[]; pickupSlot?: string; notes?: string; paid?: boolean }) => void;
}) {
  const slots: string[] = event?.slots ?? [];
  const pizzaTypes: string[] = event?.pizzaTypes ?? ["Margherita", "Pepperoni", "Special"];
  const maxPizzas: number = event?.slotCapacity ?? 3;

  const [items, setItems] = useState<{ pizzaChoice: string; quantity: number }[]>(
    () => {
      const raw = order.items ?? [];
      return raw.length > 0 ? raw.map((i: any) => ({ pizzaChoice: i.pizzaChoice, quantity: i.quantity })) : [{ pizzaChoice: pizzaTypes[0] ?? "", quantity: 1 }];
    }
  );
  const [pickupSlot, setPickupSlot] = useState<string>(order.pickupSlot ?? "");
  const [notes, setNotes] = useState<string>(order.notes ?? "");
  const [paid, setPaid] = useState<boolean>(order.paid ?? false);

  const updateChoice = (index: number, choice: string) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, pizzaChoice: choice } : it)));

  const addPizza = () => {
    if (items.length >= maxPizzas) return;
    setItems((prev) => [...prev, { pizzaChoice: pizzaTypes[0] ?? "", quantity: 1 }]);
  };

  const removePizza = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t bg-secondary/10 px-4 py-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Pickup Slot</Label>
          <Select value={pickupSlot} onValueChange={setPickupSlot}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {slots.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
          <Input
            className="h-8 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, preferences..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">
            Pizzas ({items.length}/{maxPizzas} max)
          </Label>
          <Button
            type="button" size="sm" variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={addPizza}
            disabled={items.length >= maxPizzas}
          >
            <Plus className="w-3 h-3" /> Add pizza
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {items.length > 1 && (
                <span className="text-xs text-muted-foreground w-5 shrink-0">#{index + 1}</span>
              )}
              <div className="flex flex-wrap gap-1.5 flex-1">
                {pizzaTypes.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => updateChoice(index, choice)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer
                      ${item.pizzaChoice === choice
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-secondary/50 text-foreground"
                      }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <Button
                type="button" size="icon" variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePizza(index)}
                disabled={items.length <= 1}
                title="Remove this pizza"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1 border-t">
        <Switch id={`paid-${order.id}`} checked={paid} onCheckedChange={setPaid} />
        <Label htmlFor={`paid-${order.id}`} className="text-sm cursor-pointer select-none">
          {paid ? "Payment received" : "Payment pending"}
        </Label>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(order.id, { items, pickupSlot, notes, paid })}>
          <Check className="w-3.5 h-3.5 mr-1.5" />Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-3.5 h-3.5 mr-1.5" />Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Segment badges for a single user row ────────────────────────────────────
function UserSegmentBadges({ userId }: { userId: number }) {
  const { data } = useListUserSegments(userId, {
    query: { queryKey: getListUserSegmentsQueryKey(userId) },
  });
  if (!data?.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((s) => (
        <Badge key={s.id} variant="secondary" className="text-xs font-normal py-0">
          {s.name}
        </Badge>
      ))}
    </div>
  );
}

// ── Guest inline edit panel ──────────────────────────────────────────────────
function GuestEditPanel({ user, allSegments, onClose }: { user: any; allSegments: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email ?? "");
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [addSegmentId, setAddSegmentId] = useState("");

  const { data: userSegments, isLoading: segmentsLoading } = useListUserSegments(user.id, {
    query: { queryKey: getListUserSegmentsQueryKey(user.id) },
  });
  const updateUser = useUpdateUser();
  const addToSegment = useAddUserToSegment();
  const removeFromSegment = useRemoveUserFromSegment();

  const userSegmentIds = new Set((userSegments ?? []).map((s) => s.id));
  const availableSegments = allSegments.filter((s) => !userSegmentIds.has(s.id));

  const handleSave = () => {
    updateUser.mutate({
      id: user.id,
      data: { email: email.trim() || null, mobile: mobile.trim() || null },
    }, {
      onSuccess: () => {
        toast({ title: "Guest updated" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to update guest";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  return (
    <div className="mt-3 p-4 border rounded-xl bg-secondary/20 space-y-4">
      <p className="text-sm font-medium">{user.name}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Mobile</Label>
          <Input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> Segments</Label>
        <div className="flex flex-wrap gap-2 min-h-[1.75rem] items-center">
          {segmentsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {!segmentsLoading && (userSegments ?? []).length === 0 && (
            <span className="text-xs text-muted-foreground">No segments yet</span>
          )}
          {(userSegments ?? []).map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.name}
              <button type="button"
                onClick={() => removeFromSegment.mutate({ id: s.id, userId: user.id }, {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListUserSegmentsQueryKey(user.id) });
                    queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
                  },
                })}
                className="hover:text-destructive transition-colors ml-1"
              >×</button>
            </Badge>
          ))}
        </div>
        {availableSegments.length > 0 && (
          <div className="flex gap-2">
            <Select value={addSegmentId} onValueChange={setAddSegmentId}>
              <SelectTrigger className="h-8 text-xs flex-1 max-w-xs">
                <SelectValue placeholder="Add to segment..." />
              </SelectTrigger>
              <SelectContent>
                {availableSegments.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" disabled={!addSegmentId || addToSegment.isPending}
              onClick={() => {
                if (!addSegmentId) return;
                addToSegment.mutate({ id: parseInt(addSegmentId, 10), data: { userId: user.id } }, {
                  onSuccess: () => {
                    setAddSegmentId("");
                    queryClient.invalidateQueries({ queryKey: getListUserSegmentsQueryKey(user.id) });
                    queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
                  },
                });
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={updateUser.isPending}>
          <Check className="w-3 h-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── CSV upload card ───────────────────────────────────────────────────────────
function CsvUploadCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<{ name: string; email?: string; mobile?: string }[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const importUsers = useImportUsers();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { setRows([]); return; }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const nameIdx = headers.indexOf("name");
      const emailIdx = headers.indexOf("email");
      const mobileIdx = headers.indexOf("mobile");
      if (nameIdx === -1) {
        toast({ title: "CSV must have a 'name' column", variant: "destructive" });
        setRows([]);
        return;
      }
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          name: cols[nameIdx] ?? "",
          ...(emailIdx !== -1 && cols[emailIdx] ? { email: cols[emailIdx] } : {}),
          ...(mobileIdx !== -1 && cols[mobileIdx] ? { mobile: cols[mobileIdx] } : {}),
        };
      }).filter((r) => r.name);
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!rows.length) return;
    importUsers.mutate({ data: { guests: rows } }, {
      onSuccess: (data) => {
        setResult(data);
        setRows([]);
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: `Imported: ${data.created} added, ${data.skipped} skipped` });
      },
      onError: () => toast({ title: "Import failed", variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><Upload className="w-5 h-5" /> Import from CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload a CSV with columns: <code className="text-xs bg-secondary px-1 py-0.5 rounded">name</code>,{" "}
          <code className="text-xs bg-secondary px-1 py-0.5 rounded">email</code> (optional),{" "}
          <code className="text-xs bg-secondary px-1 py-0.5 rounded">mobile</code> (optional). Header row required.
        </p>
        <div className="flex gap-3 items-center flex-wrap">
          <label className="cursor-pointer inline-flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm hover:bg-secondary transition-colors">
            <Upload className="w-4 h-4" /> Choose File
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
          {fileName && (
            <span className="text-sm text-muted-foreground">
              {fileName} — <strong>{rows.length}</strong> guest{rows.length !== 1 ? "s" : ""} ready
            </span>
          )}
          {rows.length > 0 && (
            <Button onClick={handleImport} disabled={importUsers.isPending} size="sm">
              {importUsers.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Import {rows.length} guest{rows.length !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
        {result && (
          <div className="text-sm p-3 bg-secondary/30 rounded-lg space-y-1">
            <p className="font-medium">Import complete: {result.created} created, {result.skipped} skipped</p>
            {result.errors.length > 0 && (
              <ul className="text-destructive space-y-0.5 mt-1">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Segment member manager (used inside segments tab) ────────────────────────
function SegmentMemberManager({ segmentId, allUsers }: { segmentId: number; allUsers: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: members } = useListSegmentUsers(segmentId, {
    query: { enabled: expanded, queryKey: getListSegmentUsersQueryKey(segmentId) },
  });
  const addUser = useAddUserToSegment();
  const removeUser = useRemoveUserFromSegment();

  const memberIds = new Set((members ?? []).map((u) => u.id));
  const usersNotInSegment = allUsers.filter((u) => !memberIds.has(u.id));

  const handleAdd = () => {
    if (!addUserId) return;
    addUser.mutate({ id: segmentId, data: { userId: parseInt(addUserId, 10) } }, {
      onSuccess: () => {
        toast({ title: "Guest added to segment" });
        setAddUserId("");
        queryClient.invalidateQueries({ queryKey: getListSegmentUsersQueryKey(segmentId) });
        queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Users className="w-4 h-4" />
        {expanded ? "Hide" : "Manage"} members
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 border rounded-xl p-4 space-y-3 bg-secondary/20">
          {(members ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(members ?? []).map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1.5 pr-1">
                  {u.name}
                  <button
                    type="button"
                    onClick={() => removeUser.mutate({ id: segmentId, userId: u.id }, {
                      onSuccess: () => {
                        toast({ title: "Guest removed from segment" });
                        queryClient.invalidateQueries({ queryKey: getListSegmentUsersQueryKey(segmentId) });
                        queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
                        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
                      },
                    })}
                    className="hover:text-destructive transition-colors ml-1"
                  >×</button>
                </Badge>
              ))}
            </div>
          )}
          {usersNotInSegment.length > 0 && (
            <div className="flex gap-2 items-center">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Add a guest..." /></SelectTrigger>
                <SelectContent>
                  {usersNotInSegment.map((u) => (
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

// ── Segment detail editor (description + tags inline) ────────────────────────
function SegmentDetailEditor({ seg }: { seg: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(seg.description ?? "");
  const [tags, setTags] = useState(seg.tags ?? "");
  const updateSegment = useUpdateSegment();

  const handleSave = () => {
    updateSegment.mutate(
      { id: seg.id, data: { description: description || null, tags: tags || null } },
      {
        onSuccess: () => {
          toast({ title: "Segment updated" });
          setEditing(false);
          queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
        },
        onError: () => toast({ title: "Failed to update segment", variant: "destructive" }),
      }
    );
  };

  const handleCancel = () => {
    setDescription(seg.description ?? "");
    setTags(seg.tags ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-3 border rounded-xl p-4 space-y-3 bg-secondary/20">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of this audience…"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Search tags <span className="font-normal">(comma-separated)</span></label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. vip, early-access, friends"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="h-7" onClick={handleCancel}>Cancel</Button>
          <Button size="sm" className="h-7" onClick={handleSave} disabled={updateSegment.isPending}>Save</Button>
        </div>
      </div>
    );
  }

  const hasDetails = seg.description || seg.tags;
  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setEditing(true)}
      >
        <Pencil className="w-3 h-3" />
        {hasDetails ? "Edit description & tags" : "Add description & tags"}
      </button>
      {hasDetails && (
        <div className="mt-2 space-y-1">
          {seg.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{seg.description}</p>
          )}
          {seg.tags && (
            <div className="flex flex-wrap gap-1 mt-1">
              {seg.tags.split(",").map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Segments tab ─────────────────────────────────────────────────────────────
function SegmentsTab({ allUsers }: { allUsers: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSegmentName, setNewSegmentName] = useState("");
  const [newSegmentDesc, setNewSegmentDesc] = useState("");
  const [newSegmentTags, setNewSegmentTags] = useState("");

  const { data: segments } = useListSegments({ query: { queryKey: getListSegmentsQueryKey() } });
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegmentName.trim()) return;
    createSegment.mutate({
      data: {
        name: newSegmentName.trim(),
        description: newSegmentDesc.trim() || undefined,
        tags: newSegmentTags.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Segment created" });
        setNewSegmentName("");
        setNewSegmentDesc("");
        setNewSegmentTags("");
        queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
      },
      onError: () => toast({ title: "Failed to create segment", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete segment "${name}"? Guests will not be deleted.`)) return;
    deleteSegment.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Segment deleted" });
        queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Tag className="w-5 h-5" /> Create Segment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex gap-3">
              <Input
                placeholder="Segment name, e.g. Fun Party"
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" disabled={createSegment.isPending || !newSegmentName.trim()}>
                <Plus className="w-4 h-4 mr-2" /> Create
              </Button>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Description (optional)"
                value={newSegmentDesc}
                onChange={(e) => setNewSegmentDesc(e.target.value)}
                className="max-w-xs text-sm"
              />
              <Input
                placeholder="Search tags, e.g. vip, friends (optional)"
                value={newSegmentTags}
                onChange={(e) => setNewSegmentTags(e.target.value)}
                className="max-w-xs text-sm"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(!segments || segments.length === 0) && (
          <p className="text-center py-8 text-muted-foreground">No segments yet.</p>
        )}
        {(segments ?? []).map((seg) => (
          <Card key={seg.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Tag className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">{seg.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{seg.memberCount} member{seg.memberCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => handleDelete(seg.id, seg.name)}
                  title="Delete segment"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <SegmentDetailEditor seg={seg} />
              <SegmentMemberManager segmentId={seg.id} allUsers={allUsers} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
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
  const { data: segments } = useListSegments({ query: { queryKey: getListSegmentsQueryKey() } });

  const [summaryEventId, setSummaryEventId] = useState<number | undefined>(undefined);
  const activeEventId = summaryEventId ?? events?.[0]?.id;
  const { data: summary } = useGetSummary(
    { eventId: activeEventId },
    { query: { enabled: !!activeEventId, queryKey: getGetSummaryQueryKey({ eventId: activeEventId }) } }
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
  const [newEventMaxPerGuest, setNewEventMaxPerGuest] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventDeadline, setNewEventDeadline] = useState("");
  const [newEventSlots, setNewEventSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [newEventPizzaTypes, setNewEventPizzaTypes] = useState<string[]>(DEFAULT_PIZZA_TYPES);

  // Event editing state
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  // Order editing state
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserMobile, setNewUserMobile] = useState("");
  const [newUserSegmentIds, setNewUserSegmentIds] = useState<number[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [filterEventId, setFilterEventId] = useState<string>("all");

  useEffect(() => {
    if (!sessionLoading && (!session?.authenticated || session.role !== "admin")) {
      setLocation("/admin");
    }
  }, [sessionLoading, session, setLocation]);

  if (sessionLoading) return <Layout><div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div></Layout>;
  if (!session?.authenticated || session.role !== "admin") return null;

  const handleStatusChange = (id: number, status: OrderUpdateStatus) => {
    updateOrder.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const handleTogglePaid = (id: number, paid: boolean) => {
    updateOrder.mutate({ id, data: { paid } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const handleSaveOrderEdit = (id: number, data: { items?: any[]; pickupSlot?: string; notes?: string; paid?: boolean }) => {
    updateOrder.mutate({ id, data: { items: data.items, pickupSlot: data.pickupSlot, notes: data.notes, paid: data.paid } }, {
      onSuccess: () => {
        toast({ title: "Order updated" });
        setEditingOrderId(null);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
      onError: () => toast({ title: "Failed to update order", variant: "destructive" }),
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

  const addToSegmentMutation = useAddUserToSegment();

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    createUser.mutate({
      data: {
        name: newUserName.trim(),
        ...(newUserEmail.trim() ? { email: newUserEmail.trim() } : {}),
        ...(newUserMobile.trim() ? { mobile: newUserMobile.trim() } : {}),
      },
    }, {
      onSuccess: (newUser) => {
        toast({ title: "Guest added" });
        setNewUserName("");
        setNewUserEmail("");
        setNewUserMobile("");
        // Assign to selected segments
        for (const segId of newUserSegmentIds) {
          addToSegmentMutation.mutate({ id: segId, data: { userId: newUser.id } }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListUserSegmentsQueryKey(newUser.id) });
            },
          });
        }
        setNewUserSegmentIds([]);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to add guest";
        toast({ title: msg, variant: "destructive" });
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
          price: Number.isNaN(parseInt(newEventPrice, 10)) ? 70 : parseInt(newEventPrice, 10),
          maxPerGuest: newEventMaxPerGuest === "" ? undefined : (parseInt(newEventMaxPerGuest, 10) || undefined),
          description: newEventDescription || undefined,
          orderDeadline: newEventDeadline || undefined,
          slots: newEventSlots,
          pizzaTypes: newEventPizzaTypes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Event created" });
          setNewEventName("");
          setNewEventDescription("");
          setNewEventDeadline("");
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="users">Guests</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
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
                      <TableHead>Paid</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell>
                      </TableRow>
                    )}
                    {filteredOrders.map((order) => {
                      const orderEvent = events?.find((e) => e.id === order.eventId);
                      const isEditing = editingOrderId === order.id;
                      return (
                        <>
                          <TableRow key={order.id} className={isEditing ? "bg-secondary/20" : undefined}>
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
                                  {order.quantity * (orderEvent?.price ?? 70)} DKK
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
                            <TableCell>
                              <Switch
                                checked={order.paid}
                                onCheckedChange={(v) => handleTogglePaid(order.id, v)}
                                title={order.paid ? "Mark as unpaid" : "Mark as paid"}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {order.status === "confirmed" && (
                                  <a
                                    href={`/receipt/${order.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open receipt (save as PDF)"
                                  >
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-700 hover:bg-green-50">
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </a>
                                )}
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${isEditing ? "text-primary bg-primary/10" : ""}`}
                                  onClick={() => setEditingOrderId(isEditing ? null : order.id)}
                                  title="Edit order"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isEditing && (
                            <TableRow key={`${order.id}-edit`}>
                              <TableCell colSpan={events && events.length > 1 ? 8 : 7} className="p-0">
                                <OrderEditPanel
                                  order={order}
                                  event={orderEvent}
                                  onClose={() => setEditingOrderId(null)}
                                  onSave={handleSaveOrderEdit}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
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
                      <Input type="number" min={0} value={newEventPrice} onChange={(e) => setNewEventPrice(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Max Pizzas per Guest <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input type="number" min={1} placeholder="No limit" value={newEventMaxPerGuest} onChange={(e) => setNewEventMaxPerGuest(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Order Deadline <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input type="datetime-local" value={newEventDeadline} onChange={(e) => setNewEventDeadline(e.target.value)} />
                      <p className="text-xs text-muted-foreground">After this time, no new orders or edits.</p>
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
                          <span>{event.totalCapacity} pizzas total · {event.slotCapacity}/slot · {event.price} DKK{event.maxPerGuest != null ? ` · max ${event.maxPerGuest}/guest` : ""}</span>
                          {event.orderDeadline && (
                            <span className={new Date() > new Date(event.orderDeadline) ? "text-destructive" : ""}>
                              Orders close {new Date(event.orderDeadline).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
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

                    <EventSegmentManager eventId={event.id} allSegments={segments ?? []} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SEGMENTS */}
          <TabsContent value="segments" className="pt-4 space-y-4">
            <SegmentsTab allUsers={users ?? []} />
          </TabsContent>

          {/* GUESTS */}
          <TabsContent value="users" className="pt-4 space-y-4">
            <CsvUploadCard />

            <Card>
              <CardHeader className="pb-4"><CardTitle className="text-lg flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add Guest</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddUser} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input placeholder="Guest name..." value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input type="email" placeholder="Optional, must be unique" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Mobile</Label>
                      <Input type="tel" placeholder="Optional, must be unique" value={newUserMobile} onChange={(e) => setNewUserMobile(e.target.value)} />
                    </div>
                  </div>
                  {segments && segments.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> Segments</Label>
                      <div className="flex flex-wrap gap-2">
                        {segments.map((seg) => {
                          const checked = newUserSegmentIds.includes(seg.id);
                          return (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() => setNewUserSegmentIds(
                                checked
                                  ? newUserSegmentIds.filter((id) => id !== seg.id)
                                  : [...newUserSegmentIds, seg.id]
                              )}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                checked
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border hover:bg-secondary"
                              }`}
                            >
                              <Tag className="w-3 h-3" />
                              {seg.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <Button type="submit" disabled={createUser.isPending || !newUserName.trim()}>
                    <UserPlus className="w-4 h-4 mr-2" /> Add Guest
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
                      <TableHead>Email</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Segments</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <>
                          <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.email ? (
                                <a href={`mailto:${user.email}`} className="hover:text-foreground transition-colors">{user.email}</a>
                              ) : <span className="text-xs">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.mobile ?? <span className="text-xs">—</span>}
                            </TableCell>
                            <TableCell><UserSegmentBadges userId={user.id} /></TableCell>
                            <TableCell className="font-mono tracking-widest">{user.code}</TableCell>
                            <TableCell>
                              <Switch checked={user.active} onCheckedChange={(v) => handleToggleUser(user.id, v)} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${isEditing ? "text-primary bg-primary/10" : ""}`}
                                  onClick={() => setEditingUserId(isEditing ? null : user.id)}
                                  title="Edit guest"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => regenerateCode.mutate({ id: user.id }, { onSuccess: () => { toast({ title: "Code regenerated" }); queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); } })} className="h-8 w-8" title="Regenerate code">
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if (!confirm("Delete this guest?")) return; deleteUser.mutate({ id: user.id }, { onSuccess: () => { toast({ title: "Guest deleted" }); queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); } }); }} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Delete guest">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isEditing && (
                            <TableRow key={`${user.id}-edit`}>
                              <TableCell colSpan={7} className="p-0 pb-2">
                                <div className="px-4">
                                  <GuestEditPanel
                                    user={user}
                                    allSegments={segments ?? []}
                                    onClose={() => setEditingUserId(null)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
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
