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
  test("Layer.DEPENDENCIES is dependencies", () => {
    expect(Layer.DEPENDENCIES).toBe("dependencies");
  });
  test("Layer.ERROR_HANDLERS is error_handlers", () => {
    expect(Layer.ERROR_HANDLERS).toBe("error_handlers");
  });
  test("Layer.APP_FILE is app_file", () => {
    expect(Layer.APP_FILE).toBe("app_file");
  });
  test("Layer.UNKNOWN is unknown", () => {
    expect(Layer.UNKNOWN).toBe("unknown");
  });
});
