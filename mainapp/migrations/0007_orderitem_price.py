from django.db import migrations, models


def copy_current_prices(apps, schema_editor):
    """ Mavjud buyurtmalar (savatdan tashqari) uchun kitobning hozirgi narxini saqlab qo'yadi """
    OrderItem = apps.get_model('mainapp', 'OrderItem')
    items = OrderItem.objects.exclude(order__status='pending').select_related('book')
    for item in items.iterator():
        item.price = item.book.price or 0
        item.save(update_fields=['price'])


class Migration(migrations.Migration):

    dependencies = [
        ('mainapp', '0006_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='price',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Sotuv narxi:'),
        ),
        migrations.RunPython(copy_current_prices, migrations.RunPython.noop),
    ]
