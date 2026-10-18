"use client";

import { useActionState } from "react";
import {
  changeRoleAction,
  createUserAction,
  resetPasswordAction,
  setActiveAction,
} from "./actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_OPTIONS = [
  ["ADMIN", "Admin"],
  ["COORDINATOR", "Coordinator"],
  ["CO_TEACHER", "Co-Teacher"],
];
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS);
const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50";
const INITIAL = { ok: null, message: "" };

function RoleSelect(props) {
  return (
    <select className={SELECT_CLASS} {...props}>
      {ROLE_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, {
    ok: null,
    message: "",
    values: { name: "", email: "", role: "CO_TEACHER" },
  });
  const values = state.values ?? { name: "", email: "", role: "CO_TEACHER" };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a user</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-name">Full name</Label>
            <Input id="new-name" name="name" defaultValue={values.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              name="email"
              type="email"
              defaultValue={values.email}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-role">Role</Label>
            <RoleSelect id="new-role" name="role" defaultValue={values.role} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Temporary password (min 10 characters)</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FormStatus state={state} />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create user"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, isSelf }) {
  const [roleState, roleAction, changingRole] = useActionState(changeRoleAction, INITIAL);
  const [activeState, activeAction, changingActive] = useActionState(setActiveAction, INITIAL);
  const [passwordState, passwordAction, resetting] = useActionState(resetPasswordAction, INITIAL);
  const busy = changingRole || changingActive || resetting;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{user.name}</span>
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {ROLE_LABELS[user.role]}
        </span>
        <span
          className={
            user.isActive
              ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
              : "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
          }
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
        {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <RoleSelect
            name="role"
            defaultValue={user.role}
            disabled={isSelf || busy}
            aria-label={`Role for ${user.name}`}
          />
          <Button type="submit" variant="outline" size="sm" disabled={isSelf || busy}>
            Update role
          </Button>
        </form>

        <form action={activeAction}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="isActive" value={String(!user.isActive)} />
          <Button type="submit" variant="outline" size="sm" disabled={isSelf || busy}>
            {user.isActive ? "Deactivate" : "Activate"}
          </Button>
        </form>

        <form action={passwordAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            minLength={10}
            required
            className="w-44"
            aria-label={`New password for ${user.name}`}
          />
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            Reset password
          </Button>
        </form>
      </div>

      <FormStatus state={roleState} />
      <FormStatus state={activeState} />
      <FormStatus state={passwordState} />
    </div>
  );
}

export default function UserManagement({ users, currentUserId }) {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Create accounts, set roles, deactivate users, and reset passwords.
        </p>
      </div>

      <CreateUserForm />

      <div className="space-y-3">
        {users.map((user) => (
          <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
        ))}
      </div>
    </div>
  );
}