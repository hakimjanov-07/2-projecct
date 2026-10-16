from django.db import migrations, models
import django.db.models.deletion


def merge_duplicate_carts(apps, schema_editor):
    """ Bir foydalanuvchida bir nechta savat (pending) bo'lsa, bittasiga birlashtiradi (unique cheklov uchun) """
    Order = apps.get_model('mainapp', 'Order')
    OrderItem = apps.get_model('mainapp', 'OrderItem')
    users = (
        Order.objects.filter(status='pending').values('user_id')
        .annotate(n=models.Count('id')).filter(n__gt=1).values_list('user_id', flat=True)
    )
    for user_id in list(users):
        carts = list(Order.objects.filter(user_id=user_id, status='pending').order_by('-id'))
        # Mahsulotli eng yangi savat saqlanadi, mahsulotsizlar bo'lsa eng yangisi
        keep = next((c for c in carts if OrderItem.objects.filter(order=c).exists()), carts[0])
        for cart in carts:
            if cart.pk == keep.pk:
                continue
            for item in OrderItem.objects.filter(order=cart):
                same = OrderItem.objects.filter(order=keep, book_id=item.book_id).first()
                if same:
                    same.quantity = min(same.quantity + item.quantity, 100)
                    same.save(update_fields=['quantity'])
                else:
                    item.order = keep
                    item.save(update_fields=['order'])
            cart.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('mainapp', '0013_book_photo_blank'),
    ]

    operations = [
        migrations.RunPython(merge_duplicate_carts, migrations.RunPython.noop),
        migrations.AddField(
            model_name='order',
            name='idempotency_key',
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddConstraint(
            model_name='order',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'pending')), fields=('user',), name='one_pending_cart_per_user',
            ),
        ),
        migrations.AddConstraint(
            model_name='order',
            constraint=models.UniqueConstraint(
                condition=models.Q(('idempotency_key__isnull', False)), fields=('user', 'idempotency_key'),
                name='unique_order_idempotency_key',
            ),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='book',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='mainapp.book'),
        ),
    ]
