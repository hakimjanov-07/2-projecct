"""
Ombor qoldig'i. Book.stock bo'sh (None) bo'lsa kitob uchun qoldiq hisoblanmaydi (cheklanmagan).
"""
from django.db import IntegrityError, transaction
from django.db.models import F
from django.db.models.functions import Greatest

from .models import Book

LOW_STOCK = 5  # shu sondan kam qolsa "kam qoldi" hisoblanadi


class _Shortage(Exception):
    pass


def reserve(quantities):
    """
    quantities: {book_id: soni}. transaction.atomic() ichida chaqiriladi.
    Yetishmasa hech narsa o'zgartirmaydi va yetishmayotgan kitoblar ro'yxatini qaytaradi,
    yetarli bo'lsa qoldiqni kamaytirib bo'sh ro'yxat qaytaradi.
    """
    # Shartli atomik yangilash: SQLite'da select_for_update ishlamaydi, shuning uchun tekshiruv va ayirish
    # bitta UPDATE (stock >= soni) ichida bajariladi - parallel so'rovlar ombordan ortiqcha ola olmaydi.
    shortages = []
    try:
        with transaction.atomic():
            for pk in sorted(quantities):
                try:
                    taken = Book.objects.filter(pk=pk, stock__gte=quantities[pk]).update(stock=F('stock') - quantities[pk])
                except IntegrityError:  # CHECK (stock >= 0) buzilishi ham yetishmovchilik hisoblanadi
                    taken = 0
                if taken:
                    continue
                book = Book.objects.filter(pk=pk).values('name', 'stock').first()
                if book is None or book['stock'] is None:
                    continue  # kitob yo'q yoki ombor cheklanmagan
                shortages.append({'book_id': pk, 'name': book['name'], 'available': book['stock']})
            if shortages:
                raise _Shortage  # oldin ayirilgan kitoblar ham qaytadi (savepoint rollback)
    except _Shortage:
        pass
    return shortages


def restock(order):
    """ Buyurtma bekor qilinganda kitoblar omborga qaytadi """
    for item in order.items.select_related('book'):
        if item.book.stock is not None:
            Book.objects.filter(pk=item.book_id).update(stock=F('stock') + item.quantity)


def retake(order):
    """ Bekor qilingan buyurtma qayta tiklanganda ombordan yana ayriladi (0 dan pastga tushmaydi) """
    for item in order.items.select_related('book'):
        if item.book.stock is not None:
            Book.objects.filter(pk=item.book_id).update(stock=Greatest(F('stock') - item.quantity, 0))
