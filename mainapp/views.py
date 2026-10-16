import re

from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, F, Q, Value
from django.db.models.functions import Replace
from django_filters.rest_framework import DjangoFilterBackend
from drf_yasg.utils import swagger_auto_schema
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.filters import SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework.decorators import throttle_classes
from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from . import stock
from .auth_tokens import revoke_user_tokens
from .models import Author, Book, Category, Order, OrderItem, Profile, Review
from .password_reset import check_code, find_user, issue_code
from .pricing import calculate_totals, find_promo
from .serializer import (
    AddToCartSerializer, Author_Serializer, Book_Serializer, Category_Serializer,
    OrderSerializer, ProfileSerializer, RegisterSerializer, Review_Serializer,
)


""" BUYURTMA VA SAVAT """

MAX_ID = 2 ** 63 - 1  # SQLite/BigAutoField chegarasi: undan katta son bazaga berilsa OverflowError (500) chiqadi

class IPRateThrottle(SimpleRateThrottle):
    """ IP bo'yicha cheklov. AnonRateThrottle'dan farqi: tokeni bor so'rovni ham sanaydi
    (aks holda hujumchi istalgan yaroqli token yuborib cheklovdan o'tib ketardi). """

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class QuoteThrottle(IPRateThrottle):
    scope = 'quote'


class Order_ViewSet(viewsets.ReadOnlyModelViewSet):
    """ Foydalanuvchining o'z buyurtmalari (xaridlar tarixi) """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .exclude(status='pending')  # savat xaridlar tarixida ko'rinmaydi
            .prefetch_related('items__book', 'events')
            .order_by('-created_on')
        )


def get_cart(user):
    try:
        order, _ = Order.objects.get_or_create(user=user, status='pending')
    except IntegrityError:
        # Parallel so'rov savatni birinchi yaratib bo'ldi (unique cheklov): mavjudini olamiz
        order = Order.objects.get(user=user, status='pending')
    return order


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cart_detail(request):
    cart = get_cart(request.user)
    return Response(OrderSerializer(cart, context={'request': request}).data)


@swagger_auto_schema(method='post', request_body=AddToCartSerializer)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_cart(request):
    serializer = AddToCartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    book_id = serializer.validated_data['book_id']
    quantity = serializer.validated_data['quantity']

    try:
        book = Book.objects.get(id=book_id, status='active')
    except Book.DoesNotExist:
        return Response({'error': 'Kitob topilmadi'}, status=404)

    if not book.price or book.price <= 0:
        return Response({'error': 'Kitob sotuvda emas'}, status=400)
    if book.stock == 0:
        return Response({'error': 'Kitob tugagan'}, status=409)
    limit = 100 if book.stock is None else min(100, book.stock)

    with transaction.atomic():
        order = get_cart(request.user)
        item, created = OrderItem.objects.get_or_create(
            order=order, book=book, defaults={'quantity': min(quantity, limit)}
        )
        if not created:
            item.quantity = min(item.quantity + quantity, limit)
            item.save(update_fields=['quantity'])

    return Response({'message': "Savatga qo'shildi"}, status=200)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_from_cart(request, item_id):
    deleted, _ = OrderItem.objects.filter(
        id=item_id, order__user=request.user, order__status='pending'
    ).delete()
    if not deleted:
        return Response({'error': 'Topilmadi'}, status=404)
    return Response({'message': "O'chirildi"}, status=200)


PHONE_RE = re.compile(r'\+?[\d\s()\-]{7,24}')
DELIVERY_TEXT_FIELDS = ('recipient_name', 'recipient_phone', 'city', 'district', 'street', 'house', 'delivery_comment')
REQUIRED_DELIVERY = {
    'recipient_name': 'Ismni kiriting.',
    'recipient_phone': 'Telefon raqamini kiriting.',
    'city': 'Viloyat yoki shaharni kiriting.',
    'street': "Ko'cha yoki manzilni kiriting.",
}
IDEMPOTENCY_KEY_RE = re.compile(r'[A-Za-z0-9_.:\-]{8,80}')
PHONE_ERROR = "Telefon raqami noto'g'ri (kamida 9 ta raqam)."


class CheckoutItemSerializer(serializers.Serializer):
    book_id = serializers.IntegerField(min_value=1, max_value=MAX_ID)
    quantity = serializers.IntegerField(min_value=1, max_value=100)


