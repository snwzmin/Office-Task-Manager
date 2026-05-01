import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetUsers,
  getGetUsersQueryKey,
  useGetMe,
  getGetMeQueryKey,
  useCreateUser,
  useUpdateUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, UserCog, ShieldAlert } from "lucide-react";

export default function UserManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: isLoadingMe } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  
  useEffect(() => {
    if (!isLoadingMe && currentUser && currentUser.role !== "admin") {
      setLocation("/dashboard");
      toast({ title: "Access Denied", description: "Only administrators can manage users.", variant: "destructive" });
    }
  }, [currentUser, isLoadingMe, setLocation, toast]);

  const { data: users, isLoading: isLoadingUsers } = useGetUsers({ 
    query: { 
      queryKey: getGetUsersQueryKey(),
      enabled: currentUser?.role === "admin"
    } 
  });

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
    department: "",
    is_active: true
  });

  const handleOpenDialog = (user?: any) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role as "user" | "admin",
        department: user.department || "",
        is_active: user.is_active
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "user",
        department: "",
        is_active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || (!editingUser && !formData.password) || (!editingUser && !formData.email)) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }

    if (editingUser) {
      const payload: any = {
        name: formData.name,
        role: formData.role,
        department: formData.department,
        is_active: formData.is_active
      };
      
      updateMutation.mutate(
        { id: editingUser.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
            setIsDialogOpen(false);
            toast({ title: "User updated successfully" });
          },
          onError: () => toast({ title: "Failed to update user", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
            setIsDialogOpen(false);
            toast({ title: "User created successfully" });
          },
          onError: () => toast({ title: "Failed to create user", variant: "destructive" })
        }
      );
    }
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    updateMutation.mutate(
      { id, data: { is_active: !currentStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          toast({ title: `User account ${!currentStatus ? 'activated' : 'deactivated'}` });
        },
        onError: () => toast({ title: "Failed to update user status", variant: "destructive" })
      }
    );
  };

  if (isLoadingMe || (currentUser?.role === "admin" && isLoadingUsers)) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (currentUser?.role !== "admin") {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage system access and roles.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="btn-new-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users?.map((user: any) => (
                <TableRow key={user.id} className={!user.is_active ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                          {user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                      {user.role === 'admin' && <ShieldAlert className="h-3 w-3 mr-1" />}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.department || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "outline" : "destructive"} className={user.is_active ? "text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900/50" : ""}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleOpenDialog(user)}
                        disabled={user.id === currentUser.id}
                        title="Edit User"
                        data-testid={`btn-edit-user-${user.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        disabled={user.id === currentUser.id}
                        title={user.is_active ? "Deactivate User" : "Activate User"}
                        className={user.is_active ? "hover:text-destructive" : "hover:text-green-600"}
                        data-testid={`btn-toggle-status-${user.id}`}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                data-testid="input-user-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address {editingUser ? "" : "*"}</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                disabled={!!editingUser}
                data-testid="input-user-email"
              />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  data-testid="input-user-password"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(v: "user" | "admin") => setFormData({...formData, role: v})}>
                  <SelectTrigger id="role" data-testid="select-user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input 
                  id="department" 
                  value={formData.department} 
                  onChange={(e) => setFormData({...formData, department: e.target.value})} 
                  placeholder="e.g. Sales"
                  data-testid="input-user-dept"
                />
              </div>
            </div>

            {editingUser && (
              <div className="flex items-center justify-between mt-2 p-3 bg-muted/50 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Account Status</Label>
                  <div className="text-xs text-muted-foreground">
                    {formData.is_active ? "User can log in" : "User cannot log in"}
                  </div>
                </div>
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={(v) => setFormData({...formData, is_active: v})}
                  data-testid="switch-user-status"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-user">
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
