from django.apps import AppConfig


class MainappConfig(AppConfig):
    name = 'mainapp'

    def ready(self):
        from . import signals  # noqa: F401
