export interface ManagedUser {
  id: string;
  email: string | null;
  displayLabel: string;
  isActive: boolean;
  roleKeys: string[];
}

export interface RoleOption {
  role_key: string;
  label: string;
  is_staff: boolean;
  sort_order: number;
}
