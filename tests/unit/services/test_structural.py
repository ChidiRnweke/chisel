from __future__ import annotations

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


class TestFutureAnnotations:
    def test_detects_missing_future_annotations_import(self):
        source = "x = 1\n"
        violations = _check_source(source)
        _assert_one_error(violations, "missing-future-annotations")

    def test_accepts_future_annotations_import(self):
        source = "from __future__ import annotations\nx = 1\n"
        violations = _check_source(source)
        _assert_no_error(violations)


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


class TestFreeFunctionsInServices:
    def test_detects_free_function_in_services_layer(self):
        source = 'from __future__ import annotations\ndef helper(): pass\n'
        violations = _check_source(source, layer=Layer.SERVICES)
        _assert_one_error(violations, "free-function-services")

    def test_accepts_class_methods_in_services_layer(self):
        source = (
            'from __future__ import annotations\n'
            'class MyService:\n'
            '    def check(self): pass\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "free-function-services") == 0

    def test_accepts_runtime_checkable_decorated_function_in_services(self):
        source = (
            'from __future__ import annotations\n'
            'from typing import Protocol, runtime_checkable\n'
            '@runtime_checkable\n'
            'class IMyService(Protocol):\n'
            '    def check(self): ...\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "free-function-services") == 0


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
        _assert_one_error(violations, "misplaced-dataclass")

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


class TestMatchCase:
    def test_detects_match_case_outside_error_handlers(self):
        source = (
            'from __future__ import annotations\n'
            'class Foo:\n'
            '    def bar(self, x):\n'
            '        match x:\n'
            '            case 1: pass\n'
        )
        violations = _check_source(source, layer=Layer.SERVICES)
        assert _count_rule(violations, "match-case-location") == 1


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
        _assert_one_error(violations, "bare-column-banned")


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
