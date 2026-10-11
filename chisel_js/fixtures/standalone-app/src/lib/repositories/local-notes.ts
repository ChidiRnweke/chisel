// ANTI-PATTERN: a repository at a universal path. Database repositories belong
// under $lib/server/repositories/, browser ones under $lib/client/repositories/.
export class LocalNotes {
  readonly notes: string[] = [];
}
