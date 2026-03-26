# Conversational

## Table of Contents

- [When to Use & Why](#when-to-use--why)
- [UX Rules](#ux-rules)
  - [Do](#do)
  - [Don't](#dont)
- [Implementation Guide (Code & UX POV)](#implementation-guide-code--ux-pov)
  - [Recommended shadcn-svelte Components](#recommended-shadcn-svelte-components)
  - [Component Recipe: `ChatThread.svelte`](#component-recipe-chatthreadsvelte)

**Signature:** Single persistent thread of chronological interaction. Input and output share the same surface. Stateful back-and-forth between user and system or user and user.

## When to Use & Why
Use the Conversational pattern for chatbots, AI assistants, messaging apps, and linear, turn-based workflows. 
**Why:** It leverages users' deep familiarity with texting apps. It's excellent for step-by-step guidance, natural language queries, and preserving the history of a task or inquiry contextually.

## UX Rules

### Do
* **Auto-scroll:** New messages must scroll the viewport to the bottom automatically, keeping the latest context in focus.
* **Optimistic UI:** Display the user's message immediately after submission, before the server confirms it. Use loading states for the system's response.
* **Explicit States:** Handle "Typing…", "Sending…", and "Failed to send" states explicitly so the user is never left guessing.
* **Focus Management:** Keep focus on the input field after a message is sent to allow continuous typing.

### Don't
* **Full Refresh:** Never reload the page to send or receive a message.
* **Trapped Focus:** Allow `Shift+Enter` to insert a newline in the input box, reserving `Enter` for submission.

## Implementation Guide (Code & UX POV)

A conversational UI requires a sticky bottom input, an auto-scrolling message list, and distinct visual treatments for different message roles (user vs. assistant/other).

### Recommended shadcn-svelte Components
* `Avatar` (for user and assistant icons)
* `ScrollArea` (for the message thread, if not using native window scroll)
* `Textarea` (auto-resizing for multi-line inputs)
* `Button` (for sending messages, often with an icon)

### Component Recipe: `ChatThread.svelte`

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
  import { Send } from "lucide-svelte";

  type Message = { id: string; role: 'user' | 'assistant'; content: string };
  let { messages } = $props<{ messages: Message[] }>();
  
  let viewport: HTMLDivElement;
  let inputValue = $state("");

  // Auto-scroll to bottom when messages change
  $effect(() => {
    if (messages && viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // handle submit logic here
      inputValue = "";
    }
  }
</script>

<div class="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
  <!-- Message thread -->
  <div bind:this={viewport} class="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
    {#each messages as msg (msg.id)}
      <div class="flex gap-3 {msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
        <Avatar class="size-8 shrink-0">
          <AvatarFallback>{msg.role === 'user' ? 'U' : 'AI'}</AvatarFallback>
        </Avatar>
        <div class="
          max-w-[80%] px-4 py-3 text-sm leading-relaxed rounded-2xl
          {msg.role === 'user'
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'}
        ">
          {msg.content}
        </div>
      </div>
    {/each}
  </div>

  <!-- Input area -->
  <div class="p-4 bg-background border-t border-border">
    <div class="relative flex items-end gap-2">
      <Textarea
        bind:value={inputValue}
        onkeydown={handleKeydown}
        placeholder="Type a message…"
        class="min-h-[44px] max-h-32 resize-none rounded-2xl pr-12"
        rows={1}
      />
      <Button 
        size="icon" 
        class="absolute right-2 bottom-2 rounded-full size-8"
        disabled={!inputValue.trim()}
      >
        <Send class="size-4" />
      </Button>
    </div>
  </div>
</div>
```
