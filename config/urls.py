"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from mainapp.auth_tokens import SafeTokenRefreshView
from mainapp.views import login, logout, password_forgot, password_reset, register

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.urls import re_path
from rest_framework import permissions
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Swagger: lokalda (DEBUG=True) hamma uchun ochiq; productionda faqat is_staff foydalanuvchiga
# (brauzerda /admin/ orqali kirgan admin, yoki Bearer JWT). Anonim foydalanuvchi 401/403 oladi.
schema_view = get_schema_view(
   openapi.Info(
      title="Book Shop API",
      default_version='v1',
      description="Book Shop API Documentation",
   ),
   public=True,
   permission_classes=(permissions.AllowAny,) if settings.DEBUG else (permissions.IsAdminUser,),
   authentication_classes=(JWTAuthentication, SessionAuthentication),
)



urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/", include("mainapp.urls")),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('api/token/', login),                                # login
    path('api/token/refresh/', SafeTokenRefreshView.as_view()),   # token yangilash (parol o'zgargan bo'lsa 401)
    path('api/logout/', logout),                              # refresh tokenni bekor qilish
    path('api/register/', register),
    path('api/password/forgot/', password_forgot),
    path('api/password/reset/', password_reset),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


