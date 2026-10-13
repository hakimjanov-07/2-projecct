"""
Ombor qoldig'i. Book.stock bo'sh (None) bo'lsa kitob uchun qoldiq hisoblanmaydi (cheklanmagan).
"""
from django.db.models import F
from django.db.models.functions import Greatest

from .models import Book

LOW_STOCK = 5  # shu sondan kam qolsa "kam qoldi" hisoblanadi


def reserve(quantities):
    """
    quantities: {book_id: soni}. transaction.atomic() ichida chaqiriladi.
    Yetishmasa hech narsa o'zgartirmaydi va yetishmayotgan kitoblar ro'yxatini qaytaradi,
    yetarli bo'lsa qoldiqni kamaytirib bo'sh ro'yxat qaytaradi.
    """
    books = Book.objects.select_for_update().filter(id__in=quantities)
    shortages = []
    to_take = []
    for book in books:
        if book.stock is None:
            continue
        if quantities[book.id] > book.stock:
            shortages.append({'book_id': book.id, 'name': book.name, 'available': book.stock})
        else:
            to_take.append(book)
    if shortages:
        return shortages
    for book in to_take:
        Book.objects.filter(pk=book.pk).update(stock=F('stock') - quantities[book.pk])
    return []


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
