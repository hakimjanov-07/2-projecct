"""
Admin panel API (/api/panel/...): faqat is_staff foydalanuvchilar uchun.
Buyurtma summasi: mahsulotlar (joriy narx x soni) - chegirma + yetkazib berish.
Muhim: "pending" holatidagi yozuvlar savat (checkout qilinmagan), haqiqiy buyurtma emas.
Buyurtma checkout'da darrov "confirmed" bo'ladi, keyin processing -> shipped -> delivered
bosqichlaridan o'tadi yoki "cancelled" qilinadi. Tushum bekor qilinmagan buyurtmalardan hisoblanadi.
"""
import csv
import re
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import authenticate
from django.contrib.auth.models import User, update_last_login
from django.db.models import (
    Count, ExpressionWrapper, F, IntegerField, Max, OuterRef, Q, Subquery, Sum,
)
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Book, Order, OrderEvent, OrderItem, PromoCode, Review
from .profit import line_cost, net_revenue_stats, order_net
from .stock import LOW_STOCK
from .views import tokens_for

ACTIVE = list(Order.STAGES)  # bekor qilinmagan buyurtmalar
PLACED = ACTIVE + ['cancelled']

# Bitta qator summasi: buyurtmadagi narx (bo'lmasa kitobning narxi) x soni
TASHKENT = ZoneInfo('Asia/Tashkent')  # CSV va sana filtrlari O'zbekiston vaqti bilan

LINE_TOTAL = ExpressionWrapper(
    Coalesce(F('price'), F('book__price'), 0) * F('quantity'), output_field=IntegerField(),
)


def with_totals(qs):
    """ Buyurtmalarga goods_total, items_count va total (to'lov summasi) qo'shadi """
    goods = (
        OrderItem.objects.filter(order=OuterRef('pk')).order_by().values('order')
        .annotate(s=Sum(LINE_TOTAL)).values('s')
    )
    count = (
        OrderItem.objects.filter(order=OuterRef('pk')).order_by().values('order')
        .annotate(s=Sum('quantity')).values('s')
    )
    return qs.annotate(
        goods_total=Coalesce(Subquery(goods, output_field=IntegerField()), 0),
        items_count=Coalesce(Subquery(count, output_field=IntegerField()), 0),
    ).annotate(
        total=ExpressionWrapper(F('goods_total') - F('discount') + F('delivery_fee'), output_field=IntegerField()),
    )


def day_bounds(date_from, date_to):
    """ 'YYYY-MM-DD' sanalaridan Toshkent vaqti bo'yicha [boshi, oxiri) oralig'i (xato sana e'tiborsiz) """
    def parse(value):
        try:
            return datetime.strptime(value or '', '%Y-%m-%d').date()
        except ValueError:
            return None

    first, last = parse(date_from), parse(date_to)
    start = datetime.combine(first, time.min, tzinfo=TASHKENT) if first else None
    end = datetime.combine(last + timedelta(days=1), time.min, tzinfo=TASHKENT) if last else None
    return start, end


def growth(current, previous):
    """ O'sish foizi (oldingi davr 0 bo'lsa None) """
    if not previous:
        return None
    return round((current - previous) * 100 / previous, 1)


""" KIRISH """

class PanelLoginThrottle(AnonRateThrottle):
    scope = 'panel_login'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PanelLoginThrottle])
def panel_login(request):
    username = str(request.data.get('username', '')).strip()
    password = request.data.get('password', '')
    user = authenticate(username=username, password=password)
    # Noto'g'ri parol ham, oddiy foydalanuvchi ham bir xil javob oladi (kim admin ekani sezilmaydi)
    if not user or not user.is_staff:
        return Response({'detail': "Login yoki parol noto'g'ri."}, status=401)
    update_last_login(None, user)
    return Response(tokens_for(user))


""" DASHBOARD """

