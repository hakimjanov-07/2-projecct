from django.core.management.base import BaseCommand
from django.db import transaction

from mainapp.models import Author, Book, Category

TARGET = 20

CATEGORIES = (
    "Sarguzasht", "Romantika", "She'riyat", "Zamonaviy adabiyot", "Biznes", "Ilmiy", "Tarix",
    "Detektiv", "Fantastika", "Psixologiya", "Bolalar adabiyoti", "Diniy", "Falsafa",
    "Biografiya", "Sog'liq", "Texnologiya", "San'at", "Ta'lim", "Sayohat", "Klassika",
)

AUTHORS = (
    ("Abdulla Qodiriy", "O'zbek romanchiligi asoschisi."),
    ("Cho'lpon", "Shoir, dramaturg va tarjimon."),
    ("Abdulla Qahhor", "Hikoya va qissalar ustasi."),
    ("Pirimqul Qodirov", "Tarixiy romanlar muallifi."),
    ("Said Ahmad", "Hajviy va ijtimoiy asarlar muallifi."),
    ("Tog'ay Murod", "Zamonaviy o'zbek nasri vakili."),
    ("Nodar Dumbadze", "Gruzin yozuvchisi, samimiy qissalar muallifi."),
    ("Lev Tolstoy", "Rus adabiyotining buyuk klassigi."),
    ("Fyodor Dostoevskiy", "Psixologik romanlar ustasi."),
    ("Gabriel Garsia Markes", "Kolumbiyalik nobel mukofoti sovrindori."),
    ("Paulo Koelo", "Braziliyalik yozuvchi, falsafiy romanlar muallifi."),
    ("Ernest Xeminguey", "Amerikalik yozuvchi va jurnalist."),
    ("Agata Kristi", "Detektiv janrining malikasi."),
    ("Stefan Svayg", "Avstriyalik yozuvchi, psixologik novellalar muallifi."),
    ("Orxan Pamuk", "Turk yozuvchisi, nobel mukofoti sovrindori."),
    ("Dale Karnegi", "Muloqot va muvaffaqiyat haqida kitoblar muallifi."),
    ("Robert Kiyosaki", "Moliyaviy savodxonlik muallifi."),
    ("Yuval Noy Xarari", "Tarixchi, insoniyat tarixi haqida kitoblar muallifi."),
    ("Jorj Oruell", "Antiutopiya janri yozuvchisi."),
    ("Viktor Gyugo", "Fransuz romantizmi vakili."),
)

BOOKS = (
    ("O'tgan kunlar", "Klassika", "Abdulla Qodiriy", 82000, "Toshkent va Marg'ilon fonidagi mashhur sevgi romani."),
    ("Mehrobdan chayon", "Tarix", "Abdulla Qodiriy", 78000, "Xonlik davri voqealari haqida tarixiy roman."),
    ("Kecha va kunduz", "Klassika", "Cho'lpon", 76000, "Milliy uyg'onish davri haqida roman."),
    ("Sinchalak", "Zamonaviy adabiyot", "Abdulla Qahhor", 54000, "Hayotiy va yengil kulgili qissa."),
    ("Yulduzli tunlar", "Tarix", "Pirimqul Qodirov", 88000, "Bobur hayotidan olingan tarixiy roman."),
    ("Ufq", "Zamonaviy adabiyot", "Said Ahmad", 61000, "Urush davri haqida samimiy asar."),
    ("Ot kishnagan oqshom", "Zamonaviy adabiyot", "Tog'ay Murod", 64000, "Qishloq hayoti haqida ta'sirli qissa."),
    ("Abadiy sevgi", "Romantika", "Nodar Dumbadze", 58000, "Mehr va sadoqat haqida hikoya."),
    ("Urush va tinchlik", "Klassika", "Lev Tolstoy", 140000, "Rus jamiyati haqida ulkan epopeya."),
    ("Jinoyat va jazo", "Psixologiya", "Fyodor Dostoevskiy", 99000, "Vijdon va jazo haqida psixologik roman."),
    ("Yuz yillik yolg'izlik", "Fantastika", "Gabriel Garsia Markes", 105000, "Buendia oilasining bir asrlik tarixi."),
    ("Alkimyogar", "Sarguzasht", "Paulo Koelo", 66000, "Orzu izidagi sayohat haqida qissa."),
    ("Chol va dengiz", "Sarguzasht", "Ernest Xeminguey", 52000, "Baliqchi va katta baliq kurashi."),
    ("Nil daryosidagi qotillik", "Detektiv", "Agata Kristi", 72000, "Kemadagi sirli jinoyat tergovi."),
    ("Shaxmat novellasi", "Psixologiya", "Stefan Svayg", 49000, "Inson ruhiyati haqida kuchli novella."),
    ("Qor", "Zamonaviy adabiyot", "Orxan Pamuk", 92000, "Chegara shahrida kechgan siyosiy roman."),
    ("Do'st orttirish va odamlarga ta'sir qilish", "Psixologiya", "Dale Karnegi", 69000, "Muloqot san'ati bo'yicha qo'llanma."),
    ("Boy ota, kambag'al ota", "Biznes", "Robert Kiyosaki", 74000, "Pul haqida ikki xil qarash."),
    ("Sapiens", "Ilmiy", "Yuval Noy Xarari", 118000, "Insoniyatning qisqa tarixi."),
    ("1984", "Fantastika", "Jorj Oruell", 71000, "Totalitar jamiyat haqidagi antiutopiya."),
)

# Mavjud kitob rasmlari takrorlanadi (media/photo_book)
PHOTOS = (
    "photo_book/biznesda-omad.png",
    "photo_book/ilm-va-hayot.png",
    "photo_book/inson-saboqlari.png",
    "photo_book/kunning-songgi-soati.png",
    "photo_book/oltin-vodiy.png",
    "photo_book/qorongu-kocha.png",
    "photo_book/yodgorliklar.png",
    "photo_book/adolat-va-haqq.png",
)

PUBLISHERS = ("Yangi asr avlodi", "Sharq", "Ma'naviyat", "Kitob dunyosi", "Adabiyot")
LANGUAGES = ("uzbek", "uzbek", "uzbek", "russian", "english")


class Command(BaseCommand):
    help = "Har bir jadvalda kamida 20 tadan mock kategoriya, muallif va kitob qo'shadi."

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for name in CATEGORIES:
            categories[name], _ = Category.objects.get_or_create(name=name, defaults={"status": "active"})

        authors = {}
        for name, about in AUTHORS:
            authors[name], _ = Author.objects.get_or_create(
                full_name=name, defaults={"about": about, "status": "active"},
            )

        for index, (name, category, author, price, about) in enumerate(BOOKS):
            Book.objects.get_or_create(
                name=name,
                defaults={
                    "category": categories[category],
                    "author": authors[author],
                    "photo": PHOTOS[index % len(PHOTOS)],
                    "price": price,
                    "language": LANGUAGES[index % len(LANGUAGES)],
                    "publisher": PUBLISHERS[index % len(PUBLISHERS)],
                    "pages": 180 + (index * 17) % 300,
                    "about": about,
                    "status": "active",
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f"Jami: {Category.objects.count()} kategoriya, "
            f"{Author.objects.count()} muallif, {Book.objects.count()} kitob."
        ))