class CheckoutSerializer(serializers.Serializer):
    items = CheckoutItemSerializer(many=True, allow_empty=False)
    promo_code = serializers.CharField(required=False, allow_blank=True, max_length=32)
    delivery_method = serializers.ChoiceField(
        choices=['pickup', 'delivery'],
        error_messages={'required': 'Qabul qilish usulini tanlang', 'null': 'Qabul qilish usulini tanlang',
                        'invalid_choice': 'Qabul qilish usulini tanlang'},
    )
    recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    recipient_phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)
    district = serializers.CharField(required=False, allow_blank=True, max_length=100)
    street = serializers.CharField(required=False, allow_blank=True, max_length=200)
    house = serializers.CharField(required=False, allow_blank=True, max_length=50)
    delivery_comment = serializers.CharField(required=False, allow_blank=True, max_length=300)
    # Xaritadagi nuqta (ixtiyoriy, ikkalasi birga)
    delivery_lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    delivery_lng = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)

    def validate(self, data):
        # Usul majburiy. Buyurtma berishda (strict) 'delivery' bo'lsa ism, telefon, shahar va ko'cha majburiy.
        for key in DELIVERY_TEXT_FIELDS:
            data[key] = data.get(key, '').strip()
        errors = {}
        phone = data['recipient_phone']
        if phone and (not PHONE_RE.fullmatch(phone) or len(re.sub(r'\D', '', phone)) < 9):
            errors['recipient_phone'] = PHONE_ERROR
        if self.context.get('strict') and data['delivery_method'] == 'delivery':
            for key, message in REQUIRED_DELIVERY.items():
                if not data[key]:
                    errors[key] = message
        lat, lng = data.get('delivery_lat'), data.get('delivery_lng')
        if (lat is None) != (lng is None):
            errors['delivery_lat'] = "Koordinata to'liq emas."
        if errors:
            raise serializers.ValidationError(errors)
        return data


def merge_quantities(entries):
    quantities = {}
    for entry in entries:
        book_id = entry['book_id']
        quantities[book_id] = min(quantities.get(book_id, 0) + entry['quantity'], 100)
    return quantities


@swagger_auto_schema(method='post', request_body=CheckoutSerializer)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([QuoteThrottle])
def quote(request):
    """ Savat hisob-kitobi: chegirma, yetkazib berish va to'lov summasi (kirish shart emas) """
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    quantities = merge_quantities(serializer.validated_data['items'])

    # Narxi yo'q (NULL yoki 0) kitob sotuvda emas: "missing" ga tushadi, bepul hisoblanmaydi
    books = {b.id: b for b in Book.objects.filter(id__in=quantities, status='active', price__gt=0).select_related('category')}
    subtotal = sum((books[book_id].price or 0) * qty for book_id, qty in quantities.items() if book_id in books)

    code = serializer.validated_data.get('promo_code', '')
    promo = find_promo(code)
    result = calculate_totals(subtotal, promo, serializer.validated_data['delivery_method'])
    # Qatorlar joriy narx bilan: mijoz savatdagi eski nom/narxni shu bilan yangilaydi (jami bilan bir manba)
    result['items'] = [
        {
            'id': book_id,
            'name': books[book_id].name,
            'price': books[book_id].price or 0,
            'photo': request.build_absolute_uri(books[book_id].photo.url) if books[book_id].photo else '',
            'category_name': books[book_id].category.name,
            'stock': books[book_id].stock,
            'quantity': qty,
            'line_total': (books[book_id].price or 0) * qty,
        }
        for book_id, qty in quantities.items() if book_id in books
    ]
    # Bazada yo'q yoki faol bo'lmagan kitoblar (savatdan olib tashlanadi)
    result['missing'] = [book_id for book_id in quantities if book_id not in books]
    result['promo'] = {'code': promo.code, 'percent': promo.discount_percent} if promo else None
    result['promo_valid'] = promo is not None or not code.strip()
    return Response(result)