@api_view(['GET'])
@permission_classes([IsAdminUser])
def panel_summary(request):
    try:
        days = int(request.query_params.get('days', 30))
    except ValueError:
        days = 30
    days = max(1, min(days, 365))

    now = timezone.now()
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    orders = with_totals(Order.objects.all())

    def period_stats(a, b):
        window = orders.filter(created_on__gte=a, created_on__lt=b)
        active = window.filter(status__in=ACTIVE)
        agg = active.aggregate(
            revenue=Coalesce(Sum('total'), 0), count=Count('id'),
            discounts=Coalesce(Sum('discount'), 0), delivery=Coalesce(Sum('delivery_fee'), 0),
            books=Coalesce(Sum('items_count'), 0),
        )
        agg['avg_order'] = round(agg['revenue'] / agg['count']) if agg['count'] else 0
        agg['cancelled'] = window.filter(status='cancelled').count()
        agg.update(net_revenue_stats(OrderItem.objects.filter(
            order__status__in=ACTIVE, order__created_on__gte=a, order__created_on__lt=b,
        )))
        return agg

    current = period_stats(start, now + timedelta(seconds=1))
    previous = period_stats(prev_start, start)

    window_orders = orders.filter(created_on__gte=start, status__in=PLACED)
    active_orders = window_orders.filter(status__in=ACTIVE)

    # Kunlik grafik (UTC kunlari), bo'sh kunlar 0 bilan to'ldiriladi
    by_day = {
        row['day']: row for row in active_orders.annotate(day=TruncDate('created_on'))
        .values('day').annotate(orders=Count('id'), revenue=Coalesce(Sum('total'), 0))
    }
    series = []
    day = start.date()
    while day <= now.date():
        row = by_day.get(day, {})
        series.append({'date': day.isoformat(), 'orders': row.get('orders', 0), 'revenue': row.get('revenue', 0)})
        day += timedelta(days=1)

    status_rows = {
        r['status']: r for r in window_orders.values('status').annotate(count=Count('id'), sum=Coalesce(Sum('total'), 0))
    }
    statuses = [
        {'status': key, 'count': status_rows.get(key, {}).get('count', 0), 'sum': status_rows.get(key, {}).get('sum', 0)}
        for key in PLACED
    ]

    sold = OrderItem.objects.filter(order__status__in=ACTIVE, order__created_on__gte=start)
    top_books = list(
        sold.values('book', 'book__name', 'book__author__full_name')
        .annotate(qty=Sum('quantity'), revenue=Sum(LINE_TOTAL)).order_by('-qty', '-revenue')[:8]
    )
    categories = list(
        sold.values('book__category__name').annotate(qty=Sum('quantity'), revenue=Sum(LINE_TOTAL)).order_by('-revenue')
    )
    top_customers = list(
        active_orders.values('user', 'user__username', 'user__email')
        .annotate(orders=Count('id'), spent=Sum('total')).order_by('-spent')[:5]
    )
    carts = orders.filter(status='pending', items_count__gt=0).aggregate(count=Count('id'), value=Coalesce(Sum('goods_total'), 0))
    recent = [
        {
            'id': o.id, 'username': o.user.username, 'status': o.status, 'total': o.total,
            'items_count': o.items_count, 'created_on': o.created_on,
        }
        for o in with_totals(Order.objects.select_related('user').filter(status__in=PLACED)).order_by('-created_on')[:8]
    ]

    tracked = Book.objects.filter(stock__isnull=False)
    low_books = list(tracked.filter(stock__lte=LOW_STOCK).order_by('stock', 'name').values('id', 'name', 'stock')[:10])
    stock_summary = {
        'tracked': tracked.count(),
        'out': tracked.filter(stock=0).count(),
        'low': tracked.filter(stock__gt=0, stock__lte=LOW_STOCK).count(),
        'low_books': low_books,
        'threshold': LOW_STOCK,
    }

    all_active = orders.filter(status__in=ACTIVE).aggregate(revenue=Coalesce(Sum('total'), 0), count=Count('id'))
    return Response({
        'days': days,
        'current': current,
        'previous': previous,
        'growth': {
            'revenue': growth(current['revenue'], previous['revenue']),
            'net_revenue': growth(current['net_revenue'], previous['net_revenue']),
            'orders': growth(current['count'], previous['count']),
        },
        'new_users': User.objects.filter(date_joined__gte=start).count(),
        'series': series,
        'statuses': statuses,
        'top_books': [
            {'id': r['book'], 'name': r['book__name'], 'author': r['book__author__full_name'], 'qty': r['qty'], 'revenue': r['revenue']}
            for r in top_books
        ],
        'categories': [
            {'name': r['book__category__name'], 'qty': r['qty'], 'revenue': r['revenue']} for r in categories
        ],
        'top_customers': [
            {'id': r['user'], 'username': r['user__username'], 'email': r['user__email'], 'orders': r['orders'], 'spent': r['spent']}
            for r in top_customers
        ],
        'recent_orders': recent,
        'carts': carts,
        'stock': stock_summary,
        'totals': {
            'users': User.objects.count(),
            'books': Book.objects.count(),
            'orders': Order.objects.filter(status__in=PLACED).count(),
            'revenue': all_active['revenue'],
            'active_orders': all_active['count'],
            **{f'all_{k}': v for k, v in net_revenue_stats(OrderItem.objects.filter(order__status__in=ACTIVE)).items()},
        },
    })


