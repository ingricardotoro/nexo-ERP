import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserForm } from '@/components/users/user-form';
import type { UserTableData } from '@/components/users/users-table';
import type { CreateUserInput } from '@/lib/validations/user.schema';

export type UserEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserTableData;
  onSubmit: (data: CreateUserInput) => Promise<void>;
};

export function UserEditModal({
  open,
  onOpenChange,
  user,
  onSubmit,
}: Readonly<UserEditModalProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
        </DialogHeader>
        <UserForm
          defaultValues={{
            fullName: user.fullName,
            email: user.email,
            role: user.role as CreateUserInput['role'],
            isActive: user.isActive,
            avatarUrl: user.avatarUrl || '',
          }}
          onSubmit={onSubmit}
          mode="edit"
        />
      </DialogContent>
    </Dialog>
  );
}
