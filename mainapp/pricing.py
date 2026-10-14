from django.conf import settings

from .models import PromoCode


def find_promo(code):
    """ Faol promo kodni qaytaradi, topilmasa None """
    code = (code or '').strip().upper()
    if not code:
        return None
    return PromoCode.objects.filter(code=code, is_active=True).first()


def calculate_totals(subtotal, promo=None, delivery_method='delivery'):
    """ Mahsulotlar summasidan chegirma, yetkazib berish va to'lov summasini hisoblaydi (olib ketishda yetkazib berish puli yo'q) """
    discount = subtotal * promo.discount_percent // 100 if promo else 0
    goods_total = subtotal - discount
    delivery_fee = 0 if delivery_method == 'pickup' or subtotal == 0 or goods_total >= settings.FREE_DELIVERY_FROM else settings.DELIVERY_FEE
    return {
        'subtotal': subtotal,
        'discount': discount,
        'delivery_fee': delivery_fee,
        'total': goods_total + delivery_fee,
    }