""" BUYURTMALAR """

class PanelOrderItemSerializer(serializers.ModelSerializer):
    book_name = serializers.CharField(source='book.name', read_only=True)
    book_photo = serializers.SerializerMethodField()
    price = serializers.IntegerField(source='unit_price', read_only=True)
    line_total = serializers.SerializerMethodField()
    cost_price = serializers.SerializerMethodField()
    profit = serializers.SerializerMethodField()

    def get_cost_price(self, obj):
        return line_cost(obj.cost_price, obj.book.cost_price)

    def get_profit(self, obj):
        cost = self.get_cost_price(obj)
        return None if cost is None else (obj.unit_price - cost) * obj.quantity

    def get_book_photo(self, obj):
        if not obj.book.photo:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.book.photo.url) if request else obj.book.photo.url

    def get_line_total(self, obj):
        return obj.unit_price * obj.quantity

    class Meta:
        model = OrderItem
        fields = ['id', 'book', 'book_name', 'book_photo', 'price', 'cost_price', 'quantity', 'line_total', 'profit']


class PanelOrderSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    items_count = serializers.IntegerField(read_only=True)
    goods_total = serializers.IntegerField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    address = serializers.CharField(source='address_text', read_only=True)
    delivery_lat = serializers.FloatField(read_only=True)
    delivery_lng = serializers.FloatField(read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'username', 'email', 'status', 'items_count', 'goods_total',
            'promo_code', 'discount', 'delivery_fee', 'total', 'created_on',
            'delivery_method', 'recipient_name', 'recipient_phone', 'address', 'delivery_comment',
            'delivery_lat', 'delivery_lng',
        ]
        read_only_fields = [f for f in fields if f != 'status']


class PanelOrderEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderEvent
        fields = ['status', 'created_on']


class PanelOrderDetailSerializer(PanelOrderSerializer):
    items = PanelOrderItemSerializer(many=True, read_only=True)
    events = PanelOrderEventSerializer(many=True, read_only=True)
    net_revenue = serializers.SerializerMethodField()
    missing_cost_count = serializers.SerializerMethodField()

    def _net(self, obj):
        lines = [(i.unit_price, i.quantity, line_cost(i.cost_price, i.book.cost_price)) for i in obj.items.all()]
        return order_net(obj.discount, lines)

    def get_net_revenue(self, obj):
        return round(self._net(obj)[0])

    def get_missing_cost_count(self, obj):
        return self._net(obj)[2]

    def validate_status(self, value):
        # "pending" - savat, uni buyurtma holatiga qo'yib bo'lmaydi
        if value not in PLACED:
            raise serializers.ValidationError(f"Holat quyidagilardan biri bo'lishi kerak: {', '.join(PLACED)}.")
        return value

    class Meta(PanelOrderSerializer.Meta):
        fields = PanelOrderSerializer.Meta.fields + ['items', 'events', 'net_revenue', 'missing_cost_count']
        read_only_fields = [f for f in fields if f != 'status']


