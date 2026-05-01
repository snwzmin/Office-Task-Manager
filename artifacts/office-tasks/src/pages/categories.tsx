import { useState } from "react";
import {
  useGetCategories,
  getGetCategoriesQueryKey,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  Category
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, Trash2, FolderClosed } from "lucide-react";

export default function Categories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: categories, isLoading } = useGetCategories(undefined, { query: { queryKey: getGetCategoriesQueryKey() } });

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ name: "", color: "#3b82f6" });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, color: category.color });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", color: "#3b82f6" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (editingCategory) {
      updateMutation.mutate(
        { id: editingCategory.id, data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
            setIsDialogOpen(false);
            toast({ title: "Category updated" });
          },
          onError: () => toast({ title: "Failed to update category", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
            setIsDialogOpen(false);
            toast({ title: "Category created" });
          },
          onError: () => toast({ title: "Failed to create category", variant: "destructive" })
        }
      );
    }
  };

  const confirmDelete = (id: string) => {
    setCategoryToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!categoryToDelete) return;
    deleteMutation.mutate(
      { id: categoryToDelete },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
          setIsDeleteDialogOpen(false);
          toast({ title: "Category deleted" });
        },
        onError: () => toast({ title: "Failed to delete category", variant: "destructive" })
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">Manage task categorization tags.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="btn-new-category">
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : (categories || []).length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center text-muted-foreground bg-card rounded-xl border border-dashed">
            <FolderClosed className="h-12 w-12 mb-3 opacity-20" />
            <p>No categories defined.</p>
            <Button variant="link" onClick={() => handleOpenDialog()} className="mt-2">Create your first category</Button>
          </div>
        ) : (
          (categories || []).map((category: Category) => (
            <Card key={category.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div 
                  className="h-2 w-full" 
                  style={{ backgroundColor: category.color }} 
                />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: category.color }} 
                        />
                        {category.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleOpenDialog(category)} data-testid={`btn-edit-${category.id}`}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => confirmDelete(category.id)} data-testid={`btn-delete-${category.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Marketing, Development, Urgent"
                data-testid="input-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color Label</Label>
              <div className="flex gap-3">
                <Input 
                  id="color" 
                  type="color" 
                  value={formData.color} 
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 p-1 h-10 cursor-pointer"
                  data-testid="input-category-color"
                />
                <Input 
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 font-mono uppercase"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-category">
              {editingCategory ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category. Tasks associated with this category will not be deleted, but they will lose this categorization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="btn-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
