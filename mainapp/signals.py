from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from . import stock
from .models import Order, OrderEvent


@receiver(pre_save, sender=Order)
def remember_old_status(sender, instance, **kwargs):
    """ Saqlashdan oldin eski holatni eslab qoladi (admin, panel yoki kod orqali o'zgarsa ham) """
    old = None
    if instance.pk:
        old = Order.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
    instance._old_status = old


@receiver(post_save, sender=Order)
def log_status_change(sender, instance, created, **kwargs):
    """ Holat o'zgarganda tarixga yozadi. Savat (pending) buyurtma emas, yozilmaydi. """
    old = getattr(instance, '_old_status', None)
    if instance.status == 'pending' or (not created and old == instance.status):
        return
    OrderEvent.objects.create(order=instance, status=instance.status)

    # Yangi buyurtma omborni checkout'ning o'zida kamaytiradi. Keyingi o'zgarishlar:
    if not created:
        was_active = old in Order.STAGES
        now_active = instance.status in Order.STAGES
        if was_active and not now_active:
            stock.restock(instance)
        elif now_active and not was_active:
            stock.retake(instance)
