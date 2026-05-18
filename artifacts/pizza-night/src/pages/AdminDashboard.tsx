import { useState } from "react";
import { 
  useGetMe, useGetSummary, useListOrders, useUpdateOrder, useDeleteOrder, 
  useListUsers, useUpdateUser, useDeleteUser, useRegenerateCode, useCreateUser,
  getListOrdersQueryKey, getListUsersQueryKey, getGetSummaryQueryKey
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderUpdateStatus } from "@workspace/api-client-react";

export function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: summary } = useGetSummary();
  const { data: orders } = useListOrders();
  const { data: users } = useListUsers();

  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const regenerateCode = useRegenerateCode();
  const createUser = useCreateUser();

  const [newUserName, setNewUserName] = useState("");

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
      }
    });
  };

  const handleDeleteOrder = (id: number) => {
    if (confirm("Are you sure you want to delete this order?")) {
      deleteOrder.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Order deleted" });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        }
      });
    }
  };

  const handleToggleUser = (id: number, active: boolean) => {
    updateUser.mutate({ id, data: { active } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  const handleRegenerateCode = (id: number) => {
    regenerateCode.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Code regenerated" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  const handleDeleteUser = (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUser.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "User deleted" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      });
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    createUser.mutate({ data: { name: newUserName } }, {
      onSuccess: () => {
        toast({ title: "User added" });
        setNewUserName("");
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  function formatOrderItems(order: any): string {
    const items = order.items ?? [];
    if (items.length === 0) return `${order.quantity}x (legacy)`;
    if (items.length === 1) return `${items[0].quantity}x ${items[0].pizzaChoice}`;
    return items.map((i: any) => `${i.pizzaChoice}`).join(", ");
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-serif font-bold text-foreground">Kitchen Dashboard</h1>
        </div>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="users">Guests</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Booked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-primary">{summary?.totalBooked || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">out of {summary?.totalCapacity}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (Est)</CardTitle>
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
                  <div className="text-3xl font-bold font-serif text-accent">{summary?.totalRemaining || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Slot Breakdown</CardTitle>
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

          <TabsContent value="orders" className="pt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Pizzas</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell>
                      </TableRow>
                    )}
                    {orders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.userName}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {(order.items ?? []).length > 0 ? (
                              (order.items ?? []).map((item: any, i: number) => (
                                <div key={i} className="text-sm">
                                  {item.pizzaChoice}
                                  {(order.items ?? []).length === 1 && order.quantity > 1
                                    ? ` ×${item.quantity}`
                                    : ""}
                                </div>
                              ))
                            ) : (
                              <span className="text-sm">{order.quantity}x (legacy)</span>
                            )}
                            <div className="text-xs text-muted-foreground">{order.quantity * 70} DKK</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{order.pickupSlot}</TableCell>
                        <TableCell className="max-w-[130px] truncate text-xs">{order.notes || "-"}</TableCell>
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
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} title="Delete User" className="h-8 w-8 text-destructive hover:bg-destructive/10">
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
