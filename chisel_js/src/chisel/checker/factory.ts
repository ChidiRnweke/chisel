import type { CheckerConfig } from "chisel/checker/config";
import type { CheckerService } from "chisel/checker/controllers/check_controller";
import type { IImportGraph } from "chisel/checker/repositories/protocols";
import { CheckController } from "chisel/checker/controllers/check_controller";
import { CheckerMode } from "chisel/checker/models/mode";
import { ImportGraph } from "chisel/checker/repositories/import_graph";
import { SuppressionService } from "chisel/checker/services/shared/suppression";
import { defaultConfig } from "chisel/checker/config";

import { ImportBoundaryService } from "chisel/checker/services/architecture/import_boundary";
import { LayoutService } from "chisel/checker/services/architecture/layout";
import { ServerLayerLeakService } from "chisel/checker/services/architecture/server_layer_leak";
import { TopologyService } from "chisel/checker/services/architecture/topology";

import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { ComponentEnforcementService } from "chisel/checker/services/svelte/component_enforcement";
import { ColourEnforcementService } from "chisel/checker/services/svelte/colour_enforcement";
import { ApiEndpointsService } from "chisel/checker/services/svelte/api_endpoints";
import { ErrorFlowService } from "chisel/checker/services/svelte/error_flow";
import { RouteStyleService } from "chisel/checker/services/svelte/route_style";
import { TestStructureService } from "chisel/checker/services/shared/test_structure";
import { ProjectStructureService } from "chisel/checker/services/shared/project_structure";
import { CoherenceService } from "chisel/checker/services/shared/coherence";

export interface CheckerFactoryOptions {
  readonly config?: CheckerConfig;
  readonly importGraph?: IImportGraph;
}

export class CheckerFactory {
  /**
   * Compose the checker for a project.
   *
   * The service list varies with `mode` in exactly one way: the BFF-only rules
   * (the generated API client's location, and the api-route ratio) describe a
   * topology a standalone app does not have, so they are left out rather than
   * firing nonsense. Every other rule — including the whole design-system
   * rule set — runs in both modes and cannot be turned off.
   */
  static createController(options: CheckerFactoryOptions = {}): CheckController {
    const config = options.config ?? defaultConfig();
    const importGraph = options.importGraph ?? new ImportGraph(config.tsconfig);

    const services: CheckerService[] = [
      new ImportBoundaryService(importGraph, config.mode),
      new ServerLayerLeakService(importGraph),
      new LayoutService(),
      new TopologyService(importGraph),

      new StructuralSvelteService(),
      new ComponentEnforcementService(config.designSystem.allowIn),
      new ColourEnforcementService(),
      new ErrorFlowService(),
      new TestStructureService(),
      new ProjectStructureService(),
      new CoherenceService(),
    ];

    if (config.mode === CheckerMode.BFF) {
      services.push(new ApiEndpointsService());
    } else {
      // A standalone app has remote functions; a BFF does not, so there is
      // nothing to prefer over an API route there.
      services.push(new RouteStyleService());
    }

    return new CheckController({
      services,
      config,
      importGraph,
      suppression: new SuppressionService(),
    });
  }
}
