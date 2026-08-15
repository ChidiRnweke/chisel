import { NoteManagement } from "./management";

// ANTI-PATTERN: a test double that declares no interface, so it drifts silently.
class FakeNotesRepository {
  list() {
    return [];
  }
}

test("returns the notes the repository holds", () => {
  // ANTI-PATTERN: the cast silences the error saying the fake is incomplete.
  const management = new NoteManagement({} as unknown as FakeNotesRepository);
  expect(management.list()).toEqual([]);
});

test("passes the note it was given to the repository", () => {
  // ANTI-PATTERN: asserting on wiring rather than on behaviour.
  expect(saveSpy).toHaveBeenCalledWith({ id: "n1" });
});
