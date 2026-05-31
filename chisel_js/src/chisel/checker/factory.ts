import { CheckController } from "chisel/checker/controllers/check_controller";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { ComponentEnforcementService } from "chisel/checker/services/svelte/component_enforcement";
import { ColourEnforcementService } from "chisel/checker/services/svelte/colour_enforcement";
import { ImportBoundaryService as SvelteImportBoundaryService } from "chisel/checker/services/svelte/import_boundary";
import { ComplexityService } from "chisel/checker/services/svelte/complexity";
import { ApiEndpointsService } from "chisel/checker/services/svelte/api_endpoints";
import { ConcurrencyService } from "chisel/checker/services/svelte/concurrency";
import { ErrorFlowService } from "chisel/checker/services/svelte/error_flow";
import { ResponsivenessService } from "chisel/checker/services/svelte/responsiveness";
import { TestStructureService } from "chisel/checker/services/shared/test_structure";
import { ProjectStructureService } from "chisel/checker/services/shared/project_structure";

export class CheckerFactory {
  createController(): CheckController {
    return new CheckController([
      new StructuralSvelteService(),
      new ComponentEnforcementService(),
      new ColourEnforcementService(),
      new SvelteImportBoundaryService(),
      new ComplexityService(),
      new ApiEndpointsService(),
      new ConcurrencyService(),
      new ErrorFlowService(),
      new ResponsivenessService(),
      new TestStructureService(),
      new ProjectStructureService(),
    ]);
  }
}