@swagger_auto_schema(method='post', request_body=CheckoutSerializer)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def checkout(request):
    """ Buyurtma berish: yuborilgan kitoblardan tasdiqlangan buyurtma yaratadi """
    key = request.headers.get('Idempotency-Key')
    if key is not None:
        key = key.strip()
        if not IDEMPOTENCY_KEY_RE.fullmatch(key):
            return Response({'error': "Idempotency-Key noto'g'ri (8-80 belgi: harf, raqam, - _ . :)."}, status=400)
        # Shu kalit bilan buyurtma allaqachon berilgan: yangisini yaratmaymiz
        existing = Order.objects.filter(user=request.user, idempotency_key=key).first()
        if existing:
            return Response(OrderSerializer(existing, context={'request': request}).data, status=200)

    serializer = CheckoutSerializer(data=request.data, context={'strict': True})
    serializer.is_valid(raise_exception=True)

    quantities = merge_quantities(serializer.validated_data['items'])

    books = {b.id: b for b in Book.objects.filter(id__in=quantities, status='active')}
    missing = [book_id for book_id in quantities if book_id not in books]
    if missing:
        return Response({'error': f'Kitob topilmadi: {missing}'}, status=404)
    # Narxi yo'q (NULL yoki 0) kitob bepul sotilmasin
    unpriced = [books[book_id].name for book_id in quantities if not books[book_id].price]
    if unpriced:
        return Response({'error': f"Kitob hozir sotuvda emas: {', '.join(unpriced)}"}, status=400)

    code = serializer.validated_data.get('promo_code', '')
    promo = find_promo(code)
    if code.strip() and not promo:
        return Response({'promo_code': "Promo kod topilmadi yoki faol emas."}, status=400)

    subtotal = sum((books[book_id].price or 0) * qty for book_id, qty in quantities.items())
    data = serializer.validated_data
    method = data['delivery_method']
    totals = calculate_totals(subtotal, promo, method)
    # Olib ketishda manzil saqlanmaydi (faqat ixtiyoriy ism/telefon)
    address = {k: data[k] for k in ('city', 'district', 'street', 'house', 'delivery_comment')} if method == 'delivery' else {}
    if method == 'delivery' and data.get('delivery_lat') is not None:
        address['delivery_lat'] = round(data['delivery_lat'], 6)
        address['delivery_lng'] = round(data['delivery_lng'], 6)

    try:
        with transaction.atomic():
            shortages = stock.reserve(quantities)
            if not shortages:
                order = create_order(request, key, promo, totals, method, data, address, quantities, books)
    except IntegrityError:
        # Bir vaqtda kelgan ikkinchi so'rov shu kalit bilan buyurtmani birinchi yaratdi (ombor qaytarildi)
        existing = Order.objects.filter(user=request.user, idempotency_key=key).first() if key else None
        if not existing:
            raise
        return Response(OrderSerializer(existing, context={'request': request}).data, status=200)

    if shortages:
        return Response(
            {'error': "Omborda yetarli kitob yo'q.", 'items': shortages},
            status=409,
        )

    return Response(OrderSerializer(order, context={'request': request}).data, status=201)


def create_order(request, key, promo, totals, method, data, address, quantities, books):
    """ transaction.atomic() ichida: buyurtma + qatorlar yaratadi, savatdagi shu kitoblarni olib tashlaydi """
    order = Order.objects.create(
        user=request.user,
        status='confirmed',
        idempotency_key=key or None,
        promo_code=promo.code if promo else '',
        discount=totals['discount'],
        delivery_fee=totals['delivery_fee'],
        delivery_method=method,
        recipient_name=data['recipient_name'],
        recipient_phone=data['recipient_phone'],
        **address,
    )
    OrderItem.objects.bulk_create(
        OrderItem(order=order, book=books[book_id], quantity=qty,
                  price=books[book_id].price, cost_price=books[book_id].cost_price)
        for book_id, qty in quantities.items()
    )
    # Server savatidagi shu kitoblar endi buyurtmaga o'tdi
    OrderItem.objects.filter(
        order__user=request.user, order__status='pending', book_id__in=quantities
    ).delete()
    return order


""" USER LOGIN / REGISTER """

def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': {'username': user.username, 'email': user.email},
    }


class LoginThrottle(IPRateThrottle):
    scope = 'login'


class RegisterThrottle(IPRateThrottle):
    scope = 'register'


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    # Tana JSON massiv/matn bo'lsa .get() 500 berardi: faqat ob'ekt (yoki forma) qabul qilinadi
    if not isinstance(request.data, dict):
        return Response({'detail': "So'rov noto'g'ri."}, status=400)
    identifier = str(request.data.get('username', '')).strip()
    password = request.data.get('password', '')

    # Email bilan kirish: email takrorlanmasligi register'da tekshiriladi
    user = User.objects.filter(email__iexact=identifier).order_by('id').first() if '@' in identifier else None
    username = user.username if user else identifier
    authenticated_user = authenticate(username=username, password=password)

    if not authenticated_user:
        return Response(
            {'detail': "Username/email yoki parol noto'g'ri."},
            status=401,
        )
    update_last_login(None, authenticated_user)
    return Response(tokens_for(authenticated_user))


