from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.models import User
from django.db import transaction
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
from rest_framework.throttling import AnonRateThrottle
from rest_framework.decorators import throttle_classes
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Author, Book, Category, Order, OrderItem, Profile, Review
from .password_reset import check_code, find_user, issue_code
from .pricing import calculate_totals, find_promo
from .serializer import (
    AddToCartSerializer, Author_Serializer, Book_Serializer, Category_Serializer,
    OrderSerializer, ProfileSerializer, RegisterSerializer, Review_Serializer,
)


""" BUYURTMA VA SAVAT """

class Order_ViewSet(viewsets.ReadOnlyModelViewSet):
    """ Foydalanuvchining o'z buyurtmalari (xaridlar tarixi) """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related('items__book')
            .order_by('-created_on')
        )


def get_cart(user):
    order, _ = Order.objects.get_or_create(user=user, status='pending')
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

    with transaction.atomic():
        order = get_cart(request.user)
        item, created = OrderItem.objects.get_or_create(
            order=order, book=book, defaults={'quantity': quantity}
        )
        if not created:
            item.quantity = min(item.quantity + quantity, 100)
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


class CheckoutItemSerializer(serializers.Serializer):
    book_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=100)


class CheckoutSerializer(serializers.Serializer):
    items = CheckoutItemSerializer(many=True, allow_empty=False)
    promo_code = serializers.CharField(required=False, allow_blank=True, max_length=32)


def merge_quantities(entries):
    quantities = {}
    for entry in entries:
        book_id = entry['book_id']
        quantities[book_id] = min(quantities.get(book_id, 0) + entry['quantity'], 100)
    return quantities


@swagger_auto_schema(method='post', request_body=CheckoutSerializer)
@api_view(['POST'])
@permission_classes([AllowAny])
def quote(request):
    """ Savat hisob-kitobi: chegirma, yetkazib berish va to'lov summasi (kirish shart emas) """
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    quantities = merge_quantities(serializer.validated_data['items'])

    books = {b.id: b for b in Book.objects.filter(id__in=quantities, status='active')}
    subtotal = sum((books[book_id].price or 0) * qty for book_id, qty in quantities.items() if book_id in books)

    code = serializer.validated_data.get('promo_code', '')
    promo = find_promo(code)
    result = calculate_totals(subtotal, promo)
    result['promo'] = {'code': promo.code, 'percent': promo.discount_percent} if promo else None
    result['promo_valid'] = promo is not None or not code.strip()
    return Response(result)


@swagger_auto_schema(method='post', request_body=CheckoutSerializer)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def checkout(request):
    """ Buyurtma berish: yuborilgan kitoblardan tasdiqlangan buyurtma yaratadi """
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    quantities = merge_quantities(serializer.validated_data['items'])

    books = {b.id: b for b in Book.objects.filter(id__in=quantities, status='active')}
    missing = [book_id for book_id in quantities if book_id not in books]
    if missing:
        return Response({'error': f'Kitob topilmadi: {missing}'}, status=404)

    code = serializer.validated_data.get('promo_code', '')
    promo = find_promo(code)
    if code.strip() and not promo:
        return Response({'promo_code': "Promo kod topilmadi yoki faol emas."}, status=400)

    subtotal = sum((books[book_id].price or 0) * qty for book_id, qty in quantities.items())
    totals = calculate_totals(subtotal, promo)

    with transaction.atomic():
        order = Order.objects.create(
            user=request.user,
            status='confirmed',
            promo_code=promo.code if promo else '',
            discount=totals['discount'],
            delivery_fee=totals['delivery_fee'],
        )
        OrderItem.objects.bulk_create(
            OrderItem(order=order, book=books[book_id], quantity=qty, price=books[book_id].price)
            for book_id, qty in quantities.items()
        )
        # Server savatidagi shu kitoblar endi buyurtmaga o'tdi
        OrderItem.objects.filter(
            order__user=request.user, order__status='pending', book_id__in=quantities
        ).delete()

    return Response(OrderSerializer(order, context={'request': request}).data, status=201)


""" USER LOGIN / REGISTER """

def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': {'username': user.username, 'email': user.email},
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
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
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = User.objects.create_user(**serializer.validated_data)
    return Response(
        {'message': "Muvaffaqiyatli ro'yxatdan o'tildi", **tokens_for(user)},
        status=201,
    )


""" PAROLNI TIKLASH (emailga yuboriladigan tasdiqlash kodi bilan) """

class PasswordThrottle(AnonRateThrottle):
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

    user.set_password(data['password'])
    user.save(update_fields=['password'])
    user.reset_codes.all().delete()
    return Response({'message': "Parol yangilandi. Endi tizimga kirishingiz mumkin."})


""" KATALOG (kitob, muallif, kategoriya): hamma ko'radi, faqat admin o'zgartiradi """

class CatalogThrottle(AnonRateThrottle):
    scope = 'catalog'


class CatalogViewSet(viewsets.ModelViewSet):
    throttle_classes = [CatalogThrottle]
    filter_backends = [DjangoFilterBackend, SearchFilter]

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
    queryset = Book.objects.select_related('category', 'author').prefetch_related('reviews').order_by('id')
    serializer_class = Book_Serializer
    filterset_fields = ['name', 'author', 'category', 'status']
    search_fields = ['name', 'author__full_name', 'category__name']


""" SHARHLAR """

class Review_ViewSet(viewsets.ModelViewSet):
    serializer_class = Review_Serializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        queryset = Review.objects.select_related('user').all()
        book_id = self.request.query_params.get('book')
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        if self.action not in ('list', 'retrieve'):
            queryset = queryset.filter(user=self.request.user)
        return queryset

    def get_permissions(self):
        permission_class = AllowAny if self.action in ('list', 'retrieve') else IsAuthenticated
        return [permission_class()]

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        review = self.get_queryset().filter(book_id=request.query_params.get('book')).first()
        if not review:
            return Response(None)
        return Response(self.get_serializer(review).data)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
