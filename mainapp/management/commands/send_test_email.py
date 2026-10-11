from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Email sozlamalarini tekshirish: ko'rsatilgan manzilga sinov xatini yuboradi."

    def add_arguments(self, parser):
        parser.add_argument('to', help='Sinov xati yuboriladigan email manzil')

    def handle(self, *args, **options):
        recipient = options['to']
        backend = settings.EMAIL_BACKEND.rsplit('.', 2)[-2]

        self.stdout.write(f"Xizmat:        {backend}")
        if backend == 'console':
            self.stdout.write(self.style.WARNING(
                "EMAIL_HOST_USER yoki EMAIL_HOST_PASSWORD .env da yozilmagan: xat emailga emas, "
                "shu oynaga chiqadi."
            ))
        else:
            self.stdout.write(f"Server:        {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
        self.stdout.write(f"Kimdan:        {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"Kimga:         {recipient}")

        message = EmailMultiAlternatives(
            subject=f"{settings.SITE_NAME}: sinov xati",
            body=(
                f"Bu {settings.SITE_NAME} saytidan yuborilgan sinov xati.\n"
                "Agar uni o'qiyotgan bo'lsangiz, email sozlamalari to'g'ri ishlayapti."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        message.attach_alternative(
            f"<p>Bu <strong>{settings.SITE_NAME}</strong> saytidan yuborilgan sinov xati.</p>"
            "<p>Agar uni o'qiyotgan bo'lsangiz, email sozlamalari to'g'ri ishlayapti.</p>",
            'text/html',
        )

        try:
            message.send(fail_silently=False)
        except Exception as error:  # noqa: BLE001 - xatoni foydalanuvchiga tushunarli ko'rsatamiz
            raise CommandError(f"Xatni yuborib bo'lmadi: {error}") from error

        self.stdout.write(self.style.SUCCESS("Yuborildi. Pochta qutingizni (va Spam papkasini) tekshiring."))
