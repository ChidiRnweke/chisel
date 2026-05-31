import { describe, test, expect } from "bun:test";
import { Layer } from "chisel/checker/models/layer";

describe("Layer", () => {
  test("has all architectural layers", () => {
    expect(Layer.MODELS).toBe("models");
    expect(Layer.ERRORS).toBe("errors");
    expect(Layer.CONFIG).toBe("config");
    expect(Layer.SERVICES).toBe("services");
    expect(Layer.REPOSITORIES).toBe("repositories");
    expect(Layer.CONTROLLERS).toBe("controllers");
    expect(Layer.FACTORY).toBe("factory");
    expect(Layer.ROUTES).toBe("routes");
    expect(Layer.DEPENDENCIES).toBe("dependencies");
    expect(Layer.ERROR_HANDLERS).toBe("error_handlers");
    expect(Layer.APP_FILE).toBe("app_file");
    expect(Layer.UNKNOWN).toBe("unknown");
  });
});
