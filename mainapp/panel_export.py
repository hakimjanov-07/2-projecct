"""
Admin panel: CSV yuklash (buyurtmalar, kitoblar, foydalanuvchilar).
Filtrlar ro'yxat sahifasidagi bilan bir xil. Fayl Excel'da to'g'ri ochilishi uchun UTF-8 (BOM) va ";" ajratgich.
"""
import csv

from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

from .models import Order
from .panel import TASHKENT, PanelBookList, PanelOrderList, PanelUserList

STATUS = dict(Order.STATUS)


def _text(value):
    """ Excel formula sifatida ishlamasligi uchun xavfli boshlanishli matnlarga ' qo'yiladi """
    if isinstance(value, str) and value[:1] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + value
    return value


def _when(moment):
    return timezone.localtime(moment, TASHKENT).strftime('%Y-%m-%d %H:%M') if moment else ''


def _yes(flag):
    return 'ha' if flag else "yo'q"


def _queryset(view_class, request):
    view = view_class()
    view.request = request
    return view.get_queryset()


def _response(name, header, rows):
    today = timezone.localtime(timezone.now(), TASHKENT).strftime('%Y-%m-%d')
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{name}-{today}.csv"'
    response.write('﻿')
    writer = csv.writer(response, delimiter=';')
    writer.writerow(header)
    for row in rows:
        writer.writerow([_text(cell) for cell in row])
    return response


def _orders(request):
    qs = _queryset(PanelOrderList, request).prefetch_related('items__book')
    header = [
        '№', 'Sana', 'Mijoz', 'Email', 'Holat', 'Promo kod', 'Kitoblar', 'Dona',
        "Mahsulotlar (so'm)", "Chegirma (so'm)", "Yetkazib berish (so'm)", "Jami (so'm)",
    ]
    rows = (
        [
            o.id, _when(o.created_on), o.user.username, o.user.email, STATUS.get(o.status, o.status),
            o.promo_code, '; '.join(f'{i.book.name} x{i.quantity} ({i.unit_price})' for i in o.items.all()),
            o.items_count, o.goods_total, o.discount, o.delivery_fee, o.total,
        ]
        for o in qs
    )
    return 'buyurtmalar', header, rows


def _books(request):
    qs = _queryset(PanelBookList, request)
    header = [
        'ID', 'Nomi', 'Muallif', 'Janr', 'Til', "Narx (so'm)", 'Ombor', 'Holat', 'Audio', 'PDF',
        'Sotilgan (dona)', "Tushum (so'm)", 'Buyurtmalar', "Qo'shilgan",
    ]
    rows = (
        [
            b.id, b.name, b.author.full_name, b.category.name, b.get_language_display(), b.price or '',
            'cheklanmagan' if b.stock is None else b.stock, 'faol' if b.status == 'active' else 'faol emas',
            _yes(b.audio_file), _yes(b.pdf_file), b.sold, b.revenue, b.orders_count, _when(b.created_on),
        ]
        for b in qs
    )
    return 'kitoblar', header, rows


def _users(request):
    qs = _queryset(PanelUserList, request)
    header = [
        'ID', 'Login', 'Email', 'Admin', 'Faol', "Ro'yxatdan o'tgan", 'Oxirgi kirish',
        'Buyurtmalar', "Sarflagan (so'm)", 'Oxirgi buyurtma',
    ]
    rows = (
        [
            u.id, u.username, u.email, _yes(u.is_staff), _yes(u.is_active), _when(u.date_joined),
            _when(u.last_login), u.orders_count, u.spent, _when(u.last_order),
        ]
        for u in qs
    )
    return 'foydalanuvchilar', header, rows


BUILDERS = {'orders': _orders, 'books': _books, 'users': _users}


@api_view(['GET'])
@permission_classes([IsAdminUser])
def export_csv(request, kind):
    builder = BUILDERS.get(kind)
    if not builder:
        raise Http404
    name, header, rows = builder(request)
    return _response(name, header, rows)
