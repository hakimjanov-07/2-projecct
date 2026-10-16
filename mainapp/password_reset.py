import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import EmailMultiAlternatives
from django.db.models import F
from django.template.loader import render_to_string
from django.utils import timezone

from .models import PasswordResetCode

logger = logging.getLogger(__name__)


def hash_code(user, code):
    message = f"{user.pk}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def find_user(email):
    email = (email or '').strip()
    if not email:
        return None
    return User.objects.filter(email__iexact=email, is_active=True).order_by('id').first()


def issue_code(user):
    """ Yangi 6 xonali kod yaratadi va emailga yuboradi. Faqat eng yangi kod amal qiladi.
    Oxirgi kod yaqinda yuborilgan yoki hisobga soatiga limit oshgan bo'lsa, hech narsa qilmaydi (False qaytaradi). """
    now = timezone.now()
    latest = user.reset_codes.first()
    resend = timedelta(seconds=settings.PASSWORD_RESET_RESEND_SECONDS)
    if latest and now - latest.created_on < resend:
        return False

    # Hisob bo'yicha soatlik limit: oxirgi soatda yuborilgan kodlar soni (eskilari tarix sifatida shu uchun saqlanadi;
    # soatdan eskilari o'chiriladi). Hisob IP dan qat'i nazar cheklanadi: ko'p IP dan email bombardimon qilib bo'lmaydi.
    hour_ago = now - timedelta(hours=1)
    user.reset_codes.filter(created_on__lt=hour_ago).delete()
    if user.reset_codes.count() >= settings.PASSWORD_RESET_MAX_PER_HOUR:
        return False

    code = f"{secrets.randbelow(10 ** 6):06d}"
    PasswordResetCode.objects.create(
        user=user,
        code_hash=hash_code(user, code),
        expires_on=now + timedelta(minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES),
    )

    context = {
        'username': user.username,
        'code': code,
        'minutes': settings.PASSWORD_RESET_CODE_TTL_MINUTES,
        'site_name': settings.SITE_NAME,
    }
    try:
        message = EmailMultiAlternatives(
            # Kod mavzuda ham ko'rinadi (xat ochilmasdan o'qish mumkin)
            subject=f"{code} — {settings.SITE_NAME} tasdiqlash kodi",
            body=render_to_string('mainapp/email/password_reset.txt', context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(render_to_string('mainapp/email/password_reset.html', context), 'text/html')
        message.send(fail_silently=False)
    except Exception:  # noqa: BLE001 - SMTP xatosi foydalanuvchiga ko'rsatilmaydi, logga yoziladi
        logger.exception('Parol tiklash emailini yuborib bo\'lmadi (user_id=%s)', user.pk)
    return True


def check_code(user, code):
    """ Kod to'g'ri bo'lsa, shu kod yozuvini qaytaradi. Noto'g'ri urinishlar hisoblanadi. """
    record = user.reset_codes.first()
    if record is None or record.expires_on < timezone.now():
        return None

    # Urinish solishtirishdan OLDIN bazada atomik band qilinadi: parallel so'rovlar "o'qi-tekshir-yoz" oralig'idan
    # o'tib, limitdan ko'p taxmin qila olmaydi (UPDATE ... WHERE attempts < MAX faqat limitgacha so'rovga ruxsat beradi).
    reserved = PasswordResetCode.objects.filter(
        pk=record.pk, attempts__lt=settings.PASSWORD_RESET_MAX_ATTEMPTS,
    ).update(attempts=F('attempts') + 1)
    if not reserved:
        return None

    if hmac.compare_digest(record.code_hash, hash_code(user, (code or '').strip())):
        # To'g'ri kod urinish hisobiga kirmaydi (masalan, parol kuchsiz bo'lib qayta yuborilsa kod yonib ketmasin)
        PasswordResetCode.objects.filter(pk=record.pk).update(attempts=F('attempts') - 1)
        return record
    return None
