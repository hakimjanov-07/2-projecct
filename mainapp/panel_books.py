"""
Admin panel: kitob qo'shish (bitta) va ommaviy (CSV) qo'shish.
Fayl mazmuni hech qachon bajarilmaydi: faqat matn sifatida o'qiladi va qiymatlar tekshirilib saqlanadi.
"""
import csv
import io
import os
import re

from django.db import transaction
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import LANGUAGE, STATUS, Author, Book, Category

MAX_PHOTO_BYTES = 5 * 1024 * 1024
PHOTO_TYPES = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}

MAX_CSV_BYTES = 2 * 1024 * 1024
MAX_CSV_ROWS = 500

DEFAULT_PUBLISHER = '—'  # nashriyot bo'sh bo'lsa (modelda majburiy)


def norm(value):
    """ Moslashtirish uchun: ortiqcha bo'shliqlar olinadi, harf kattaligi va apostrof turi e'tiborsiz """
    value = (value or '').replace('’', "'").replace('ʻ', "'").replace('‘', "'").replace('`', "'")
    return ' '.join(value.split()).casefold()


def validate_photo(photo):
    """ Rasm: kengaytma, MIME turi va hajm (haqiqiy rasm ekanini ImageField/Pillow o'zi tekshiradi) """
    ext = os.path.splitext(photo.name or '')[1].lower()
    if ext not in PHOTO_TYPES:
        raise serializers.ValidationError("Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.")
    content_type = (getattr(photo, 'content_type', '') or '').lower()
    if content_type and content_type != PHOTO_TYPES[ext] and not (content_type == 'image/jpg' and ext in ('.jpg', '.jpeg')):
        raise serializers.ValidationError("Fayl turi rasm kengaytmasiga mos kelmaydi.")
    if photo.size > MAX_PHOTO_BYTES:
        raise serializers.ValidationError("Rasm hajmi 5 MB dan oshmasligi kerak.")
    return photo


def find_duplicate(name, author_key, existing):
    return (norm(name), author_key) in existing


def existing_keys():
    """ Mavjud (nom, muallif) juftliklari """
    return {(norm(n), norm(a)) for n, a in Book.objects.values_list('name', 'author__full_name')}


""" BITTA KITOB """

class BookCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    author = serializers.IntegerField(required=False, allow_null=True)  # mavjud muallif ID
    new_author = serializers.CharField(max_length=100, required=False, allow_blank=True)  # yangi muallif: faqat ism
    category = serializers.IntegerField()
    language = serializers.ChoiceField(choices=LANGUAGE, default='uzbek')
    price = serializers.IntegerField(min_value=1)
    cost_price = serializers.IntegerField(min_value=1)
    pages = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    publisher = serializers.CharField(max_length=100, required=False, allow_blank=True)
    about = serializers.CharField(required=False, allow_blank=True)
    stock = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    status = serializers.ChoiceField(choices=STATUS, default='active')
    photo = serializers.ImageField(required=False, allow_null=True, validators=[validate_photo])

    def validate_name(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError("Kitob nomini kiriting.")
        return value

    def validate(self, data):
        errors = {}
        category = Category.objects.filter(pk=data['category']).first()
        if not category:
            errors['category'] = ["Bunday kategoriya yo'q."]
        author = None
        new_author = ' '.join((data.get('new_author') or '').split())
        if data.get('author'):
            author = Author.objects.filter(pk=data['author']).first()
            if not author:
                errors['author'] = ["Bunday muallif yo'q."]
        elif new_author:
            # bir xil ismli muallif bo'lsa, yangisi yaratilmaydi
            author = next((a for a in Author.objects.all() if norm(a.full_name) == norm(new_author)), None)
        else:
            errors['author'] = ["Muallifni tanlang yoki yangi muallif ismini kiriting."]
        if errors:
            raise serializers.ValidationError(errors)

        author_key = norm(author.full_name if author else new_author)
        if find_duplicate(data['name'], author_key, existing_keys()):
            raise serializers.ValidationError({'name': ["Bu muallifning shu nomli kitobi allaqachon mavjud."]})
        data.update(category_obj=category, author_obj=author, new_author=new_author)
        return data

    def create(self, data):
        with transaction.atomic():
            author = data['author_obj'] or Author.objects.create(full_name=data['new_author'], about='', status='active')
            return Book.objects.create(
                name=data['name'], category=data['category_obj'], author=author, language=data['language'],
                price=data['price'], cost_price=data['cost_price'], pages=data.get('pages') or 0,
                publisher=(data.get('publisher') or '').strip() or DEFAULT_PUBLISHER,
                about=data.get('about') or '', stock=data.get('stock'), status=data['status'],
                photo=data.get('photo') or '',
            )


def create_book(request):
    """ POST /api/panel/books/ (JSON yoki multipart/form-data) """
    serializer = BookCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    book = serializer.save()
    warnings = []
    if book.price < book.cost_price:
        warnings.append("Narx tannarxdan past: zarar bilan sotiladi.")
    return Response({'id': book.id, 'name': book.name, 'warnings': warnings}, status=201)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def panel_book_options(request):
    """ Forma uchun mavjud mualliflar va kategoriyalar """
    return Response({
        'authors': [{'id': a.id, 'name': a.full_name} for a in Author.objects.order_by('full_name')],
        'categories': list(Category.objects.order_by('name').values('id', 'name')),
    })


""" OMMAVIY (CSV) """

# Sarlavha nomlari (norm() dan keyin) -> ichki maydon
HEADERS = {
    'nom': 'name', 'nomi': 'name',
    'muallif': 'author',
    'kategoriya': 'category', 'janr': 'category',
    'til': 'language', 'tili': 'language',
    'narx': 'price', 'narxi': 'price',
    'tannarx': 'cost_price',
    'sahifalar': 'pages', 'sahifa': 'pages',
    'nashriyot': 'publisher', 'nashriyotchi': 'publisher',
    'tavsif': 'about', 'haqida': 'about',
    'ombor': 'stock', 'qoldiq': 'stock',
    'holat': 'status', 'holati': 'status',
}
REQUIRED_COLUMNS = ('name', 'author', 'category', 'price', 'cost_price')

LANG_ALIASES = {'uz': 'uzbek', 'ru': 'russian', 'en': 'english', 'tr': 'turkish', 'de': 'german'}
for _key, _label in LANGUAGE:
    LANG_ALIASES[norm(_key)] = _key
    LANG_ALIASES[norm(_label)] = _key
LANG_ALIASES.update({"o'zbek": 'uzbek', 'rus': 'russian', 'ingliz': 'english', 'turk': 'turkish', 'nemis': 'german'})

ACTIVE_WORDS = {'', 'faol', 'active', 'ha', 'yes', '1'}
INACTIVE_WORDS = {'faol emas', 'nofaol', 'deactive', 'inactive', "yo'q", 'yoq', 'no', '0'}


class ImportFileError(Exception):
    """ Butun fayl yaroqsiz (qator emas) """


def parse_csv(upload):
    """ Fayl -> (sarlavha maydonlari, [(qator raqami, {maydon: matn})]) """
    if upload is None:
        raise ImportFileError("CSV faylni tanlang.")
    if upload.size > MAX_CSV_BYTES:
        raise ImportFileError("Fayl hajmi 2 MB dan oshmasligi kerak.")
    raw = upload.read(MAX_CSV_BYTES + 1)
    if len(raw) > MAX_CSV_BYTES:
        raise ImportFileError("Fayl hajmi 2 MB dan oshmasligi kerak.")
    if not raw.strip():
        raise ImportFileError("Fayl bo'sh.")
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise ImportFileError(
            "Fayl kodlashi UTF-8 emas (ehtimol Windows-1251). Excel'da \"CSV UTF-8\" sifatida qayta saqlang."
        )
    if '\x00' in text:
        raise ImportFileError("Fayl matnli CSV emas.")

    first_line = text.split('\n', 1)[0]
    counts = {d: first_line.count(d) for d in (';', ',', '\t')}
    delimiter = max(counts, key=counts.get)
    if counts[delimiter] == 0:
        raise ImportFileError("Sarlavha qatori topilmadi: ustunlar ';' yoki ',' bilan ajratilishi kerak.")

    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    header = [HEADERS.get(norm(h)) for h in rows[0]]
    missing = [name for name in REQUIRED_COLUMNS if name not in header]
    if missing:
        labels = {'name': 'nom', 'author': 'muallif', 'category': 'kategoriya', 'price': 'narx', 'cost_price': 'tannarx'}
        raise ImportFileError("Sarlavhada majburiy ustun yo'q: " + ', '.join(labels[m] for m in missing) + '.')
    data = []
    for number, cells in enumerate(rows[1:], start=2):
        if not any(c.strip() for c in cells):
            continue
        data.append((number, {field: (cells[i].strip() if i < len(cells) else '') for i, field in enumerate(header) if field}))
    if not data:
        raise ImportFileError("Faylda kitob qatorlari yo'q (faqat sarlavha).")
    if len(data) > MAX_CSV_ROWS:
        raise ImportFileError(f"Qatorlar soni {MAX_CSV_ROWS} tadan oshmasligi kerak (faylda {len(data)} ta).")
    return data


def parse_int(text, label, minimum, required=True):
    text = re.sub(r'[\s ]', '', text or '')
    if not text:
        if required:
            raise ValueError(f"{label} kiritilmagan")
        return None
    if not re.fullmatch(r'\d+', text):
        raise ValueError(f"{label} butun son bo'lishi kerak")
    value = int(text)
    if value < minimum:
        raise ValueError(f"{label} {'musbat' if minimum else 'manfiy emas'} bo'lishi kerak")
    if value > 2_000_000_000:
        raise ValueError(f"{label} juda katta")
    return value


def analyze(data):
    """ Qatorlarni tekshiradi (hech narsa yozmaydi). Natija: [{...preview, 'clean': tayyor qiymatlar yoki None}] """
    authors = {}
    for a in Author.objects.all():
        authors.setdefault(norm(a.full_name), a)
    categories = {}
    for c in Category.objects.all():
        categories.setdefault(norm(c.name), c)
    seen = existing_keys()
    new_authors = set()
    result = []

    for number, row in data:
        item = {
            'row': number, 'name': row.get('name', ''), 'author': row.get('author', ''),
            'category': row.get('category', ''), 'price': row.get('price', ''), 'status': 'new',
            'message': '', 'new_author': False, 'clean': None,
        }
        try:
            name = ' '.join(row.get('name', '').split())
            if not name:
                raise ValueError("nom kiritilmagan")
            if len(name) > 50:
                raise ValueError("nom 50 belgidan uzun")
            author_name = ' '.join(row.get('author', '').split())
            if not author_name:
                raise ValueError("muallif kiritilmagan")
            if len(author_name) > 100:
                raise ValueError("muallif ismi 100 belgidan uzun")
            category = categories.get(norm(row.get('category', '')))
            if not category:
                raise ValueError(f"kategoriya topilmadi: \"{row.get('category', '')}\" (avval kategoriyani yarating)")
            price = parse_int(row.get('price'), 'narx', 1)
            cost_price = parse_int(row.get('cost_price'), 'tannarx', 1)
            pages = parse_int(row.get('pages'), 'sahifalar', 1, required=False)
            stock_text = norm(row.get('stock', ''))
            stock = None if stock_text in ('cheklanmagan', "noma'lum") else parse_int(stock_text, 'ombor', 0, required=False)

            lang_text = norm(row.get('language', ''))
            language = 'uzbek' if not lang_text else LANG_ALIASES.get(lang_text)
            if not language:
                raise ValueError(f"til tanilmadi: \"{row.get('language')}\"")
            status_text = norm(row.get('status', ''))
            if status_text in ACTIVE_WORDS:
                status = 'active'
            elif status_text in INACTIVE_WORDS:
                status = 'deactive'
            else:
                raise ValueError(f"holat tanilmadi: \"{row.get('status')}\" (faol / faol emas)")
            publisher = ' '.join(row.get('publisher', '').split())
            if len(publisher) > 100:
                raise ValueError("nashriyot 100 belgidan uzun")
        except ValueError as exc:
            item.update(status='error', message=str(exc))
            result.append(item)
            continue

        author_key = norm(author_name)
        key = (norm(name), author_key)
        if key in seen:
            item.update(status='duplicate', message="Bu muallifning shu nomli kitobi mavjud yoki faylda takrorlangan")
            result.append(item)
            continue
        seen.add(key)
        is_new_author = author_key not in authors and author_key not in new_authors
        if is_new_author:
            new_authors.add(author_key)
        item.update(
            new_author=is_new_author,
            message='; '.join(filter(None, [
                'Yangi muallif yaratiladi' if is_new_author else '',
                'narx tannarxdan past' if price < cost_price else '',
            ])),
            clean={
                'name': name, 'author_name': author_name, 'author_key': author_key, 'category': category,
                'price': price, 'cost_price': cost_price, 'pages': pages or 0, 'publisher': publisher or DEFAULT_PUBLISHER,
                'about': row.get('about', ''), 'stock': stock, 'language': language, 'status': status,
            },
        )
        result.append(item)
    return result


def public_row(item):
    return {k: v for k, v in item.items() if k != 'clean'}


def summary(items):
    count = lambda s: sum(1 for i in items if i['status'] == s)
    return {
        'total': len(items), 'new': count('new'), 'duplicate': count('duplicate'), 'error': count('error'),
        'new_authors': sum(1 for i in items if i['new_author']),
    }


@api_view(['POST'])
@permission_classes([IsAdminUser])
def panel_books_import(request):
    """
    POST multipart: file (CSV), mode=preview|commit, skip_errors=1 (ixtiyoriy).
    preview: hech narsa yozilmaydi. commit: transaction.atomic; xatolik bo'lsa va skip_errors berilmagan bo'lsa,
    hech narsa qo'shilmaydi (hammasi yoki hech narsa). Takror qatorlar har doim o'tkazib yuboriladi.
    """
    mode = request.data.get('mode', 'preview')
    if mode not in ('preview', 'commit'):
        return Response({'detail': "mode: preview yoki commit."}, status=400)
    try:
        data = parse_csv(request.FILES.get('file'))
    except ImportFileError as exc:
        return Response({'detail': str(exc)}, status=400)

    skip_errors = str(request.data.get('skip_errors', '')).lower() in ('1', 'true', 'on')

    if mode == 'preview':
        items = analyze(data)
        return Response({'summary': summary(items), 'rows': [public_row(i) for i in items]})

    with transaction.atomic():
        items = analyze(data)  # tranzaksiya ichida qayta tekshiriladi (preview'dan keyin o'zgargan bo'lishi mumkin)
        stats = summary(items)
        if stats['error'] and not skip_errors:
            return Response({
                'detail': f"{stats['error']} ta qatorda xato bor: hech narsa qo'shilmadi. Xatolarni tuzating yoki "
                          "\"faqat xatosizlarini qo'shish\"ni tanlang.",
                'summary': stats, 'rows': [public_row(i) for i in items],
            }, status=400)
        authors = {}
        for a in Author.objects.all():
            authors.setdefault(norm(a.full_name), a)
        created = 0
        for item in items:
            clean = item['clean']
            if item['status'] != 'new' or not clean:
                continue
            author = authors.get(clean['author_key'])
            if not author:
                author = authors[clean['author_key']] = Author.objects.create(
                    full_name=clean['author_name'], about='', status='active',
                )
            Book.objects.create(
                name=clean['name'], category=clean['category'], author=author, language=clean['language'],
                price=clean['price'], cost_price=clean['cost_price'], pages=clean['pages'],
                publisher=clean['publisher'], about=clean['about'], stock=clean['stock'], status=clean['status'],
                photo='',
            )
            created += 1
    return Response({
        'created': created, 'skipped_duplicates': stats['duplicate'], 'skipped_errors': stats['error'],
        'summary': stats,
    }, status=201)


TEMPLATE_HEADER = ['nom', 'muallif', 'kategoriya', 'til', 'narx', 'tannarx', 'sahifalar', 'nashriyot', 'tavsif', 'ombor', 'holat']
TEMPLATE_ROWS = [
    ["O'tkan kunlar", 'Abdulla Qodiriy', 'Badiiy adabiyot', 'uzbek', 45000, 30000, 320, 'Sharq', "Ilk o'zbek romani", 50, 'faol'],
    ['Mehrobdan chayon', 'Abdulla Qodiriy', 'Badiiy adabiyot', 'uzbek', 38000, 25000, 280, 'Sharq', '', '', 'faol'],
    ['Yangi muallif kitobi', 'Yangi Muallif', 'Badiiy adabiyot', 'russian', 52000, 40000, '', '', 'Tavsif ixtiyoriy', 0, 'faol emas'],
]


@api_view(['GET'])
@permission_classes([IsAdminUser])
def panel_books_import_template(request):
    """ Namuna CSV: UTF-8 (BOM), ';' ajratgich (Excel'da to'g'ri ochiladi) """
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="kitoblar-namuna.csv"'
    response.write('﻿')
    writer = csv.writer(response, delimiter=';')
    writer.writerow(TEMPLATE_HEADER)
    writer.writerows(TEMPLATE_ROWS)
    return response
