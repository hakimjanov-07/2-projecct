"""
JWT tokenlarni bekor qilish:
- parol o'zgarsa eski access/refresh tokenlar ishlamaydi (tokenga parol hash'i yoziladi: CHECK_REVOKE_TOKEN)
- logout va parolni tiklashda refresh tokenlar blacklist'ga tushadi (token_blacklist ilovasi)
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.utils import get_md5_hash_password
from rest_framework_simplejwt.views import TokenRefreshView


def revoke_user_tokens(user):
    """ Foydalanuvchining hali amal qilayotgan barcha refresh tokenlarini blacklist'ga qo'shadi """
    tokens = OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now())
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in tokens],
        ignore_conflicts=True,  # allaqachon bekor qilingani qayta yozilmaydi
    )


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """ Oddiy yangilashdan farqi: parol o'zgargan (yoki tokenida parol belgisi yo'q) refresh uchun access bermaydi.
    Aks holda klient "yangilandi" deb o'ylab, lekin har so'rovda 401 olib qolardi; endi 401 bilan sessiyani tozalaydi. """

    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])  # imzo, muddat va blacklist tekshiruvi (xato -> 401)
        user = get_user_model().objects.filter(**{api_settings.USER_ID_FIELD: refresh.payload.get(api_settings.USER_ID_CLAIM)}).first()
        if user is None or not api_settings.USER_AUTHENTICATION_RULE(user):
            raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')
        if api_settings.CHECK_REVOKE_TOKEN and refresh.get(api_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password):
            raise AuthenticationFailed("Parol o'zgargan: qaytadan kiring.", 'password_changed')
        return super().validate(attrs)


class SafeTokenRefreshView(TokenRefreshView):
    serializer_class = SafeTokenRefreshSerializer
