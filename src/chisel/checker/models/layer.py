
from enum import Enum


class Layer(Enum):
    MODELS = "models"
    ERRORS = "errors"
    CONFIG = "config"
    SERVICES = "services"
    REPOSITORIES = "repositories"
    CONTROLLERS = "controllers"
    FACTORY = "factory"
    ROUTES = "routes"
    DEPENDENCIES = "dependencies"
    ERROR_HANDLERS = "error_handlers"
    APP_FILE = "app_file"
    UTILS = "utils"
    TESTS = "tests"
    UNKNOWN = "unknown"
