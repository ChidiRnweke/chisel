// ANTI-PATTERN: a universal load reaching into a server module. Erased for
// neither bundle — this one really does leak.
import { buildControllers } from "$lib/server/app-factory";

export const load = () => ({ built: buildControllers() });
