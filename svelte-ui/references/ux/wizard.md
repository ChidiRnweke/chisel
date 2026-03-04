# Wizard

**Signature:** Linear, opinionated sequencing of a complex task. Users are guided through one explicit decision or form section per screen. Order matters.

## When to Use & Why
Use the Wizard pattern for complex setups, onboarding, checkout flows, or multi-step form submissions (e.g., tax filing, software installation).
**Why:** It reduces cognitive overload by breaking a massive task into bite-sized, validated chunks. It forces a specific flow, ensuring users don't skip prerequisites.

## UX Rules

### Do
* **Validation Gates:** Disable the "Next" button or show inline errors if the current step is invalid. Users should never reach the end only to find out step 1 was wrong.
* **Persist Progress:** If the user refreshes the page, they must not lose their work. Sync step state to the URL or `sessionStorage`, and form state to a robust store.
* **Clear Orientation:** Always show a step indicator (e.g., "Step 2 of 4"). Users must know how long the process will take and where they currently are.

### Don't
* **Global Navigation:** Remove the main application header, sidebar, and footer. The wizard must own the screen entirely to prevent accidental abandonment.
* **Hidden Back Button:** Always provide a "Back" button (except on step 1). Users will make mistakes and need to review previous choices.

## Implementation Guide (Code & UX POV)

A Wizard is a state machine controlling which component is rendered. Managing global state across the steps is the primary challenge.

### Recommended shadcn-svelte Components
* `Progress` (for a visual progress bar across the top)
* `Button` (for Next/Back navigation)
* Various form inputs (`Input`, `Select`, `RadioGroup`) for the steps.

### Component Recipe: `WizardLayout.svelte`

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Progress } from "$lib/components/ui/progress";
  import { Check, ChevronLeft, ChevronRight } from "lucide-svelte";

  let { 
    currentStep = 1, 
    totalSteps = 4, 
    canNext = true, 
    onNext, 
    onBack,
    children
  } = $props<{
    currentStep: number;
    totalSteps: number;
    canNext: boolean;
    onNext: () => void;
    onBack: () => void;
    children: any;
  }>();

  let progressValue = $derived((currentStep / totalSteps) * 100);
</script>

<div class="min-h-screen flex flex-col bg-background">
  <!-- Header & Progress -->
  <header class="border-b border-border bg-card p-6 shrink-0 flex flex-col items-center justify-center gap-4 shadow-sm">
    <div class="flex items-center gap-2">
      <div class="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
        {currentStep}
      </div>
      <span class="text-muted-foreground font-medium">of {totalSteps}</span>
    </div>
    
    <div class="w-full max-w-md">
      <Progress value={progressValue} class="h-2" />
    </div>
  </header>

  <!-- Step Content -->
  <main class="flex-1 w-full max-w-2xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
    <div class="bg-card border border-border rounded-xl shadow-sm p-8 min-h-[400px]">
      {@render children()}
    </div>
  </main>

  <!-- Navigation Footer -->
  <footer class="border-t border-border bg-card p-6 shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
    <div class="max-w-2xl mx-auto flex justify-between items-center">
      <Button
        variant="outline"
        onclick={onBack}
        disabled={currentStep === 1}
        class="w-32"
      >
        <ChevronLeft class="size-4 mr-2" />
        Back
      </Button>
      
      <Button
        onclick={onNext}
        disabled={!canNext}
        class="w-32"
      >
        {#if currentStep === totalSteps}
          <Check class="size-4 mr-2" /> Finish
        {:else}
          Next <ChevronRight class="size-4 ml-2" />
        {/if}
      </Button>
    </div>
  </footer>
</div>
```
