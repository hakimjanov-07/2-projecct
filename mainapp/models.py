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

    status = models.CharField(choices=STATUS, verbose_name='Holati:')
    created_on = models.DateTimeField(auto_now_add=True, verbose_name='Kiritilgan sana:')

    def __str__(self):
        return self.name