@swagger_auto_schema(method='post', request_body=RegisterSerializer)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            user = User.objects.create_user(**serializer.validated_data)
    except IntegrityError:  # bir vaqtda bir xil username bilan kelgan ikkinchi so'rov: 500 emas, 400
        raise serializers.ValidationError({'username': ['Bu username band.']})
    return Response(
        {'message': "Muvaffaqiyatli ro'yxatdan o'tildi", **tokens_for(user)},
        status=201,
    )


@swagger_auto_schema(method='post', request_body=LogoutSerializer)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """ Refresh tokenni blacklist'ga qo'shadi (shu qurilmadagi sessiya tugaydi). Access token muddati tugaguncha ishlaydi. """
    token = request.data.get('refresh') if isinstance(request.data, dict) else None
    invalid = Response({'detail': "Refresh token yaroqsiz."}, status=400)
    if not token or not isinstance(token, str):
        return invalid
    try:
        refresh = RefreshToken(token)  # imzo, muddat, tur va oldin bekor qilinmaganini tekshiradi
    except TokenError:
        return invalid
    # Birovning tokenini bekor qila olmaysiz
    if str(refresh.payload.get(jwt_settings.USER_ID_CLAIM)) != str(request.user.pk):
        return invalid
    refresh.blacklist()
    return Response(status=205)


""" PAROLNI TIKLASH (emailga yuboriladigan tasdiqlash kodi bilan) """

class PasswordThrottle(IPRateThrottle):
    scope = 'password'


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=10)
    password = serializers.CharField(write_only=True)


@swagger_auto_schema(method='post', request_body=ForgotPasswordSerializer)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordThrottle])
def password_forgot(request):
    """ Emailga 6 xonali kod yuboradi. Email ro'yxatdan o'tganmi yoki yo'qmi, javob bir xil. """
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = find_user(serializer.validated_data['email'])
    if user:
        issue_code(user)

    return Response({
        'message': "Agar bu email ro'yxatdan o'tgan bo'lsa, tasdiqlash kodi yuborildi.",
        'resend_after': settings.PASSWORD_RESET_RESEND_SECONDS,
    })


@swagger_auto_schema(method='post', request_body=ResetPasswordSerializer)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordThrottle])
def password_reset(request):
    """ Email, kod va yangi parol bilan parolni almashtiradi. """
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    user = find_user(data['email'])
    record = check_code(user, data['code']) if user else None
    if record is None:
        return Response({'code': "Kod noto'g'ri yoki muddati o'tgan."}, status=400)

    try:
        validate_password(data['password'], user)
    except DjangoValidationError as error:
        return Response({'password': list(error.messages)}, status=400)

    with transaction.atomic():
        user.set_password(data['password'])
        user.save(update_fields=['password'])
        user.reset_codes.all().delete()
        # Parol o'zgardi: barcha qurilmalardagi sessiyalar tugaydi (refresh tokenlar blacklist'ga)
        revoke_user_tokens(user)
    return Response({'message': "Parol yangilandi. Endi tizimga kirishingiz mumkin."})


""" KATALOG (kitob, muallif, kategoriya): hamma ko'radi, faqat admin o'zgartiradi """

class CatalogThrottle(AnonRateThrottle):
    scope = 'catalog'


# Apostrof variantlari: ' U+2018 U+2019 U+02BB U+02BC U+00B4 `
APOSTROPHES = ("'", '‘', '’', 'ʻ', 'ʼ', '´', '`')


def strip_apostrophes(text):
    for ch in APOSTROPHES:
        text = text.replace(ch, '')
    return text


