# Matrix

**Signature:** An addressable 2D grid structure (a table or spreadsheet). Relationships exist both horizontally (attributes of a record) and vertically (comparisons across records). Designed for high-density reading and manipulation.

## When to Use & Why
Use the Matrix pattern for data tables, financial ledgers, bulk data entry, or comparing complex feature sets.
**Why:** It is the most efficient way to present highly structured, uniformly formatted data. It allows users to scan down columns to compare values across entities easily.

## UX Rules

### Do
* **Sticky Headers:** The top row (column labels) and often the first column (record identifiers) MUST be sticky when scrolling so context is never lost.
* **Alignment Matters:** Right-align numbers (for easy decimal scanning), left-align text, and center-align distinct icons/badges.
* **High Density:** Tighter whitespace than usual UI elements. This is a power-user surface; prioritize data visibility over airy aesthetics.
* **Keyboard Navigation:** If the matrix is editable, arrow key focus movement between cells is required, not optional.

### Don't
* **Card Fallacy:** No card styling within the matrix. Use strict borders or subtle zebra-striping only.
* **Mobile Squeeze:** Never force a complex, multi-column matrix to shrink horizontally onto a small mobile screen. Provide a horizontal scroll or restructure the data into a List/Card fallback layout for narrow viewports.

## Implementation Guide (Code & UX POV)

A Matrix is fundamentally an HTML `<table>`. For advanced use cases (sorting, filtering, pagination), integrating a library like `@tanstack/svelte-table` is highly recommended.

### Recommended shadcn-svelte Components
* `Table` (provides the styled semantic HTML table parts: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`)
* `DropdownMenu` (for row-level action menus, usually in the last column)
* `Checkbox` (for bulk row selection)

### Component Recipe: `DataMatrix.svelte`

```svelte
<script lang="ts">
  import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
  } from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { MoreHorizontal } from "lucide-svelte";

  let data = [
    { id: "INV001", status: "Paid", method: "Credit Card", amount: "$250.00" },
    { id: "INV002", status: "Pending", method: "PayPal", amount: "$150.00" },
    { id: "INV003", status: "Unpaid", method: "Bank Transfer", amount: "$350.00" },
    { id: "INV004", status: "Paid", method: "Credit Card", amount: "$450.00" },
  ];
</script>

<div class="rounded-md border border-border bg-background shadow-sm overflow-hidden">
  <!-- The wrapper needs overflow-auto for horizontal scrolling on smaller screens -->
  <div class="w-full overflow-auto max-h-[600px] relative">
    <Table>
      <TableHeader class="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 shadow-[0_1px_0_var(--border)]">
        <TableRow class="hover:bg-transparent">
          <TableHead class="w-[100px] font-semibold text-foreground">Invoice</TableHead>
          <TableHead class="font-semibold text-foreground">Status</TableHead>
          <TableHead class="font-semibold text-foreground">Method</TableHead>
          <!-- Numbers right aligned -->
          <TableHead class="text-right font-semibold text-foreground">Amount</TableHead>
          <TableHead class="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each data as row (row.id)}
          <TableRow>
            <TableCell class="font-medium">{row.id}</TableCell>
            <TableCell>
              <Badge variant={row.status === 'Paid' ? 'default' : row.status === 'Pending' ? 'secondary' : 'destructive'} class="font-normal">
                {row.status}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{row.method}</TableCell>
            <TableCell class="text-right font-mono">{row.amount}</TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" class="size-8">
                <span class="sr-only">Open menu</span>
                <MoreHorizontal class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>
</div>
```
