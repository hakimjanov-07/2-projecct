"""
Sof tushum (foyda) hisobi — BITTA joyda, qoida o'zgarsa faqat shu fayl o'zgaradi.

Qoidalar:
- Qator foydasi = (sotuv narxi - tannarx) * soni. Tannarx: buyurtmadagi snapshot, u bo'sh bo'lsa kitobning joriy tannarxi.
- Tannarxi noma'lum qatorlar hisobga KIRMAYDI (aks holda foyda soxta katta chiqadi) va "missing" ga sanaladi.
- Promo chegirma buyurtma darajasida: tannarxi ma'lum qatorlarga ulushiga qarab ayriladi.
- Yetkazib berish puli sof tushumga KIRMAYDI (alohida ko'rsatiladi).
"""
from collections import defaultdict


def line_cost(snapshot, book_cost):
    return snapshot if snapshot is not None else book_cost


def order_net(discount, lines):
    """ lines: [(sotuv_narxi, soni, tannarx|None)]. Qaytaradi: (sof, tannarx_jami, tannarxsiz_qatorlar_soni) """
    goods = sum(unit * qty for unit, qty, _ in lines)
    known = [(unit, qty, cost) for unit, qty, cost in lines if cost is not None]
    known_goods = sum(unit * qty for unit, qty, _ in known)
    margin = sum((unit - cost) * qty for unit, qty, cost in known)
    cost_total = sum(cost * qty for _, qty, cost in known)
    share = discount * known_goods / goods if goods else 0
    return margin - share, cost_total, len(lines) - len(known)


def net_revenue_stats(items):
    """ items: bekor qilinmagan buyurtmalarning OrderItem queryset'i """
    rows = items.values(
        'order_id', 'order__discount', 'book_id', 'quantity', 'price', 'book__price',
        'cost_price', 'book__cost_price',
    )
    orders = defaultdict(lambda: {'discount': 0, 'lines': []})
    missing_books = set()
    for r in rows:
        unit = r['price'] if r['price'] is not None else (r['book__price'] or 0)
        cost = line_cost(r['cost_price'], r['book__cost_price'])
        if cost is None:
            missing_books.add(r['book_id'])
        o = orders[r['order_id']]
        o['discount'] = r['order__discount']
        o['lines'].append((unit, r['quantity'], cost))
    net = cost_total = 0
    for o in orders.values():
        n, c, _ = order_net(o['discount'], o['lines'])
        net += n
        cost_total += c
    return {'net_revenue': round(net), 'cost_total': cost_total, 'missing_cost_count': len(missing_books)}
