from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Avg
from rest_framework import serializers

from .models import Category, Book, Author, Order, OrderEvent, OrderItem, Review


class Category_Serializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "status", "created_on"]


class Author_Serializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ["id", "full_name", 'photo', 'about', "status", "created_on"]


class Book_Serializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    avg_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    has_audio = serializers.SerializerMethodField()
    has_pdf = serializers.SerializerMethodField()

    def get_has_audio(self, obj):
        return bool(obj.audio_file)

    def get_has_pdf(self, obj):
        return bool(obj.pdf_file)

    def get_avg_rating(self, obj):
        avg = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(avg, 1) if avg is not None else 0

    def get_reviews_count(self, obj):
        return obj.reviews.count()

    class Meta:
        model = Book
        fields = [
            "id", "name", 'category', 'author', 'language', 'price', 'about', 'publisher',
            'pages', 'audio_file', 'pdf_file', 'photo', "status", "created_on", 'stock',
            'author_name', 'category_name', 'avg_rating', 'reviews_count', 'has_audio', 'has_pdf',
        ]
        # Fayllar ommaga ochiq emas: ularni faqat admin yuklaydi, o'qish /api/book/<id>/digital/ orqali
        extra_kwargs = {'audio_file': {'write_only': True}, 'pdf_file': {'write_only': True}}


class OrderItemSerializer(serializers.ModelSerializer):
    book_name = serializers.CharField(source='book.name', read_only=True)
    book_photo = serializers.SerializerMethodField()
    price = serializers.IntegerField(source='unit_price', read_only=True)

    def get_book_photo(self, obj):
        request = self.context.get('request')
        if obj.book.photo and request:
            return request.build_absolute_uri(obj.book.photo.url)
        return None

    class Meta:
        model = OrderItem
        fields = ['id', 'book', 'book_name', 'book_photo', 'price', 'quantity']


class OrderEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderEvent
        fields = ['status', 'created_on']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    total_price = serializers.SerializerMethodField()

    def get_total_items(self, obj):
        return sum(item.quantity for item in obj.items.all())

    def get_subtotal(self, obj):
        return sum(item.unit_price * item.quantity for item in obj.items.all())

    def get_total_price(self, obj):
        # To'lov summasi: mahsulotlar - chegirma + yetkazib berish
        return self.get_subtotal(obj) - obj.discount + obj.delivery_fee

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'status', 'items', 'total_items', 'subtotal',
            'promo_code', 'discount', 'delivery_fee', 'total_price', 'created_on', 'events',
            'delivery_method', 'recipient_name', 'recipient_phone', 'city', 'district',
            'street', 'house', 'delivery_comment',
        ]
        read_only_fields = [
            'user', 'status', 'delivery_method', 'recipient_name', 'recipient_phone',
            'city', 'district', 'street', 'house', 'delivery_comment',
        ]


class AddToCartSerializer(serializers.Serializer):
    book_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=100, default=1)


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Bu username band.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Bu email allaqachon ro\'yxatdan o\'tgan.')
        return value

    def validate(self, attrs):
        user = User(username=attrs['username'], email=attrs['email'])
        try:
            validate_password(attrs['password'], user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': list(error.messages)})
        return attrs


class Review_Serializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    photo_url = serializers.SerializerMethodField()

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        photo_url = obj.photo.url
        return request.build_absolute_uri(photo_url) if request else photo_url

    def validate_book(self, value):
        if self.instance and value != self.instance.book:
            raise serializers.ValidationError('Sharh kitobini o\'zgartirib bo\'lmaydi.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        book = attrs.get('book')
        if not self.instance and request and book and Review.objects.filter(user=request.user, book=book).exists():
            raise serializers.ValidationError('Siz bu kitobga allaqachon sharh yozgansiz.')
        return attrs

    class Meta:
        model = Review
        fields = ['id', 'book', 'user', 'username', 'rating', 'comment', 'photo', 'photo_url', 'created_on']
        read_only_fields = ['user', 'created_on']


class ProfileSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, allow_blank=True, required=False)
    address = serializers.CharField(max_length=255, allow_blank=True, required=False)
    bio = serializers.CharField(max_length=1000, allow_blank=True, required=False)

    def validate_email(self, value):
        user = self.context['request'].user
        if value and User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Bu email boshqa foydalanuvchida bor.")
        return value
