from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from mainapp.models import Author, Book, Category, Review


class Command(BaseCommand):
    help = "Add demo books, categories, authors, and varied reviews."

    @transaction.atomic
    def handle(self, *args, **options):
        category_map = {item.name: item for item in Category.objects.all()}
        for name in ("Sarguzasht", "Romantika", "She'riyat", "Zamonaviy adabiyot", "Biznes", "Ilmiy", "Tarix"):
            category, _ = Category.objects.get_or_create(
                name=name,
                defaults={"status": "active"},
            )
            category_map[name] = category

        author_specs = (
            ("Xurshid Do'stmuhammad", "O'zbek yozuvchisi, zamonaviy nasr va publitsistika muallifi."),
            ("Erkin Vohidov", "O'zbek shoiri va dramaturgi, she'riy to'plamlar muallifi."),
            ("O'tkir Hoshimov", "O'zbek adibi, insoniy munosabatlar haqidagi asarlari bilan tanilgan."),
            ("Chingiz Aytmatov", "Qirg'iz va jahon adabiyotining mashhur yozuvchisi."),
            ("Jek London", "Amerikalik yozuvchi, sarguzasht hikoyalari muallifi."),
            ("Antuan de Sent-Ekzyuperi", "Fransuz yozuvchisi va uchuvchi, falsafiy qissalar muallifi."),
        )
        author_map = {item.full_name: item for item in Author.objects.all()}
        for name, about in author_specs:
            author, _ = Author.objects.get_or_create(
                full_name=name,
                defaults={"about": about, "status": "active"},
            )
            author_map[name] = author

        book_specs = (
            ("Biznesda omad", "Biznes", "Xurshid Do'stmuhammad", "photo_book/biznesda-omad.png", 85000, "uzbek", "Yangi asr", 256, "Biznes va muvaffaqiyat haqida amaliy fikrlar."),
            ("Ilm va hayot", "Ilmiy", "Erkin Vohidov", "photo_book/ilm-va-hayot.png", 68000, "uzbek", "Ilm ziyo", 288, "Ilm-fan va kundalik hayot tutashgan qiziqarli mavzular."),
            ("Kunning so'nggi soati", "Tarix", "O'tkir Hoshimov", "photo_book/kunning-songgi-soati.png", 72000, "uzbek", "Adabiyot", 304, "Inson tanlovi va zamon sinovlari haqida hikoya."),
            ("Yodgorliklar", "Sarguzasht", "Chingiz Aytmatov", "photo_book/yodgorliklar.png", 79000, "uzbek", "Sharq", 320, "Xotira, tarix va inson qadri haqida asar."),
            ("Zaytun daraxti", "Zamonaviy adabiyot", "Jek London", "photo_book/zaytun-daraxti.png", 76000, "uzbek", "Kitob dunyosi", 272, "Umid va matonat haqidagi ta'sirli qissa."),
        )
        for name, category_name, author_name, photo, price, language, publisher, pages, about in book_specs:
            Book.objects.get_or_create(
                name=name,
                defaults={
                    "category": category_map[category_name],
                    "author": author_map[author_name],
                    "photo": photo,
                    "price": price,
                    "language": language,
                    "publisher": publisher,
                    "pages": pages,
                    "about": about,
                    "status": "active",
                },
            )

        review_specs = (
            ("Qorongu ko'cha", 4, "Voqealar izchil rivojlanadi, oxirigacha qiziqish saqlanib qoladi."),
            ("Adolat va haqq", 5, "Qahramonlarning qarorlari haqida uzoq o'ylab qoldim. Juda ta'sirli."),
            ("Yurakdagi ovoz", 5, "Tili sodda va samimiy, yosh kitobxonlarga ham mos."),
            ("Inson saboqlari", 4, "Hayotiy misollar ko'p, ayrim boblarini yana qayta o'qidim."),
            ("Biznesda omad", 3, "Foydali g'oyalar bor, lekin ayrim maslahatlar tanish tuyuldi."),
            ("Ilm va hayot", 5, "Murakkab mavzularni tushunarli qilib izohlagani yoqdi."),
            ("Kunning so'nggi soati", 4, "Kayfiyati kuchli asar, yakuni ham o'ylantiradi."),
            ("Yodgorliklar", 5, "Tarixiy tafsilotlar va insoniy hikoya juda yaxshi uyg'unlashgan."),
            ("Zaytun daraxti", 2, "G'oyasi qiziq, ammo ayrim qismlari men uchun sekin kechdi."),
        )
        reviewers = []
        for index in range(1, 4):
            username = f"kitobxon_demo_{index}"
            reviewer, created = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@example.invalid"},
            )
            if created:
                reviewer.set_unusable_password()
                reviewer.save(update_fields=["password"])
            reviewers.append(reviewer)

        for index, (book_name, rating, comment) in enumerate(review_specs):
            book = Book.objects.get(name=book_name)
            Review.objects.get_or_create(
                user=reviewers[index % len(reviewers)],
                book=book,
                comment=comment,
                defaults={"rating": rating},
            )

        self.stdout.write(self.style.SUCCESS(
            "Catalog totals: "
            f"{Book.objects.count()} books, "
            f"{Category.objects.count()} categories, "
            f"{Author.objects.count()} authors, "
            f"{Review.objects.count()} reviews."
        ))