// ANTI-PATTERN: a *-factory.ts exporting two values. One module, one thing.
export const createNoteReader = () => ({ read: () => [] });
export const noteReaderCatalog = { entries: [] };
