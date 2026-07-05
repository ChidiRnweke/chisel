from chisel.checker.factory import CheckerFactory


class TestCheckerFactory:
    def test_factory_exposes_only_checker_construction(self):
        factory = CheckerFactory()
        assert {
            "create_controller": hasattr(factory, "create_controller"),
            "create_skill_setup_controller": hasattr(
                factory,
                "create_skill_setup_controller",
            ),
            "create_self_updater": hasattr(factory, "create_self_updater"),
        } == {
            "create_controller": True,
            "create_skill_setup_controller": False,
            "create_self_updater": False,
        }
