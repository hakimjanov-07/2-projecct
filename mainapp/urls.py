from django.urls import include, path
from rest_framework import routers

from .views import (
    Author_ViewSet, Book_ViewSet, Category_ViewSet, Order_ViewSet, Review_ViewSet,
    add_to_cart, cart_detail, checkout, my_profile, quote, remove_from_cart,
)

# Routers provide an easy way of automatically determining the URL conf.
router = routers.DefaultRouter()
router.register(r"category", Category_ViewSet)
router.register(r"author", Author_ViewSet)
router.register(r"book", Book_ViewSet)
router.register(r"review", Review_ViewSet, basename='review')
router.register(r"order", Order_ViewSet, basename='order')

urlpatterns = [
    path("", include(router.urls)),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    path('profile/', my_profile),
    path('cart/', cart_detail),
    path('cart/add/', add_to_cart),
    path('cart/checkout/', checkout),
    path('cart/quote/', quote),
    path('cart/remove/<int:item_id>/', remove_from_cart),
]
