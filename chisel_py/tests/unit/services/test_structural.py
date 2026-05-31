
import ast

import pytest

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.structural import StructuralService

def _file_info(source: str, layer: Layer, name: str = "test_file.py") -> FileInfo:
    info = FileInfo(
        path=__import__("pathlib").Path(name),
        layer=layer,
        source=source,
    )
    info.ast_tree = ast.parse(source)
    return info

def _check_source(source: str, layer: Layer = Layer.UNKNOWN, name: str = "test_file.py") -> list:
    service = StructuralService()
    file = _file_info(source, layer, name=name)
    project = ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        files=[file],
    )
    return service.check(project)

def _assert_one_error(violations: list, rule_suffix: str) -> None:
    assert len(violations) == 1
    assert violations[0].rule_id == f"structural:{rule_suffix}"

def _assert_no_error(violations: list) -> None:
    assert len(violations) == 0

def _count_rule(violations: list, rule_suffix: str) -> int:
    return sum(1 for v in violations if v.rule_id == f"structural:{rule_suffix}")

class TestImportImportsNotAtTop:
    def test_detects_import_after_non_import_statement(self):
        source = 'from __future__ import annotations\nx = 1\nimport os\n'
        violations = _check_source(source)
        assert _count_rule(violations, "import-not-at-top") == 1

    def test_accepts_all_imports_at_top(self):
        source = 'from __future__ import annotations\nimport os\nimport sys\nx = 1\n'
        violations = _check_source(source)
        assert _count_rule(violations, "import-not-at-top") == 0

class TestGetattrSetattr:
    def test_detects_getattr_call(self):
        source = "from __future__ import annotations\ngetattr(None, 'x')\n"
        violations = _check_source(source)
        _assert_one_error(violations, "getattr-setattr-banned")

    def test_detects_setattr_call(self):
        source = "from __future__ import annotations\nsetattr(None, 'x', 1)\n"
        violations = _check_source(source)
        _assert_one_error(violations, "getattr-setattr-banned")

class TestPercentInterpolation:
    def test_detects_percent_string_interpolation(self):
        source = 'from __future__ import annotations\nx = "hello %s" % name\n'
        violations = _check_source(source)
        _assert_one_error(violations, "percent-interpolation-banned")

class TestLoggerFstring:
    def test_detects_fstring_in_logger_call(self):
        source = 'from __future__ import annotations\nlogger.ainfo(f"value: {x}")\n'
        violations = _check_source(source)
        _assert_one_error(violations, "logger-fstring")

class TestPrintBan:
    def test_detects_print_call(self):
        source = 'from __future__ import annotations\nprint("hello")\n'
        violations = _check_source(source)
        _assert_one_error(violations, "print-banned")

