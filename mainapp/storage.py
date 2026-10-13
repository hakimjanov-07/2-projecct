import os

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateStorage(FileSystemStorage):
    """
    Audio va PDF kitoblar uchun yopiq papka (settings.PRIVATE_MEDIA_ROOT).
    U media/ dan tashqarida, shuning uchun fayllarga to'g'ridan-to'g'ri havola ishlamaydi:
    ular faqat digital.py dagi himoyalangan manzil orqali beriladi.
    """

    @property
    def base_location(self):
        return settings.PRIVATE_MEDIA_ROOT

    @property
    def location(self):
        return os.path.abspath(self.base_location)
