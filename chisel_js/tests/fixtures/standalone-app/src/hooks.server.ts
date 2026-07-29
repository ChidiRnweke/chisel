export async function handle({ event, resolve }: { event: unknown; resolve: (e: unknown) => unknown }) {
  return resolve(event);
}
