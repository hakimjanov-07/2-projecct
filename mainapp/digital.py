"""
Audio va PDF kitoblar: faqat sotib olganlar (va adminlar) uchun.
1) GET /api/book/<id>/digital/  - kirish huquqini tekshiradi va imzolangan, 30 daqiqa amal qiladigan havolalar beradi
2) GET /api/files/<token>/      - havola imzosini tekshirib faylni beradi (audio sakrab o'tishi uchun Range bilan)

Havola <audio src> / <a href> orqali ochiladi va Authorization sarlavhasi yubora olmaydi, shuning uchun login talab
qilinmaydi. Buning o'rniga havola tokeniga foydalanuvchi ham yoziladi va har yuklashda uning huquqi bazadan qayta
tekshiriladi: buyurtma bekor qilinsa yoki hisob o'chirilsa, havola muddatidan oldin ishlamay qoladi.
"""
import mimetypes
import re

from django.contrib.auth.models import User
from django.core import signing
from django.http import Http404, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Book, Order, OrderItem

SALT = 'book-digital-file'
LINK_MAX_AGE = 30 * 60  # soniya
CHUNK = 64 * 1024
FALLBACK_TYPES = {'audio': 'audio/mpeg', 'pdf': 'application/pdf'}


def can_access_digital(user, book):
    """ Admin yoki kitobni bekor qilinmagan buyurtma bilan sotib olgan foydalanuvchi """
    if user.is_staff:
        return True
    return OrderItem.objects.filter(
        order__user=user, order__status__in=Order.STAGES, book=book
    ).exists()


def _sign(book_id, kind, user_id):
    return signing.dumps({'b': book_id, 'k': kind, 'u': user_id}, salt=SALT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def book_digital(request, pk):
    book = get_object_or_404(Book, pk=pk)
    if not can_access_digital(request.user, book):
        return Response({'detail': "Raqamli nusxa faqat kitobni sotib olganlar uchun."}, status=403)

    def link(kind, field):
        if not field:
            return None
        return request.build_absolute_uri(f'/api/files/{_sign(book.id, kind, request.user.id)}/')

    return Response({'audio': link('audio', book.audio_file), 'pdf': link('pdf', book.pdf_file)})


def _serve(request, field, kind):
    try:
        size = field.size
        handle = field.open('rb')
    except (FileNotFoundError, ValueError, OSError):
        raise Http404

    content_type = mimetypes.guess_type(field.name)[0] or FALLBACK_TYPES[kind]
    start, end, status = 0, size - 1, 200

    match = re.fullmatch(r'bytes=(\d*)-(\d*)', request.headers.get('Range', '').strip())
    if match and (match.group(1) or match.group(2)):
        if match.group(1) == '':  # oxirgi N bayt
            start = max(0, size - int(match.group(2)))
        else:
            start = int(match.group(1))
            end = min(int(match.group(2)), size - 1) if match.group(2) else size - 1
        if start >= size or start > end:
            handle.close()
            response = HttpResponse(status=416)
            response['Content-Range'] = f'bytes */{size}'
            response['Referrer-Policy'] = 'no-referrer'
            return response
        status = 206

    length = end - start + 1

    def stream():
        try:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
        finally:
            handle.close()

    response = StreamingHttpResponse(stream(), status=status, content_type=content_type)
    response['Content-Length'] = str(length)
    response['Accept-Ranges'] = 'bytes'
    response['Content-Disposition'] = 'inline'
    response['Cache-Control'] = f'private, max-age={LINK_MAX_AGE}'
    response['Referrer-Policy'] = 'no-referrer'  # token manzilda: boshqa saytlarga Referer bilan chiqib ketmasin
    if status == 206:
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
    return response


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def book_file(request, token):
    try:
        data = signing.loads(token, salt=SALT, max_age=LINK_MAX_AGE)
        kind = data['k']
        book = Book.objects.get(pk=data['b'])
        user = User.objects.get(pk=data['u'], is_active=True)  # 'u' yo'q (eski havola) -> KeyError -> 404
    except (signing.BadSignature, KeyError, Book.DoesNotExist, User.DoesNotExist):
        raise Http404
    # Havola berilgandan keyin buyurtma bekor qilingan bo'lsa ham fayl berilmaydi
    if not can_access_digital(user, book):
        raise Http404
    field = book.audio_file if kind == 'audio' else book.pdf_file if kind == 'pdf' else None
    if not field:
        raise Http404
    return _serve(request, field, kind)
