from django.urls import path, include
from django.contrib.auth.models import User
from rest_framework import routers, serializers, viewsets
from .views import Category_ViewSet, Author_ViewSet, Book_ViewSet




# Routers provide an easy way of automatically determining the URL conf.
router = routers.DefaultRouter()
router.register(r"category", Category_ViewSet)
router.register(r"author", Author_ViewSet)
router.register(r"book", Book_ViewSet)

# Wire up our API using automatic URL routing.
# Additionally, we include login URLs for the browsable API.
urlpatterns = [
    path("", include(router.urls)),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]