class PanelOrderList(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PanelOrderSerializer

    def get_queryset(self):
        qs = with_totals(Order.objects.select_related('user').filter(status__in=PLACED))
        params = self.request.query_params
        if params.get('status') in PLACED:
            qs = qs.filter(status=params['status'])
        if params.get('user', '').isdigit():
            qs = qs.filter(user_id=int(params['user']))
        start, end = day_bounds(params.get('from'), params.get('to'))
        if start:
            qs = qs.filter(created_on__gte=start)
        if end:
            qs = qs.filter(created_on__lt=end)
        q = params.get('q', '').strip()
        if q:
            cond = Q(user__username__icontains=q) | Q(user__email__icontains=q) | Q(promo_code__icontains=q)
            if q.lstrip('#').isdigit():
                cond |= Q(id=int(q.lstrip('#')))
            qs = qs.filter(cond)
        return qs.order_by('-created_on', '-id')


class PanelOrderDetail(generics.RetrieveUpdateAPIView):
    """ GET: tafsilot; PATCH: faqat holatni o'zgartirish """
    permission_classes = [IsAdminUser]
    serializer_class = PanelOrderDetailSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return with_totals(Order.objects.select_related('user').prefetch_related('items__book', 'events').filter(status__in=PLACED))


""" KITOBLAR """

class PanelBookSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    sold = serializers.IntegerField(read_only=True)
    revenue = serializers.IntegerField(read_only=True)
    orders_count = serializers.IntegerField(read_only=True)
    has_audio = serializers.SerializerMethodField()
    has_pdf = serializers.SerializerMethodField()
    markup = serializers.SerializerMethodField()

    def get_markup(self, obj):
        """ Ustama = narx - tannarx (ikkalasi ham bo'lsa) """
        if obj.price is None or obj.cost_price is None:
            return None
        return obj.price - obj.cost_price

    def get_has_audio(self, obj):
        return bool(obj.audio_file)

    def get_has_pdf(self, obj):
        return bool(obj.pdf_file)

    class Meta:
        model = Book
        fields = [
            'id', 'name', 'category_name', 'author_name', 'language', 'price', 'cost_price', 'markup', 'status', 'stock',
            'created_on', 'sold', 'revenue', 'orders_count', 'has_audio', 'has_pdf',
        ]
        read_only_fields = [f for f in fields if f not in ('price', 'cost_price', 'status', 'stock')]


class PanelBookList(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PanelBookSerializer
    ORDERING = {'sold', 'revenue', 'name', 'price', 'created_on', 'orders_count', 'stock'}

    def get_queryset(self):
        active = Q(orderitem__order__status__in=ACTIVE)
        qs = Book.objects.select_related('category', 'author').annotate(
            sold=Coalesce(Sum('orderitem__quantity', filter=active), 0),
            revenue=Coalesce(Sum(
                ExpressionWrapper(
                    Coalesce(F('orderitem__price'), F('price'), 0) * F('orderitem__quantity'), output_field=IntegerField(),
                ),
                filter=active,
            ), 0),
            orders_count=Count('orderitem__order', filter=active, distinct=True),
        )
        params = self.request.query_params
        if params.get('status') in ('active', 'deactive'):
            qs = qs.filter(status=params['status'])
        if params.get('category', '').isdigit():
            qs = qs.filter(category_id=int(params['category']))
        stock_filter = params.get('stock')
        if stock_filter == 'out':
            qs = qs.filter(stock=0)
        elif stock_filter == 'low':
            qs = qs.filter(stock__isnull=False, stock__lte=LOW_STOCK)
        elif stock_filter == 'tracked':
            qs = qs.filter(stock__isnull=False)
        q = params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(author__full_name__icontains=q))
        ordering = params.get('ordering', '-created_on')
        if ordering.lstrip('-') not in self.ORDERING:
            ordering = '-created_on'
        return qs.order_by(ordering, '-id')


class PanelBookDetail(generics.UpdateAPIView):
    """ PATCH: faqat narx, tannarx, ombor va holat (qolgan tahrir Django adminda) """
    permission_classes = [IsAdminUser]
    serializer_class = PanelBookSerializer
    http_method_names = ['patch', 'options']
    queryset = Book.objects.select_related('category', 'author')


""" FOYDALANUVCHILAR """

class PanelUserSerializer(serializers.ModelSerializer):
    orders_count = serializers.IntegerField(read_only=True)
    spent = serializers.IntegerField(read_only=True)
    last_order = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'is_staff', 'is_active', 'date_joined', 'last_login',
            'orders_count', 'spent', 'last_order',
        ]
        read_only_fields = fields