class UzSearchFilter(SearchFilter):
    """ Qidiruv: bo'shliqlar e'tiborsiz, barcha apostrof variantlari (O'/Oʻ/O‘/O’/o`) va apostrofsiz yozuv bir xil.
    Bazadagi qiymat ham, so'rov ham apostrofsiz holatda icontains bilan solishtiriladi (bitta SQL so'rov). """

    def filter_queryset(self, request, queryset, view):
        fields = self.get_search_fields(view, request)
        terms = [strip_apostrophes(t) for t in self.get_search_terms(request)]
        terms = [t for t in terms if t]
        if not fields or not terms:
            return queryset

        aliases = {}
        for index, field in enumerate(fields):
            expr = F(field.lstrip('^=@$'))
            for ch in APOSTROPHES:
                expr = Replace(expr, Value(ch), Value(''))
            aliases[f'_srch{index}'] = expr
        queryset = queryset.annotate(**aliases)

        condition = Q()
        for term in terms:
            term_q = Q()
            for alias in aliases:
                term_q |= Q(**{f'{alias}__icontains': term})
            condition &= term_q
        return queryset.filter(condition)


class CatalogViewSet(viewsets.ModelViewSet):
    throttle_classes = [CatalogThrottle]
    filter_backends = [DjangoFilterBackend, UzSearchFilter]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAdminUser()]


class Category_ViewSet(CatalogViewSet):
    queryset = Category.objects.all().order_by('id')
    serializer_class = Category_Serializer
    filterset_fields = ['name', 'status']
    search_fields = ['name']


class Author_ViewSet(CatalogViewSet):
    queryset = Author.objects.all().order_by('id')
    serializer_class = Author_Serializer
    filterset_fields = ['full_name', 'status']
    search_fields = ['full_name']


class Book_ViewSet(CatalogViewSet):
    # Reyting va sharhlar soni bitta so'rovda hisoblanadi (har kitob uchun alohida so'rov emas)
    queryset = (
        Book.objects.select_related('category', 'author')
        .annotate(avg_rating=Avg('reviews__rating'), reviews_count=Count('reviews', distinct=True))
        .order_by('id')
    )
    serializer_class = Book_Serializer
    filterset_fields = ['name', 'author', 'category', 'status']
    search_fields = ['name', 'author__full_name', 'category__name']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Nofaol kitoblar faqat adminga ko'rinadi (oddiy foydalanuvchiga 404 / ro'yxatda yo'q)
        if not self.request.user.is_staff:
            queryset = queryset.filter(status='active')
        return queryset


""" SHARHLAR """

def parse_id_param(value, name):
    """ So'rov parametridagi id ni xavfsiz songa aylantiradi: bo'sh -> None, noto'g'ri -> 400 """
    if value is None or str(value).strip() == '':
        return None
    try:
        number = int(str(value).strip())
    except ValueError:
        number = 0
    if not 0 < number <= MAX_ID:
        raise serializers.ValidationError({name: f"{name} noto'g'ri."})
    return number


class Review_ViewSet(viewsets.ModelViewSet):
    serializer_class = Review_Serializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        queryset = Review.objects.select_related('user').all()
        book_id = parse_id_param(self.request.query_params.get('book'), 'book')
        if book_id is not None:
            queryset = queryset.filter(book_id=book_id)
        if self.action not in ('list', 'retrieve'):
            queryset = queryset.filter(user=self.request.user)
        return queryset

    def get_permissions(self):
        permission_class = AllowAny if self.action in ('list', 'retrieve') else IsAuthenticated
        return [permission_class()]

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        review = self.get_queryset().filter(book_id=parse_id_param(request.query_params.get('book'), 'book')).first()
        if not review:
            return Response(None)
        return Response(self.get_serializer(review).data)

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                serializer.save(user=self.request.user)
        except IntegrityError:
            # Ikki so'rov bir vaqtda kelsa validate() ikkalasini ham o'tkazadi, bazadagi unique esa ikkinchisini to'xtatadi
            raise serializers.ValidationError({'non_field_errors': ['Siz bu kitobga allaqachon sharh yozgansiz.']})


""" PROFIL """

def profile_data(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return {
        'username': user.username,
        'email': user.email,
        'full_name': profile.full_name,
        'phone': profile.phone,
        'address': profile.address,
        'bio': profile.bio,
    }


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    user = request.user
    if request.method == 'PATCH':
        serializer = ProfileSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile, _ = Profile.objects.get_or_create(user=user)
        for field in ('full_name', 'phone', 'address', 'bio'):
            if field in data:
                setattr(profile, field, data[field])
        profile.save()
        if data.get('email'):
            user.email = data['email']
            user.save(update_fields=['email'])
    return Response(profile_data(user))
