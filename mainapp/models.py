from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

STATUS = (
    ('active', 'Faol'),
    ('deactive', 'Faol emas')
)

LANGUAGE = (
    ("uzbek", "O'zbekcha"),
    ("russian", "Ruscha"),
    ("english", "Inglizcha"),
    ("turkish", "Turkcha"),
    ("german", "Nemischa"),
    ("others", "Boshqa til")
)

# Create your models here.
class Category(models.Model):
    """ Klass """
    name = models.CharField(max_length=50, verbose_name='Nomi:')

    status = models.CharField(choices=STATUS,verbose_name='Holati:')
    created_on = models.DateTimeField(auto_now_add=True,verbose_name='Kritilgan sana:')

    def __str__(self):
        return self.name

class Author(models.Model):
    """ Klass """
    full_name = models.CharField(max_length=100,verbose_name='Ism Familiya:')
    photo = models.ImageField(upload_to='photo_author/', verbose_name='Rasmi', null=True, blank=True)
    about = models.TextField(verbose_name='Haqida:')

    status = models.CharField(choices=STATUS, verbose_name='Holati:')
    created_on = models.DateTimeField(auto_now_add=True, verbose_name='Kiritilgan sana:')

    def __str__(self):
        return self.full_name
    
class Book(models.Model):
    """ Klass """

    name = models.CharField(max_length=50, verbose_name='Nomi:')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='book')
    author = models.ForeignKey(Author, on_delete=models.CASCADE, related_name='book')
    language = models.CharField(choices=LANGUAGE, verbose_name='Tili:')
    price = models.PositiveIntegerField(verbose_name='Narxi:', null=True, blank=True)
    about = models.TextField(verbose_name='Batafsil:')
    publisher = models.CharField(max_length=100, verbose_name='Nashriyotchi:')
    pages = models.PositiveIntegerField(verbose_name='Sahifalar soni:')
    audio_file = models.FileField(upload_to='audio_file/', verbose_name='Audio fayl:', null=True, blank=True)
    pdf_file = models.FileField(upload_to='pdf_file/', verbose_name='PDF fayl:', null=True, blank=True)
    photo = models.ImageField(upload_to='photo_book/', verbose_name='Raasmi:')
    # Ombordagi soni. Bo'sh = qoldiq hisoblanmaydi (cheklanmagan), 0 = tugagan
    stock = models.PositiveIntegerField(null=True, blank=True, verbose_name='Ombordagi soni:')

    status = models.CharField(choices=STATUS, verbose_name='Holati:')
    created_on = models.DateTimeField(auto_now_add=True, verbose_name='Kiritilgan sana:')

    def __str__(self):
        return self.name


class PromoCode(models.Model):
    """ Chegirma uchun promo kod (admin paneldan boshqariladi) """
    code = models.CharField(max_length=32, unique=True, verbose_name='Kod:')
    discount_percent = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        verbose_name='Chegirma (%):',
    )
    is_active = models.BooleanField(default=True, verbose_name='Faol:')
    created_on = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} (-{self.discount_percent}%)"


class PasswordResetCode(models.Model):
    """ Parolni tiklash uchun emailga yuboriladigan bir martalik tasdiqlash kodi (faqat hash saqlanadi) """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_codes')
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_on = models.DateTimeField(auto_now_add=True)
    expires_on = models.DateTimeField()

    class Meta:
        ordering = ['-created_on']

    def __str__(self):
        return f"{self.user.username} ({self.created_on:%Y-%m-%d %H:%M})"


class Order(models.Model):
    # pending - savat (buyurtma emas). Buyurtma bosqichlari: confirmed -> processing -> shipped -> delivered.
    STATUS = (
        ('pending', 'Savat'),
        ('confirmed', 'Tasdiqlangan'),
        ('processing', "Yig'ilmoqda"),
        ('shipped', "Yo'lda"),
        ('delivered', 'Yetkazildi'),
        ('cancelled', 'Bekor qilingan'),
    )
    STAGES = ('confirmed', 'processing', 'shipped', 'delivered')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    promo_code = models.CharField(max_length=32, blank=True, default='')
    discount = models.PositiveIntegerField(default=0)
    delivery_fee = models.PositiveIntegerField(default=0)
    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.status}"

class OrderEvent(models.Model):
    """ Buyurtma holati o'zgarishlari tarixi (kuzatuv chizig'i uchun) """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='events')
    status = models.CharField(max_length=20, choices=Order.STATUS)
    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_on', 'id']

    def __str__(self):
        return f"#{self.order_id} -> {self.status}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    # Buyurtma berilgan paytdagi narx (savatdagi qatorlarda bo'sh: joriy narx olinadi)
    price = models.PositiveIntegerField(null=True, blank=True, verbose_name='Sotuv narxi:')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['order', 'book'], name='unique_book_per_order'),
        ]

    @property
    def unit_price(self):
        """ Buyurtmadagi narx; saqlanmagan bo'lsa kitobning joriy narxi """
        return self.price if self.price is not None else (self.book.price or 0)

    def __str__(self):
        return f"{self.book.name} x {self.quantity}"

class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='book_reviews')
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField()
    photo = models.ImageField(upload_to='photo_reviews/', null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_on']
        constraints = [
            models.UniqueConstraint(fields=['user', 'book'], name='unique_review_per_user_book'),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.book.name} ({self.rating}/5)"


class Profile(models.Model):
    """ Foydalanuvchi profili (email User jadvalida saqlanadi) """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=150, blank=True, default='', verbose_name='Ism Familiya:')
    phone = models.CharField(max_length=32, blank=True, default='', verbose_name='Telefon:')
    address = models.CharField(max_length=255, blank=True, default='', verbose_name='Manzil:')
    bio = models.TextField(max_length=1000, blank=True, default='', verbose_name='Haqida:')

    def __str__(self):
        return self.user.username
