import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface IAddRoleDialogProps<T = any> {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  onSubmit?: (values: Record<string, any>) => void;
  loading: boolean;
  resetForm: boolean;
  initialValues?: { name?: string; description?: string } | null;
  title?: string;
  submitLabel?: string;
}

const AddRoleDialog = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  resetForm,
  initialValues,
  title,
  submitLabel,
}: IAddRoleDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (formData.name.trim() && formData.description.trim()) {
      onSubmit?.(formData);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", description: "" });
    onClose?.(false);
  };

  useEffect(() => {
    if (resetForm) {
      setFormData({ name: "", description: "" });
    }
  }, [resetForm]);

  useEffect(() => {
    if (isOpen && initialValues) {
      setFormData({
        name: initialValues.name ?? "",
        description: initialValues.description ?? "",
      });
    }
  }, [isOpen, initialValues?.name, initialValues?.description]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (!open ? handleClose() : undefined)}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title ?? "Add New Role"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter role name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Enter role description"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="flex-1"
                disabled={loading}
              >
                {loading ? "Please wait..." : (submitLabel ?? "Add Role")}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default AddRoleDialog;
