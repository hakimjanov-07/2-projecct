"""
Admin panel: promo kodlarni boshqarish (ro'yxat, yaratish, foiz va holatni o'zgartirish, o'chirish).
Foydalanish statistikasi faqat bekor qilinmagan buyurtmalardan hisoblanadi.
"""
import re

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from rest_framework import generics, serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import Order, PromoCode
from .panel import ACTIVE, with_totals

CODE_PATTERN = re.compile(r'^[A-Z0-9_-]{3,32}$')


class PanelPromoSerializer(serializers.ModelSerializer):
    orders_count = serializers.IntegerField(read_only=True)
    discount_given = serializers.IntegerField(read_only=True)
    revenue = serializers.IntegerField(read_only=True)

    def validate_code(self, value):
        code = value.strip().upper()
        if not CODE_PATTERN.match(code):
            raise serializers.ValidationError("Kod 3-32 ta belgidan iborat bo'lsin: lotin harflari, raqamlar, - va _.")
        if self.instance is not None:
            if code != self.instance.code:
                raise serializers.ValidationError("Kodni o'zgartirib bo'lmaydi (eski buyurtmalar unga bog'liq). Yangisini yarating.")
            return code
        if PromoCode.objects.filter(code__iexact=code).exists():
            raise serializers.ValidationError('Bunday promo kod allaqachon bor.')
        return code

    class Meta:
        model = PromoCode
        fields = ['id', 'code', 'discount_percent', 'is_active', 'created_on', 'orders_count', 'discount_given', 'revenue']
        read_only_fields = ['id', 'created_on']
        extra_kwargs = {'code': {'validators': []}}


def with_usage(qs):
    used = with_totals(Order.objects.filter(promo_code=OuterRef('code'), status__in=ACTIVE)).order_by().values('promo_code')
    sub = lambda agg: Coalesce(Subquery(used.annotate(v=agg).values('v'), output_field=IntegerField()), 0)  # noqa: E731
    return qs.annotate(
        orders_count=sub(Count('id')),
        discount_given=sub(Sum('discount')),
        revenue=sub(Sum('total')),
    )


class PanelPromoList(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PanelPromoSerializer
    ORDERING = {'created_on', 'discount_percent', 'code', 'orders_count', 'discount_given', 'revenue'}

    def get_queryset(self):
        qs = with_usage(PromoCode.objects.all())
        params = self.request.query_params
        q = params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(code__icontains=q))
        if params.get('active') in ('1', '0'):
            qs = qs.filter(is_active=params['active'] == '1')
        ordering = params.get('ordering', '-created_on')
        if ordering.lstrip('-') not in self.ORDERING:
            ordering = '-created_on'
        return qs.order_by(ordering, '-id')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promo = serializer.save()
        return Response(PanelPromoSerializer(with_usage(PromoCode.objects.filter(pk=promo.pk)).get()).data, status=201)


class PanelPromoDetail(generics.RetrieveUpdateDestroyAPIView):
    """ PATCH: foiz va holat; DELETE: faqat hech qachon ishlatilmagan kod """
    permission_classes = [IsAdminUser]
    serializer_class = PanelPromoSerializer
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return with_usage(PromoCode.objects.all())

    def destroy(self, request, *args, **kwargs):
        promo = self.get_object()
        if Order.objects.filter(promo_code=promo.code).exists():
            return Response(
                {'detail': "Bu promo kod buyurtmalarda ishlatilgan, o'chirib bo'lmaydi. Uni faolsizlantiring."},
                status=400,
            )
        promo.delete()
        return Response(status=204)
