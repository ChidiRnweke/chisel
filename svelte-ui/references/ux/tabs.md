# Tabs

**Signature:** Parallel contexts or views held in suspension on a single screen. Users switch between these views without losing their position or uncommitted state in any of them.

## When to Use & Why
Use the Tabs pattern to group related but mutually exclusive content or configurations within the same overall context (e.g., "General", "Security", and "Billing" settings for a user profile).
**Why:** It flattens the navigation hierarchy, allowing users to jump laterally between peers without going back to a parent menu.

## UX Rules

### Do
* **Keep Alive:** Preserve form state and scroll position when switching tabs. Never silently discard unsubmitted user input when a user clicks a different tab.
* **URL Sync (Optional but Recommended):** If tabs represent major views that users might want to link directly to, sync the active tab to the URL (e.g., `?tab=settings` or sub-routes like `/project/settings`).
* **Visual Clarity:** Ensure the active tab is unambiguously highlighted (usually with a strong underline or background change) while inactive tabs look clickable.

### Don't
* **Nested Tabs:** Never put tabs inside tabs. It completely destroys the user's mental model of the hierarchy. If you need more depth, use a Sidebar/Master-Detail or Drill Down pattern.
* **Overcrowd:** If you have more than 5-6 tabs, they will overflow on mobile. Consider an alternative pattern or a dropdown/select fallback for mobile views.

## Implementation Guide (Code & UX POV)

Implementing tabs correctly means handling keyboard navigation (Left/Right arrows) and aria attributes (`role="tablist"`, `aria-selected`, etc.). Using a headless library is highly recommended over building from scratch.

### Recommended shadcn-svelte Components
* `Tabs` (which includes `TabsList`, `TabsTrigger`, and `TabsContent`). This handles all accessibility and state management out of the box.

### Component Recipe: `SettingsTabs.svelte`

```svelte
<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
</script>

<div class="max-w-2xl mx-auto mt-8">
  <Tabs.Root value="account" class="w-full">
    <!-- Tab Navigation -->
    <Tabs.List class="grid w-full grid-cols-3 mb-8">
      <Tabs.Trigger value="account">Account</Tabs.Trigger>
      <Tabs.Trigger value="password">Password</Tabs.Trigger>
      <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
    </Tabs.List>

    <!-- Tab Content: Account -->
    <Tabs.Content value="account" class="space-y-6 bg-card p-6 border border-border rounded-xl shadow-sm">
      <div>
        <h3 class="text-lg font-medium text-foreground">Account Settings</h3>
        <p class="text-sm text-muted-foreground">Update your account details here.</p>
      </div>
      <div class="space-y-2">
        <Label for="name">Name</Label>
        <Input id="name" value="Jane Doe" />
      </div>
      <div class="space-y-2">
        <Label for="username">Username</Label>
        <Input id="username" value="@janedoe" />
      </div>
      <Button>Save changes</Button>
    </Tabs.Content>

    <!-- Tab Content: Password -->
    <Tabs.Content value="password" class="space-y-6 bg-card p-6 border border-border rounded-xl shadow-sm">
      <div>
        <h3 class="text-lg font-medium text-foreground">Change Password</h3>
        <p class="text-sm text-muted-foreground">Ensure your account is using a long, random password.</p>
      </div>
      <div class="space-y-2">
        <Label for="current">Current Password</Label>
        <Input id="current" type="password" />
      </div>
      <div class="space-y-2">
        <Label for="new">New Password</Label>
        <Input id="new" type="password" />
      </div>
      <Button>Update password</Button>
    </Tabs.Content>

    <!-- Tab Content: Notifications -->
    <Tabs.Content value="notifications" class="space-y-6 bg-card p-6 border border-border rounded-xl shadow-sm">
      <div>
        <h3 class="text-lg font-medium text-foreground">Notifications</h3>
        <p class="text-sm text-muted-foreground">Configure how you receive alerts.</p>
      </div>
      <div class="flex items-center justify-between border-b border-border pb-4">
        <div class="space-y-0.5">
          <Label>Email Notifications</Label>
          <p class="text-sm text-muted-foreground">Receive emails about your account activity.</p>
        </div>
        <Switch checked={true} />
      </div>
      <div class="flex items-center justify-between pb-4">
        <div class="space-y-0.5">
          <Label>Marketing Emails</Label>
          <p class="text-sm text-muted-foreground">Receive emails about new products and features.</p>
        </div>
        <Switch checked={false} />
      </div>
    </Tabs.Content>
  </Tabs.Root>
</div>
```