class PanelUserList(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PanelUserSerializer
    ORDERING = {'date_joined', 'username', 'last_login', 'spent', 'orders_count', 'last_order'}

    def get_queryset(self):
        mine = with_totals(Order.objects.filter(user=OuterRef('pk'), status__in=ACTIVE)).order_by().values('user')
        qs = User.objects.annotate(
            orders_count=Coalesce(Subquery(mine.annotate(c=Count('id')).values('c'), output_field=IntegerField()), 0),
            spent=Coalesce(Subquery(mine.annotate(s=Sum('total')).values('s'), output_field=IntegerField()), 0),
            last_order=Subquery(mine.annotate(m=Max('created_on')).values('m')),
        )
        params = self.request.query_params
        q = params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
        if params.get('staff') == '1':
            qs = qs.filter(is_staff=True)
        ordering = params.get('ordering', '-date_joined')
        if ordering.lstrip('-') not in self.ORDERING:
            ordering = '-date_joined'
        return qs.order_by(ordering, '-id')


class PanelUserOrderSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(read_only=True)
    goods_total = serializers.IntegerField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    items = PanelOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'status', 'items_count', 'goods_total', 'promo_code', 'discount',
            'delivery_fee', 'total', 'created_on', 'items',
        ]
        read_only_fields = fields


class PanelUserReviewSerializer(serializers.ModelSerializer):
    book_name = serializers.CharField(source='book.name', read_only=True)
    photo = serializers.SerializerMethodField()

    def get_photo(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    class Meta:
        model = Review
        fields = ['id', 'book', 'book_name', 'rating', 'comment', 'photo', 'created_on']
        read_only_fields = fields


@api_view(['GET'])
@permission_classes([IsAdminUser])
def panel_user_detail(request, pk):
    """ Foydalanuvchi tafsiloti: profil, statistika, buyurtmalar, sharhlar, savat.
    Parol hash'i va boshqa maxfiy maydonlar qaytarilmaydi. """
    user = get_object_or_404(User.objects.select_related('profile'), pk=pk)
    profile = getattr(user, 'profile', None)
    context = {'request': request}

    orders = list(
        with_totals(Order.objects.filter(user=user, status__in=PLACED))
        .prefetch_related('items__book').order_by('-created_on', '-id')
    )
    active = [o for o in orders if o.status in ACTIVE]
    spent = sum(o.total for o in active)
    promos = sorted({o.promo_code for o in active if o.promo_code})

    cart = (
        with_totals(Order.objects.filter(user=user, status='pending'))
        .prefetch_related('items__book').order_by('-created_on', '-id').first()
    )
    reviews = Review.objects.filter(user=user).select_related('book').order_by('-created_on')

    return Response({
        'profile': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': profile.full_name if profile else '',
            'phone': profile.phone if profile else '',
            'address': profile.address if profile else '',
            'bio': profile.bio if profile else '',
            'date_joined': user.date_joined,
            'last_login': user.last_login,
            'is_staff': user.is_staff,
            'is_active': user.is_active,
        },
        'stats': {
            'orders_count': len(active),
            'spent': spent,
            'average': round(spent / len(active)) if active else 0,
            'last_order': active[0].created_on if active else None,
            'cancelled_count': sum(1 for o in orders if o.status == 'cancelled'),
            'promo_codes': promos,
            'reviews_count': len(reviews),
        },
        'orders': PanelUserOrderSerializer(orders, many=True, context=context).data,
        'reviews': PanelUserReviewSerializer(reviews, many=True, context=context).data,
        'cart': PanelUserOrderSerializer(cart, context=context).data if cart else None,
    })