class TestDataclassSlots:
    def test_detects_dataclass_without_slots_true(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass\n'
            'class Foo:\n'
            '    x: int\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "dataclass-no-slots")

    def test_accepts_dataclass_with_slots_true(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class Foo:\n'
            '    x: int\n'
        )
        violations = _check_source(source)
        _assert_no_error(violations)

class TestMisplacedDataclass:
    def test_detects_dataclass_with_no_methods_in_services(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class Foo:\n'
            '    x: int\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "misplaced-dataclass") == 1

    def test_accepts_dataclass_with_methods_in_services(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class MyService:\n'
            '    x: int\n'
            '    def check(self): pass\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "misplaced-dataclass") == 0

class TestLoggerDataclassField:
    def test_detects_logger_as_dataclass_field(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class MyService:\n'
            '    logger: object\n'
            '    def check(self): pass\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "logger-dataclass-field")

class TestAppErrorRules:
    def test_detects_app_error_raised_directly(self):
        source = (
            'from __future__ import annotations\n'
            'raise AppError("bad")\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "app-error-direct-raise")

    def test_detects_app_error_subclass_with_http_status(self):
        source = (
            'from __future__ import annotations\n'
            'class AppError(Exception): pass\n'
            'class MyError(AppError):\n'
            '    status_code = 404\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "app-error-http-status")

class TestTryExceptRoutes:
    def test_detects_try_except_in_routes(self):
        source = (
            'from __future__ import annotations\n'
            'def get_users():\n'
            '    try:\n'
            '        pass\n'
            '    except Exception:\n'
            '        pass\n'
        )
        violations = _check_source(source, layer=Layer.ROUTES)
        _assert_one_error(violations, "try-except-routes")

class TestAppFactory:
    def test_detects_staticmethod_in_app_factory(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class CheckerFactory:\n'
            '    @staticmethod\n'
            '    def create(): pass\n'
        )
        violations = _check_source(source, layer=Layer.FACTORY)
        _assert_one_error(violations, "factory-no-staticmethod")

    def test_detects_conditional_logic_in_app_factory(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class CheckerFactory:\n'
            '    def create(self):\n'
            '        if True:\n'
            '            pass\n'
        )
        violations = _check_source(source, layer=Layer.FACTORY)
        _assert_one_error(violations, "factory-zero-logic")

class TestOrmMapped:
    def test_detects_bare_column_instead_of_mapped(self):
        source = (
            'from __future__ import annotations\n'
            'class UserORM:\n'
            '    id = Column(Integer)\n'
        )
        violations = _check_source(source, layer=Layer.REPOSITORIES)
        assert _count_rule(violations, "bare-column-banned") == 1

class TestServiceProtocols:
    def test_detects_missing_protocol_for_service(self):
        source = (
            'from __future__ import annotations\n'
            'class MyService:\n'
            '    def check(self): pass\n'
        )
        info = _file_info(source, layer=Layer.SERVICES, name="my_service.py")
        project = ProjectInfo(
            root_path=__import__("pathlib").Path("."),
            files=[info],
        )
        service = StructuralService()
        violations = service.check(project)
        assert _count_rule(violations, "missing-protocol") == 1

    def test_accepts_service_with_corresponding_protocol(self):
        source = (
            'from __future__ import annotations\n'
            'from typing import Protocol, runtime_checkable\n'
            '@runtime_checkable\n'
            'class IMyService(Protocol):\n'
            '    def check(self): ...\n'
            '\n'
            'class MyService:\n'
            '    def check(self): pass\n'
        )
        info = _file_info(source, layer=Layer.SERVICES, name="my_service.py")
        project = ProjectInfo(
            root_path=__import__("pathlib").Path("."),
            files=[info],
        )
        service = StructuralService()
        violations = service.check(project)
        assert _count_rule(violations, "missing-protocol") == 0

class TestNestedImportDetection:
    def test_detects_import_inside_function_body(self):
        source = (
            'from __future__ import annotations\n'
            'def foo():\n'
            '    import os\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

    def test_detects_import_inside_method_body(self):
        source = (
            'from __future__ import annotations\n'
            'class Foo:\n'
            '    def bar(self):\n'
            '        import os\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

    def test_detects_import_inside_if_block(self):
        source = (
            'from __future__ import annotations\n'
            'def foo():\n'
            '    if True:\n'
            '        import os\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

    def test_detects_import_inside_for_loop(self):
        source = (
            'from __future__ import annotations\n'
            'def foo():\n'
            '    for x in range(1):\n'
            '        import os\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

    def test_detects_import_inside_try_block(self):
        source = (
            'from __future__ import annotations\n'
            'def foo():\n'
            '    try:\n'
            '        import os\n'
            '    except Exception:\n'
            '        pass\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

    def test_detects_import_inside_with_block(self):
        source = (
            'from __future__ import annotations\n'
            'def foo():\n'
            '    with open("f") as f:\n'
            '        import os\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

class TestTypeCheckingGuardAllowed:
    def test_allows_import_inside_type_checking_block(self):
        source = (
            'from __future__ import annotations\n'
            'from typing import TYPE_CHECKING\n'
            'if TYPE_CHECKING:\n'
            '    import os\n'
        )
        violations = _check_source(source)
        _assert_no_error(violations)

    def test_detects_import_inside_non_type_checking_if_at_top_level(self):
        source = (
            'from __future__ import annotations\n'
            'import os\n'
            'if True:\n'
            '    import sys\n'
        )
        violations = _check_source(source)
        _assert_one_error(violations, "import-not-at-top-nested")

class TestDataclassServiceProtocol:
    def test_detects_missing_protocol_for_dataclass_service(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class MyService:\n'
            '    def check(self): pass\n'
        )
        info = _file_info(source, layer=Layer.SERVICES, name="my_service.py")
        project = ProjectInfo(
            root_path=__import__("pathlib").Path("."),
            files=[info],
        )
        service = StructuralService()
        violations = service.check(project)
        assert _count_rule(violations, "missing-protocol") == 1

class TestAppErrorAttributeRaise:
    def test_detects_app_error_via_attribute_access(self):
        source = (
            'from __future__ import annotations\n'
            'raise errors.AppError("bad")\n'
        )
        violations = _check_source(source)
        assert _count_rule(violations, "app-error-direct-raise") == 1

class TestHttpExceptionLocation:
    def test_detects_http_exception_import_outside_error_handlers(self):
        source = (
            'from __future__ import annotations\n'
            'from fastapi import HTTPException\n'
        )
        violations = _check_source(source, layer=Layer.ROUTES)
        assert _count_rule(violations, "http-exception-location") == 1

    def test_accepts_http_exception_import_in_error_handlers(self):
        source = (
            'from __future__ import annotations\n'
            'from fastapi import HTTPException\n'
        )
        violations = _check_source(source, layer=Layer.ERROR_HANDLERS)
        assert _count_rule(violations, "http-exception-location") == 0

    def test_detects_starlette_http_exception_import(self):
        source = (
            'from __future__ import annotations\n'
            'from starlette.exceptions import HTTPException\n'
        )
        violations = _check_source(source, layer=Layer.ROUTES)
        assert _count_rule(violations, "http-exception-location") == 1

class TestConcreteServiceImport:
    def test_detects_concrete_service_import_outside_factory(self):
        source = (
            'from __future__ import annotations\n'
            'from myapp.services.user import UserService\n'
        )
        violations = _check_source(source, layer=Layer.CONTROLLERS)
        assert _count_rule(violations, "concrete-service-import") == 1

    def test_accepts_protocol_import_from_services(self):
        source = (
            'from __future__ import annotations\n'
            'from myapp.services.user import IUserService\n'
        )
        violations = _check_source(source, layer=Layer.CONTROLLERS)
        assert _count_rule(violations, "concrete-service-import") == 0

    def test_accepts_concrete_service_import_in_factory(self):
        source = (
            'from __future__ import annotations\n'
            'from myapp.services.user import UserService\n'
        )
        violations = _check_source(source, layer=Layer.FACTORY)
        assert _count_rule(violations, "concrete-service-import") == 0


class TestImportErrorTryAllowed:
    def test_allows_import_inside_try_except_importerror(self):
        source = (
            'try:\n'
            '    import tomllib\n'
            'except ImportError:\n'
            '    import tomli as tomllib\n'
        )
        violations = _check_source(source)
        nested = _count_rule(violations, "import-not-at-top-nested")
        assert nested == 0

    def test_detects_import_inside_non_importerror_try(self):
        source = (
            'try:\n'
            '    import os\n'
            'except Exception:\n'
            '    pass\n'
        )
        violations = _check_source(source)
        nested = _count_rule(violations, "import-not-at-top-nested")
        assert nested == 1


class TestToplevelFunctionInServices:
    def test_detects_toplevel_function_in_services(self):
        source = (
            'from __future__ import annotations\n'
            'def helper():\n'
            '    pass\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "toplevel-function-in-service") == 1

    def test_detects_toplevel_async_function_in_services(self):
        source = (
            'from __future__ import annotations\n'
            'async def helper():\n'
            '    pass\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "toplevel-function-in-service") == 1

    def test_allows_toplevel_function_in_routes(self):
        source = (
            'from __future__ import annotations\n'
            'def get_users():\n'
            '    pass\n'
        )
        violations = _check_source(source, layer=Layer.ROUTES)
        assert _count_rule(violations, "toplevel-function-in-service") == 0

    def test_allows_class_methods_in_services(self):
        source = (
            'from __future__ import annotations\n'
            'from dataclasses import dataclass\n'
            '@dataclass(slots=True)\n'
            'class MyService:\n'
            '    def check(self): pass\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "toplevel-function-in-service") == 0


class TestStatusCodeLocation:
    def test_detects_status_import_from_fastapi_outside_error_handlers(self):
        source = (
            'from __future__ import annotations\n'
            'from fastapi import status\n'
        )
        violations = _check_source(source, layer=Layer.ROUTES)
        assert _count_rule(violations, "status-code-location") == 1

    def test_detects_status_import_from_starlette_outside_error_handlers(self):
        source = (
            'from __future__ import annotations\n'
            'from starlette import status\n'
        )
        violations = _check_source(source, layer=Layer.ROUTES)
        assert _count_rule(violations, "status-code-location") == 1

    def test_allows_status_import_in_error_handlers(self):
        source = (
            'from __future__ import annotations\n'
            'from fastapi import status\n'
        )
        violations = _check_source(source, layer=Layer.ERROR_HANDLERS)
        assert _count_rule(violations, "status-code-location") == 0


class TestDescribeRules:
    def test_structural_describes_all_its_rules(self):
        service = StructuralService()
        rules = service.describe_rules()
        assert len(rules) > 15
        rule_ids = {r.id for r in rules}
        assert "structural:print-banned" in rule_ids
        assert "structural:isinstance-banned" in rule_ids
        assert "structural:missing-protocol" in rule_ids
        assert "structural:dataclass-no-frozen" in rule_ids
        assert "structural:match-case-location" in rule_ids
        assert "structural:toplevel-function-in-service" in rule_ids
        assert "structural:status-code-location" in rule_ids
        assert all(r.category == "structural" for r in rules)

    def test_rule_info_has_valid_structure(self):
        service = StructuralService()
        rules = service.describe_rules()
        for r in rules:
            assert len(r.id) > 0
            assert r.id.startswith("structural:")
            assert len(r.description) > 0
            assert len(r.fix_guidance) > 0

