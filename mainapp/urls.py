from django.urls import include, path
from rest_framework import routers

from .digital import book_digital, book_file
from .panel_export import export_csv
from .panel_promos import PanelPromoDetail, PanelPromoList
from .panel import (
    PanelBookDetail, PanelBookList, PanelOrderDetail, PanelOrderList, PanelUserList,
    panel_login, panel_new_orders_count, panel_summary, panel_user_detail,
)
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
    path('book/<int:pk>/digital/', book_digital),
    path('files/<str:token>/', book_file),
    path("", include(router.urls)),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    path('profile/', my_profile),
    path('panel/login/', panel_login),
    path('panel/summary/', panel_summary),
    path('panel/orders/', PanelOrderList.as_view()),
    path('panel/orders/new-count/', panel_new_orders_count),
    path('panel/orders/<int:pk>/', PanelOrderDetail.as_view()),
    path('panel/books/', PanelBookList.as_view()),
    path('panel/books/<int:pk>/', PanelBookDetail.as_view()),
    path('panel/users/', PanelUserList.as_view()),
    path('panel/users/<int:pk>/', panel_user_detail),
    path('panel/promos/', PanelPromoList.as_view()),
    path('panel/promos/<int:pk>/', PanelPromoDetail.as_view()),
    path('panel/export/<str:kind>/', export_csv),
    path('cart/', cart_detail),
    path('cart/add/', add_to_cart),
    path('cart/checkout/', checkout),
    path('cart/quote/', quote),
    path('cart/remove/<int:item_id>/', remove_from_cart),
]
