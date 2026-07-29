import { describe, test, expect } from "bun:test";
import { Layer } from "chisel/checker/models/layer";

describe("Layer", () => {
  test("Layer.MODELS is models", () => {
    expect(Layer.MODELS).toBe("models");
  });
  test("Layer.ERRORS is errors", () => {
    expect(Layer.ERRORS).toBe("errors");
  });
  test("Layer.CONFIG is config", () => {
    expect(Layer.CONFIG).toBe("config");
  });
  test("Layer.SERVICES is services", () => {
    expect(Layer.SERVICES).toBe("services");
  });
  test("Layer.REPOSITORIES is repositories", () => {
    expect(Layer.REPOSITORIES).toBe("repositories");
  });
  test("Layer.CONTROLLERS is controllers", () => {
    expect(Layer.CONTROLLERS).toBe("controllers");
  });
  test("Layer.FACTORY is factory", () => {
    expect(Layer.FACTORY).toBe("factory");
  });
  test("Layer.ROUTES is routes", () => {
    expect(Layer.ROUTES).toBe("routes");
  });
  test("Layer.REMOTE is remote", () => {
    expect(Layer.REMOTE).toBe("remote");
  });
  test("Layer.HOOKS is hooks", () => {
    expect(Layer.HOOKS).toBe("hooks");
  });
  test("Layer.STORES is stores", () => {
    expect(Layer.STORES).toBe("stores");
  });
  test("Layer.CLIENT is client", () => {
    expect(Layer.CLIENT).toBe("client");
  });
  test("Layer.COMPONENTS is components", () => {
    expect(Layer.COMPONENTS).toBe("components");
  });
  test("Layer.UNKNOWN is unknown", () => {
    expect(Layer.UNKNOWN).toBe("unknown");
  });
});
