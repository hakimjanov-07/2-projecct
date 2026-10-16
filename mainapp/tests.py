import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Category, Author, Book, Order, OrderItem, PasswordResetCode, PromoCode, Review


# Qabul qilish usuli endi majburiy: yetkazib berish uchun to'liq manzil
DELIVERY = {
    'delivery_method': 'delivery', 'recipient_name': 'Ali', 'recipient_phone': '+998901234567',
    'city': 'Toshkent', 'street': 'Navoiy 1',
}
PICKUP = {'delivery_method': 'pickup'}


class BookShopAPITestCase(TestCase):
    def setUp(self):
        cache.clear()  # login/register throttle hisoblagichlari testlar orasida tozalanadi
        self.client = APIClient()
        self.category = Category.objects.create(name='Badiiy adabiyot', status='active')
        self.author = Author.objects.create(
            full_name='Abdulla Qodiriy',
            about='Mashhur o\'zbek adibi',
            status='active'
        )
        self.book = Book.objects.create(
            name='O\'tkan kunlar',
            category=self.category,
            author=self.author,
            language='uzbek',
            price=45000,
            about='Ilk o\'zbek romani',
            publisher='Sharq',
            pages=320,
            status='active'
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123'
        )

    def test_category_list(self):
        response = self.client.get('/api/category/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_book_list_and_detail(self):
        response = self.client.get('/api/book/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        detail_res = self.client.get(f'/api/book/{self.book.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data['name'], 'O\'tkan kunlar')
        self.assertIn('avg_rating', detail_res.data)

    def test_user_registration(self):
        payload = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'secretpassword'
        }
        response = self.client.post('/api/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)

    def test_user_duplicate_username_registration(self):
        payload = {
            'username': 'testuser',
            'email': 'different@example.com',
            'password': 'secretpassword'
        }
        response = self.client.post('/api/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_duplicate_email_registration(self):
        payload = {
            'username': 'otheruser',
            'email': 'test@example.com',
            'password': 'secretpassword'
        }
        response = self.client.post('/api/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Email mavjudligi aniq aytilmaydi (enumeratsiyani qiyinlashtirish), username band xabari esa qoladi
        message = response.data['email'][0]
        self.assertIn("ro'yxatdan o'tib bo'lmadi", message)
        self.assertNotIn('allaqachon', message)
        self.assertNotIn('username', response.data)

    def test_user_duplicate_username_message_stays_specific(self):
        response = self.client.post(
            '/api/register/', {'username': 'TESTUSER', 'email': 'fresh@example.com', 'password': 'secretpassword'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['username'][0], 'Bu username band.')
        self.assertNotIn('email', response.data)

    def test_user_login_username(self):
        payload = {
            'username': 'testuser',
            'password': 'password123'
        }
        response = self.client.post('/api/token/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_user_login_email(self):
        payload = {
            'username': 'test@example.com',
            'password': 'password123'
        }
        response = self.client.post('/api/token/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_cart_operations(self):
        self.client.force_authenticate(user=self.user)
        
        # Add to cart
        add_res = self.client.post('/api/cart/add/', {'book_id': self.book.id, 'quantity': 2}, format='json')
        self.assertEqual(add_res.status_code, status.HTTP_200_OK)

        # Get cart
        cart_res = self.client.get('/api/cart/')
        self.assertEqual(cart_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(cart_res.data['items']), 1)
        self.assertEqual(cart_res.data['total_items'], 2)
        self.assertEqual(cart_res.data['total_price'], 90000)

        # Remove from cart
        item_id = cart_res.data['items'][0]['id']
        del_res = self.client.delete(f'/api/cart/remove/{item_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)

    def test_review_creation_and_unique_constraint(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            'book': self.book.id,
            'rating': 5,
            'comment': 'Ajoyib asar, tavsiya qilaman!'
        }
        res1 = self.client.post('/api/review/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Mine review
        mine_res = self.client.get(f'/api/review/mine/?book={self.book.id}')
        self.assertEqual(mine_res.status_code, status.HTTP_200_OK)
        self.assertEqual(mine_res.data['rating'], 5)


class SecurityAndValidationTests(BookShopAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_superuser('admin', 'admin@example.com', 'adminpass123')

    def test_anonymous_cannot_modify_catalog(self):
        self.assertEqual(self.client.delete(f'/api/book/{self.book.id}/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post('/api/category/', {'name': 'X', 'status': 'active'}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Book.objects.filter(id=self.book.id).exists())

    def test_regular_user_cannot_modify_catalog(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.delete(f'/api/author/{self.author.id}/').status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_modify_catalog(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post('/api/category/', {'name': 'Yangi', 'status': 'active'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_cart_rejects_invalid_quantity(self):
        self.client.force_authenticate(user=self.user)
        for bad in ('abc', -5, 0, 1000):
            res = self.client.post('/api/cart/add/', {'book_id': self.book.id, 'quantity': bad}, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, bad)
        self.assertEqual(OrderItem.objects.count(), 0)

    def test_cart_unknown_book(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/add/', {'book_id': 9999}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_checkout_creates_confirmed_order(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 3}], **DELIVERY}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # 3 x 45 000 = 135 000 (300 000 dan kam, shuning uchun yetkazib berish pullik)
        self.assertEqual(res.data['subtotal'], 135000)
        self.assertEqual(res.data['delivery_fee'], 20000)
        self.assertEqual(res.data['total_price'], 155000)
        orders = self.client.get('/api/order/')
        self.assertEqual(orders.data['count'], 1)
        self.assertEqual(self.client.post('/api/cart/checkout/', {'items': []}, format='json').status_code, 400)

    def test_orders_are_private(self):
        other = User.objects.create_user('other', 'other@example.com', 'password123')
        order = Order.objects.create(user=other, status='confirmed')
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(f'/api/order/{order.id}/').status_code, status.HTTP_404_NOT_FOUND)

    def test_weak_password_rejected(self):
        res = self.client.post('/api/register/', {'username': 'weak', 'email': 'weak@example.com', 'password': '1'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res.data)

    def test_one_review_per_user_per_book(self):
        self.client.force_authenticate(user=self.user)
        payload = {'book': self.book.id, 'rating': 4, 'comment': 'Yaxshi kitob'}
        self.assertEqual(self.client.post('/api/review/', payload, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/review/', payload, format='json').status_code, 400)

    def test_review_for_missing_book_and_bad_rating(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post('/api/review/', {'book': 9999, 'rating': 4, 'comment': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/review/', {'book': self.book.id, 'rating': 9, 'comment': 'x'}, format='json').status_code, 400)

    def test_cannot_edit_other_users_review(self):
        other = User.objects.create_user('other', 'other@example.com', 'password123')
        review = Review.objects.create(user=other, book=self.book, rating=3, comment='Oddiy')
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(f'/api/review/{review.id}/', {'comment': 'buzildi'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_avg_rating(self):
        other = User.objects.create_user('other', 'other@example.com', 'password123')
        Review.objects.create(user=self.user, book=self.book, rating=5, comment='a')
        Review.objects.create(user=other, book=self.book, rating=4, comment='b')
        res = self.client.get(f'/api/book/{self.book.id}/')
        self.assertEqual(res.data['avg_rating'], 4.5)
        self.assertEqual(res.data['reviews_count'], 2)


class PricingTests(BookShopAPITestCase):
    def setUp(self):
        super().setUp()
        PromoCode.objects.create(code='bookuz10', discount_percent=10)
        PromoCode.objects.create(code='OLD', discount_percent=50, is_active=False)

    def quote(self, quantity, promo=''):
        return self.client.post(
            '/api/cart/quote/',
            {'items': [{'book_id': self.book.id, 'quantity': quantity}], 'promo_code': promo, 'delivery_method': 'delivery'},
            format='json',
        )

    def test_quote_is_public_and_charges_delivery(self):
        res = self.quote(2)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['subtotal'], 90000)
        self.assertEqual(res.data['discount'], 0)
        self.assertEqual(res.data['delivery_fee'], 20000)
        self.assertEqual(res.data['total'], 110000)

    def test_quote_returns_current_lines_and_missing(self):
        # Qatorlar joriy narx bilan, yo'q kitob 'missing'da; jami qatorlar yig'indisiga teng
        res = self.client.post(
            '/api/cart/quote/',
            {'items': [{'book_id': self.book.id, 'quantity': 2}, {'book_id': 999999, 'quantity': 1}], **PICKUP},
            format='json',
        )
        self.assertEqual(res.data['missing'], [999999])
        self.assertEqual(len(res.data['items']), 1)
        line = res.data['items'][0]
        self.assertEqual((line['id'], line['name'], line['price'], line['line_total']), (self.book.id, self.book.name, 45000, 90000))
        self.assertEqual(res.data['subtotal'], sum(i['line_total'] for i in res.data['items']))

    def test_free_delivery_from_threshold(self):
        res = self.quote(7)  # 315 000
        self.assertEqual(res.data['delivery_fee'], 0)
        self.assertEqual(res.data['total'], 315000)

    def test_promo_code_is_case_insensitive_and_applies_discount(self):
        res = self.quote(2, ' BookUz10 ')
        self.assertTrue(res.data['promo_valid'])
        self.assertEqual(res.data['promo'], {'code': 'BOOKUZ10', 'percent': 10})
        self.assertEqual(res.data['discount'], 9000)
        self.assertEqual(res.data['total'], 90000 - 9000 + 20000)

    def test_discount_can_remove_free_delivery(self):
        # 7 x 45 000 = 315 000, 10% chegirmadan keyin 283 500 < 300 000
        res = self.quote(7, 'BOOKUZ10')
        self.assertEqual(res.data['delivery_fee'], 20000)

    def test_invalid_or_inactive_promo(self):
        for code in ('NOPE', 'OLD'):
            res = self.quote(2, code)
            self.assertFalse(res.data['promo_valid'])
            self.assertIsNone(res.data['promo'])
            self.assertEqual(res.data['discount'], 0)

    def test_checkout_stores_discount_and_delivery(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            '/api/cart/checkout/',
            {'items': [{'book_id': self.book.id, 'quantity': 2}], 'promo_code': 'bookuz10', **DELIVERY},
            format='json',
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['promo_code'], 'BOOKUZ10')
        self.assertEqual(res.data['discount'], 9000)
        self.assertEqual(res.data['total_price'], 101000)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual((order.discount, order.delivery_fee), (9000, 20000))

    def test_checkout_rejects_bad_promo(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            '/api/cart/checkout/',
            {'items': [{'book_id': self.book.id, 'quantity': 1}], 'promo_code': 'NOPE', **PICKUP},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)


class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()  # throttling hisoblagichlari testlar orasida tozalanadi
        self.client = APIClient()
        self.user = User.objects.create_user('resetuser', 'reset@example.com', 'OldPassw0rd!x')

    def request_code(self, email='reset@example.com'):
        return self.client.post('/api/password/forgot/', {'email': email}, format='json')

    def sent_code(self):
        return re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)

    def reset(self, code, password='BrandNewPassw0rd!', email='reset@example.com'):
        return self.client.post(
            '/api/password/reset/', {'email': email, 'code': code, 'password': password}, format='json'
        )

    def test_code_is_emailed_and_only_hash_is_stored(self):
        res = self.request_code()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['reset@example.com'])
        code = self.sent_code()
        record = PasswordResetCode.objects.get(user=self.user)
        self.assertNotIn(code, record.code_hash)
        self.assertEqual(len(record.code_hash), 64)

    def test_email_is_sent_from_site_name_with_html_version(self):
        self.request_code()
        message = mail.outbox[0]
        code = self.sent_code()
        self.assertTrue(message.from_email.startswith('BookShop <'), message.from_email)
        self.assertIn(code, message.subject)
        self.assertIn('BookShop', message.subject)
        html, mimetype = message.alternatives[0]
        self.assertEqual(mimetype, 'text/html')
        self.assertIn(code, html)
        self.assertIn('BookShop', html)

    def test_unknown_email_gets_same_response_and_no_mail(self):
        known = self.request_code()
        unknown = self.request_code('nobody@example.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.data['message'], unknown.data['message'])
        self.assertEqual(len(mail.outbox), 1)

    def test_resend_is_rate_limited_per_user(self):
        self.request_code()
        first = self.sent_code()
        self.request_code()
        self.assertEqual(len(mail.outbox), 1)
        PasswordResetCode.objects.update(created_on=timezone.now() - timedelta(seconds=120))
        self.request_code()
        self.assertEqual(len(mail.outbox), 2)
        # Soatlik limit hisobi uchun eski kod yozuvi saqlanadi, lekin faqat eng yangi kod amal qiladi
        second = self.sent_code()
        self.assertEqual(PasswordResetCode.objects.filter(user=self.user).count(), 2)
        if first != second:
            self.assertEqual(self.reset(first).status_code, 400)
        self.assertEqual(self.reset(second).status_code, 200)

    def test_reset_with_correct_code_changes_password_once(self):
        self.request_code()
        code = self.sent_code()
        self.assertEqual(self.reset(code).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNewPassw0rd!'))
        self.assertEqual(self.reset(code, 'AnotherPassw0rd!').status_code, 400)
        login = self.client.post('/api/token/', {'username': 'resetuser', 'password': 'BrandNewPassw0rd!'}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_wrong_code_is_rejected_and_attempts_are_limited(self):
        self.request_code()
        code = self.sent_code()
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(5):
            self.assertEqual(self.reset(wrong).status_code, 400)
        # 5 ta noto'g'ri urinishdan keyin to'g'ri kod ham ishlamaydi
        self.assertEqual(self.reset(code).status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPassw0rd!x'))

    def test_expired_code_is_rejected(self):
        self.request_code()
        code = self.sent_code()
        PasswordResetCode.objects.update(expires_on=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.reset(code).status_code, 400)

    def test_weak_password_keeps_code_valid(self):
        self.request_code()
        code = self.sent_code()
        weak = self.reset(code, '123')
        self.assertEqual(weak.status_code, 400)
        self.assertIn('password', weak.data)
        self.assertEqual(self.reset(code).status_code, 200)

    def test_reset_for_unknown_email_fails_generically(self):
        res = self.reset('123456', email='nobody@example.com')
        self.assertEqual(res.status_code, 400)
        self.assertIn('code', res.data)


class ProfileTests(BookShopAPITestCase):
    url = '/api/profile/'

    def test_requires_login(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.patch(self.url, {'phone': '1'}, format='json').status_code, 401)

    def test_get_creates_empty_profile(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'testuser')
        self.assertEqual(res.data['email'], 'test@example.com')
        self.assertEqual(res.data['phone'], '')

    def test_patch_saves_fields_and_email(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(self.url, {
            'full_name': 'Test Foydalanuvchi', 'phone': '+998901234567',
            'address': 'Toshkent', 'bio': 'Kitob sevaman', 'email': 'new@example.com',
            'current_password': 'password123',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'new@example.com')
        again = self.client.get(self.url)
        self.assertEqual(again.data['full_name'], 'Test Foydalanuvchi')
        self.assertEqual(again.data['address'], 'Toshkent')

    def test_partial_patch_keeps_other_fields(self):
        self.client.force_authenticate(user=self.user)
        self.client.patch(self.url, {'phone': '123'}, format='json')
        res = self.client.patch(self.url, {'address': 'Samarqand'}, format='json')
        self.assertEqual(res.data['phone'], '123')
        self.assertEqual(res.data['address'], 'Samarqand')

    def test_email_cannot_duplicate_other_user(self):
        User.objects.create_user(username='other', email='taken@example.com', password='password123')
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(self.url, {'email': 'TAKEN@example.com', 'current_password': 'password123'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)
        self.assertEqual(str(res.data['email'][0]), 'Bu email band.')  # mavjudlikni ochiq aytmaydi

    def test_users_have_separate_profiles(self):
        other = User.objects.create_user(username='other', email='o@example.com', password='password123')
        self.client.force_authenticate(user=self.user)
        self.client.patch(self.url, {'phone': '111'}, format='json')
        self.client.force_authenticate(user=other)
        self.assertEqual(self.client.get(self.url).data['phone'], '')


class PanelTests(TestCase):
    """ Admin panel API: ruxsatlar va hisob-kitoblar """

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', email='boss@example.com', password='password123', is_staff=True)
        # 1) tasdiqlangan: 2 x 45000 = 90000, chegirma 9000, yetkazib berish 20000 -> 101000
        o1 = Order.objects.create(user=self.user, status='confirmed', promo_code='AKSIYA7', discount=9000, delivery_fee=20000)
        OrderItem.objects.create(order=o1, book=self.book, quantity=2)
        # 2) tasdiqlangan: 1 x 45000 + 20000 = 65000
        o2 = Order.objects.create(user=self.user, status='confirmed', delivery_fee=20000)
        OrderItem.objects.create(order=o2, book=self.book, quantity=1)
        # 3) bekor qilingan: hisobga kirmaydi
        o3 = Order.objects.create(user=self.user, status='cancelled', delivery_fee=20000)
        OrderItem.objects.create(order=o3, book=self.book, quantity=5)
        # 4) savat (pending): buyurtma emas, tushumga kirmaydi
        cart = Order.objects.create(user=self.user, status='pending')
        OrderItem.objects.create(order=cart, book=self.book, quantity=4)
        self.o1, self.o2, self.o3, self.cart = o1, o2, o3, cart

    URLS = ['/api/panel/summary/', '/api/panel/orders/', '/api/panel/books/', '/api/panel/users/']

    def test_user_detail_requires_staff(self):
        url = f'/api/panel/users/{self.user.id}/'
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_user_detail_content(self):
        other = User.objects.create_user(username='other', email='o@example.com', password='password123')
        oo = Order.objects.create(user=other, status='confirmed')
        OrderItem.objects.create(order=oo, book=self.book, quantity=3)
        Review.objects.create(user=self.user, book=self.book, rating=4, comment='Yaxshi kitob')
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(f'/api/panel/users/{self.user.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('password', str(res.data).lower())
        self.assertEqual(res.data['profile']['username'], 'testuser')
        stats = res.data['stats']
        self.assertEqual((stats['orders_count'], stats['spent'], stats['average']), (2, 166000, 83000))
        self.assertEqual(stats['cancelled_count'], 1)
        self.assertEqual(stats['promo_codes'], ['AKSIYA7'])
        ids = [o['id'] for o in res.data['orders']]
        self.assertEqual(ids, [self.o3.id, self.o2.id, self.o1.id])  # yangidan eskiga, savatsiz
        self.assertNotIn(oo.id, ids)
        self.assertEqual(res.data['orders'][2]['items'][0]['quantity'], 2)
        self.assertEqual(len(res.data['reviews']), 1)
        self.assertEqual(res.data['cart']['id'], self.cart.id)
        self.assertEqual(res.data['cart']['items'][0]['quantity'], 4)
        # bo'sh foydalanuvchi: savat yo'q, ro'yxatlar bo'sh
        empty = self.client.get(f'/api/panel/users/{self.staff.id}/')
        self.assertEqual((empty.data['orders'], empty.data['reviews'], empty.data['cart']), ([], [], None))
        self.assertEqual(empty.data['stats']['average'], 0)

    def test_new_orders_count_requires_staff(self):
        url = '/api/panel/orders/new-count/'
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_new_orders_count_only_confirmed(self):
        url = '/api/panel/orders/new-count/'
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        # setUp: 2 ta confirmed; cancelled va pending hisoblanmaydi
        self.assertEqual(res.data['count'], 2)
        self.assertEqual(res.data['latest_id'], self.o2.id)
        Order.objects.create(user=self.user, status='processing')
        Order.objects.create(user=self.user, status='shipped')
        Order.objects.create(user=self.user, status='delivered')
        self.assertEqual(self.client.get(url).data['count'], 2)
        # keyingi bosqichga o'tkazilsa son kamayadi
        self.client.patch(f'/api/panel/orders/{self.o1.id}/', {'status': 'processing'}, format='json')
        self.assertEqual(self.client.get(url).data['count'], 1)
        Order.objects.filter(pk=self.o2.pk).update(status='cancelled')
        res = self.client.get(url)
        self.assertEqual((res.data['count'], res.data['latest_id']), (0, None))

    def test_user_detail_not_found(self):
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get('/api/panel/users/999999/').status_code, 404)

    def test_endpoints_require_staff(self):
        for url in self.URLS:
            self.assertEqual(self.client.get(url).status_code, 401, url)
        self.client.force_authenticate(user=self.user)
        for url in self.URLS:
            self.assertEqual(self.client.get(url).status_code, 403, url)
        self.assertEqual(self.client.patch(f'/api/panel/orders/{self.o1.id}/', {'status': 'confirmed'}, format='json').status_code, 403)

    def test_login_only_for_staff(self):
        ok = self.client.post('/api/panel/login/', {'username': 'boss', 'password': 'password123'}, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertIn('access', ok.data)
        regular = self.client.post('/api/panel/login/', {'username': 'testuser', 'password': 'password123'}, format='json')
        self.assertEqual(regular.status_code, 401)
        wrong = self.client.post('/api/panel/login/', {'username': 'boss', 'password': 'xato'}, format='json')
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(regular.data, wrong.data)

    def test_summary_numbers(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/panel/summary/?days=30')
        self.assertEqual(res.status_code, 200)
        cur = res.data['current']
        self.assertEqual(cur['count'], 2)
        self.assertEqual(cur['revenue'], 101000 + 65000)
        self.assertEqual(cur['cancelled'], 1)
        self.assertEqual(res.data['carts'], {'count': 1, 'value': 180000})
        self.assertEqual(cur['avg_order'], 83000)
        self.assertEqual(cur['discounts'], 9000)
        self.assertEqual(cur['books'], 3)
        self.assertEqual(res.data['top_books'][0]['qty'], 3)
        self.assertEqual(res.data['top_books'][0]['revenue'], 135000)
        self.assertEqual(sum(d['revenue'] for d in res.data['series']), 166000)
        self.assertEqual(len(res.data['series']), 31)
        statuses = {s['status']: s for s in res.data['statuses']}
        self.assertEqual(statuses['cancelled']['count'], 1)
        self.assertEqual(res.data['totals']['revenue'], 166000)
        self.assertEqual(res.data['top_customers'][0]['spent'], 166000)

    def test_summary_days_is_clamped(self):
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get('/api/panel/summary/?days=99999').data['days'], 365)
        self.assertEqual(self.client.get('/api/panel/summary/?days=abc').data['days'], 30)

    def test_orders_list_filter_and_search(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/panel/orders/')
        self.assertEqual(res.data['count'], 3)  # savat (pending) ro'yxatda yo'q
        by_id = {o['id']: o for o in res.data['results']}
        self.assertEqual(by_id[self.o1.id]['total'], 101000)
        self.assertEqual(by_id[self.o1.id]['items_count'], 2)
        self.assertEqual(by_id[self.o2.id]['total'], 65000)
        self.assertEqual(self.client.get('/api/panel/orders/?status=cancelled').data['count'], 1)
        self.assertEqual(self.client.get('/api/panel/orders/?q=AKSIYA7').data['count'], 1)
        self.assertEqual(self.client.get(f'/api/panel/orders/?q=%23{self.o2.id}').data['count'], 1)
        self.assertEqual(self.client.get(f'/api/panel/orders/?user={self.staff.id}').data['count'], 0)
        self.assertEqual(self.client.get('/api/panel/orders/?status=pending').data['count'], 3)
        self.assertEqual(self.client.get(f'/api/panel/orders/{self.cart.id}/').status_code, 404)

    def test_order_detail_and_status_change(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(f'/api/panel/orders/{self.o1.id}/')
        self.assertEqual(res.data['items'][0]['line_total'], 90000)
        self.assertEqual(res.data['items'][0]['book_name'], self.book.name)
        patch = self.client.patch(f'/api/panel/orders/{self.o1.id}/', {'status': 'cancelled', 'discount': 1}, format='json')
        self.assertEqual(patch.status_code, 200)
        self.o1.refresh_from_db()
        self.assertEqual(self.o1.status, 'cancelled')
        self.assertEqual(self.o1.discount, 9000)  # boshqa maydonlar o'zgarmaydi
        bad = self.client.patch(f'/api/panel/orders/{self.o1.id}/', {'status': 'nomalum'}, format='json')
        self.assertEqual(bad.status_code, 400)
        as_cart = self.client.patch(f'/api/panel/orders/{self.o1.id}/', {'status': 'pending'}, format='json')
        self.assertEqual(as_cart.status_code, 400)

    def test_books_stats_and_edit(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/panel/books/')
        row = res.data['results'][0]
        self.assertEqual((row['sold'], row['revenue'], row['orders_count']), (3, 135000, 2))
        patch = self.client.patch(f'/api/panel/books/{self.book.id}/', {'price': 50000, 'name': 'Boshqa'}, format='json')
        self.assertEqual(patch.status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.price, 50000)
        self.assertEqual(self.book.name, "O'tkan kunlar")
        self.assertEqual(self.client.get('/api/panel/books/?ordering=-sold').status_code, 200)
        self.assertEqual(self.client.get('/api/panel/books/?ordering=hack').status_code, 200)

    def test_users_stats(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/panel/users/?ordering=-spent')
        rows = {u['username']: u for u in res.data['results']}
        self.assertEqual(rows['testuser']['spent'], 166000)
        self.assertEqual(rows['testuser']['orders_count'], 2)
        self.assertEqual(rows['boss']['spent'], 0)
        self.assertEqual(res.data['results'][0]['username'], 'testuser')
        self.assertEqual(self.client.get('/api/panel/users/?staff=1').data['count'], 1)
        self.assertEqual(self.client.get('/api/panel/users/?q=boss').data['count'], 1)

    def test_price_is_frozen_at_checkout(self):
        """ Kitob narxi keyin o'zgarsa ham, eski buyurtma summasi va tushum o'zgarmaydi """
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 2}], **PICKUP}, format='json')
        self.assertEqual(res.status_code, 201)
        order_id = res.data['id']
        self.assertEqual(OrderItem.objects.get(order_id=order_id).price, 45000)
        total_before = res.data['total_price']

        self.book.price = 90000
        self.book.save()

        site = self.client.get(f'/api/order/{order_id}/')
        self.assertEqual(site.data['total_price'], total_before)
        self.assertEqual(site.data['items'][0]['price'], 45000)

        self.client.force_authenticate(user=self.staff)
        detail = self.client.get(f'/api/panel/orders/{order_id}/')
        self.assertEqual(detail.data['total'], total_before)
        self.assertEqual(detail.data['items'][0]['line_total'], 90000)
        book_row = self.client.get('/api/panel/books/').data['results'][0]
        # narxi saqlanmagan 3 dona joriy narx (90000) bilan + checkout'da muzlatilgan 2 dona 45000 dan
        self.assertEqual(book_row['revenue'], 3 * 90000 + 2 * 45000)

    def test_checkout_logs_first_event_and_cart_logs_none(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 1}], **PICKUP}, format='json')
        self.assertEqual([e['status'] for e in res.data['events']], ['confirmed'])
        self.assertEqual(self.cart.events.count(), 0)  # savat buyurtma emas

    def test_status_changes_are_logged_once(self):
        self.o2.status = 'processing'
        self.o2.save()
        self.o2.save()  # holat o'zgarmadi: yangi yozuv yo'q
        self.o2.status = 'shipped'
        self.o2.save()
        self.assertEqual(list(self.o2.events.values_list('status', flat=True)), ['confirmed', 'processing', 'shipped'])

    def test_panel_stage_change_is_logged_and_visible_to_customer(self):
        self.client.force_authenticate(user=self.staff)
        for status in ('processing', 'shipped', 'delivered'):
            res = self.client.patch(f'/api/panel/orders/{self.o2.id}/', {'status': status}, format='json')
            self.assertEqual(res.status_code, 200)
        detail = self.client.get(f'/api/panel/orders/{self.o2.id}/')
        self.assertEqual([e['status'] for e in detail.data['events']], ['confirmed', 'processing', 'shipped', 'delivered'])
        self.client.force_authenticate(user=self.user)
        mine = self.client.get(f'/api/order/{self.o2.id}/')
        self.assertEqual(mine.data['status'], 'delivered')
        self.assertEqual(mine.data['events'][-1]['status'], 'delivered')

    def test_all_stages_count_as_revenue_but_cancelled_does_not(self):
        self.o2.status = 'delivered'
        self.o2.save()
        self.o1.status = 'shipped'
        self.o1.save()
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/panel/summary/?days=30')
        self.assertEqual(res.data['current']['revenue'], 101000 + 65000)
        self.assertEqual(res.data['current']['count'], 2)
        statuses = {s['status']: s['count'] for s in res.data['statuses']}
        self.assertEqual(statuses['delivered'], 1)
        self.assertEqual(statuses['shipped'], 1)
        self.assertEqual(statuses['cancelled'], 1)
        self.assertEqual(self.client.get('/api/panel/orders/?status=shipped').data['count'], 1)


class StockTests(TestCase):
    """ Ombor qoldig'i: checkout, bekor qilish, savat va panel """

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', email='boss@example.com', password='password123', is_staff=True)
        self.second = Book.objects.create(
            name='Ikkinchi kitob', category=self.category, author=self.author, language='uzbek',
            price=30000, about='x', publisher='y', pages=100, status='active',
        )

    def checkout(self, *pairs):
        items = [{'book_id': book.id, 'quantity': qty} for book, qty in pairs]
        return self.client.post('/api/cart/checkout/', {'items': items, **PICKUP}, format='json')

    def test_untracked_book_is_unlimited(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.checkout((self.book, 50)).status_code, 201)
        self.book.refresh_from_db()
        self.assertIsNone(self.book.stock)

    def test_checkout_decreases_stock(self):
        self.book.stock = 5
        self.book.save()
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.checkout((self.book, 3)).status_code, 201)
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 2)

    def test_not_enough_stock_blocks_whole_order(self):
        self.book.stock = 2
        self.book.save()
        self.second.stock = 10
        self.second.save()
        self.client.force_authenticate(user=self.user)
        res = self.checkout((self.second, 4), (self.book, 3))
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.data['items'], [{'book_id': self.book.id, 'name': self.book.name, 'available': 2}])
        self.assertEqual(Order.objects.count(), 0)
        self.second.refresh_from_db()
        self.assertEqual(self.second.stock, 10)  # yetarli kitob ham kamaymagan

    def test_sold_out_book_cannot_be_ordered(self):
        self.book.stock = 0
        self.book.save()
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.checkout((self.book, 1)).status_code, 409)

    def test_cancel_restocks_and_reconfirm_takes_again(self):
        self.book.stock = 5
        self.book.save()
        self.client.force_authenticate(user=self.user)
        order = Order.objects.get(pk=self.checkout((self.book, 3)).data['id'])
        order.status = 'cancelled'
        order.save()
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 5)
        order.status = 'processing'
        order.save()
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 2)
        order.status = 'shipped'  # faol bosqichlar orasida o'tish omborga tegmaydi
        order.save()
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 2)

    def test_reconfirm_never_goes_below_zero(self):
        self.book.stock = 3
        self.book.save()
        self.client.force_authenticate(user=self.user)
        order = Order.objects.get(pk=self.checkout((self.book, 3)).data['id'])
        order.status = 'cancelled'
        order.save()
        Book.objects.filter(pk=self.book.pk).update(stock=1)  # boshqalar sotib yuborgan
        order.status = 'confirmed'
        order.save()
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 0)

    def test_server_cart_respects_stock(self):
        self.book.stock = 2
        self.book.save()
        self.client.force_authenticate(user=self.user)
        self.client.post('/api/cart/add/', {'book_id': self.book.id, 'quantity': 5}, format='json')
        self.assertEqual(OrderItem.objects.get(order__status='pending', book=self.book).quantity, 2)
        self.book.stock = 0
        self.book.save()
        self.assertEqual(self.client.post('/api/cart/add/', {'book_id': self.book.id, 'quantity': 1}, format='json').status_code, 409)

    def test_book_api_exposes_stock(self):
        self.book.stock = 4
        self.book.save()
        self.assertEqual(self.client.get(f'/api/book/{self.book.id}/').data['stock'], 4)

    def test_panel_edit_filter_and_summary(self):
        self.client.force_authenticate(user=self.staff)
        for book, value in ((self.book, 0), (self.second, 3)):
            res = self.client.patch(f'/api/panel/books/{book.id}/', {'stock': value}, format='json')
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data['stock'], value)
        self.assertEqual(self.client.get('/api/panel/books/?stock=out').data['count'], 1)
        self.assertEqual(self.client.get('/api/panel/books/?stock=low').data['count'], 2)
        summary = self.client.get('/api/panel/summary/').data['stock']
        self.assertEqual((summary['tracked'], summary['out'], summary['low']), (2, 1, 1))
        self.assertEqual(summary['low_books'][0]['stock'], 0)
        cleared = self.client.patch(f'/api/panel/books/{self.book.id}/', {'stock': None}, format='json')
        self.assertIsNone(cleared.data['stock'])
        self.assertEqual(self.client.get('/api/panel/books/?stock=tracked').data['count'], 1)
        # Ish oynasi: cheklanmagan filtri va tafsilot maydonlari
        unlimited = self.client.get('/api/panel/books/?stock=unlimited').data
        self.assertEqual(unlimited['count'], 1)
        row = unlimited['results'][0]
        self.assertTrue({'pages', 'publisher', 'about'} <= set(row))
        bad =self.client.patch(f'/api/panel/books/{self.book.id}/', {'stock': -1}, format='json')
        self.assertEqual(bad.status_code, 400)


class DigitalBookTests(TestCase):
    """ Audio/PDF: faqat xarid qilganlar uchun, imzolangan havola va Range """

    def setUp(self):
        import shutil
        import tempfile
        from django.core.files.base import ContentFile
        from django.test import override_settings

        self.tmp = tempfile.mkdtemp()
        override = override_settings(PRIVATE_MEDIA_ROOT=self.tmp)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(shutil.rmtree, self.tmp, True)

        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', email='boss@example.com', password='password123', is_staff=True)
        self.audio_bytes = bytes(range(256)) * 8  # 2048 bayt
        self.book.audio_file.save('demo.mp3', ContentFile(self.audio_bytes))
        self.book.pdf_file.save('demo.pdf', ContentFile(b'%PDF-1.4 demo'))
        self.url = f'/api/book/{self.book.id}/digital/'

    def buy(self, status='confirmed'):
        order = Order.objects.create(user=self.user, status=status)
        OrderItem.objects.create(order=order, book=self.book, quantity=1)
        return order

    def test_public_api_hides_file_urls(self):
        data = self.client.get(f'/api/book/{self.book.id}/').data
        self.assertTrue(data['has_audio'] and data['has_pdf'])
        self.assertNotIn('audio_file', data)
        self.assertNotIn('pdf_file', data)

    def test_files_are_stored_outside_public_media(self):
        self.assertTrue(self.book.audio_file.path.startswith(self.tmp))

    def test_access_rules(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(self.url).status_code, 403)  # sotib olmagan
        self.buy('pending')  # savatdagi kitob hisobga kirmaydi
        self.assertEqual(self.client.get(self.url).status_code, 403)
        order = self.buy('cancelled')
        self.assertEqual(self.client.get(self.url).status_code, 403)
        order.status = 'delivered'
        order.save()
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('/api/files/', res.data['audio'])
        self.assertIn('/api/files/', res.data['pdf'])

    def test_staff_has_access_and_missing_file_gives_none(self):
        self.client.force_authenticate(user=self.staff)
        other = Book.objects.create(
            name='Fayli yo\'q', category=self.category, author=self.author, language='uzbek',
            price=1000, about='x', publisher='y', pages=1, status='active',
        )
        res = self.client.get(f'/api/book/{other.id}/digital/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'audio': None, 'pdf': None})
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def links(self):
        self.client.force_authenticate(user=self.staff)
        data = self.client.get(self.url).data
        self.client.force_authenticate(user=None)  # havola uchun login kerak emas
        return data

    def test_signed_link_serves_file_without_login(self):
        links = self.links()
        res = self.client.get(links['audio'])
        self.assertEqual(res.status_code, 200)
        self.assertEqual(b''.join(res.streaming_content), self.audio_bytes)
        self.assertEqual(res['Accept-Ranges'], 'bytes')
        pdf = self.client.get(links['pdf'])
        self.assertEqual(pdf['Content-Type'], 'application/pdf')
        self.assertTrue(b''.join(pdf.streaming_content).startswith(b'%PDF'))

    def test_range_requests(self):
        audio = self.links()['audio']
        part = self.client.get(audio, HTTP_RANGE='bytes=100-199')
        self.assertEqual(part.status_code, 206)
        self.assertEqual(part['Content-Range'], 'bytes 100-199/2048')
        self.assertEqual(b''.join(part.streaming_content), self.audio_bytes[100:200])
        tail = self.client.get(audio, HTTP_RANGE='bytes=-50')
        self.assertEqual(b''.join(tail.streaming_content), self.audio_bytes[-50:])
        open_end = self.client.get(audio, HTTP_RANGE='bytes=2000-')
        self.assertEqual(b''.join(open_end.streaming_content), self.audio_bytes[2000:])
        self.assertEqual(self.client.get(audio, HTTP_RANGE='bytes=5000-6000').status_code, 416)

    def test_bad_or_expired_token_is_not_found(self):
        self.assertEqual(self.client.get('/api/files/yaroqsiz-token/').status_code, 404)
        from unittest import mock
        audio = self.links()['audio']
        with mock.patch('mainapp.digital.LINK_MAX_AGE', -1):
            self.assertEqual(self.client.get(audio).status_code, 404)

    def test_panel_shows_which_files_exist(self):
        self.client.force_authenticate(user=self.staff)
        row = self.client.get('/api/panel/books/').data['results'][0]
        self.assertTrue(row['has_audio'] and row['has_pdf'])

    def buyer_links(self, status='delivered'):
        """ Xaridor havolalarini oladi; keyin brauzerdagi <audio src> kabi sarlavhasiz (anonim) so'rov qiladi """
        order = self.buy(status)
        self.client.force_authenticate(user=self.user)
        data = self.client.get(self.url).data
        self.client.force_authenticate(user=None)
        return order, data

    def test_link_is_bound_to_buyer_and_expires_in_30_minutes(self):
        from django.core import signing
        from . import digital
        self.assertEqual(digital.LINK_MAX_AGE, 30 * 60)
        _, links = self.buyer_links()
        token = links['audio'].rstrip('/').rsplit('/', 1)[1]
        self.assertEqual(signing.loads(token, salt=digital.SALT)['u'], self.user.id)
        # Sarlavhasiz ochiladi (audio/PDF havolasi Authorization yubora olmaydi)
        self.assertEqual(self.client.get(links['audio']).status_code, 200)

    def test_link_stops_working_when_order_is_cancelled(self):
        order, links = self.buyer_links()
        self.assertEqual(self.client.get(links['pdf']).status_code, 200)
        order.status = 'cancelled'
        order.save()
        self.assertEqual(self.client.get(links['audio']).status_code, 404)
        self.assertEqual(self.client.get(links['pdf']).status_code, 404)
        order.status = 'shipped'
        order.save()
        self.assertEqual(self.client.get(links['audio']).status_code, 200)

    def test_link_stops_working_when_user_is_deactivated_or_deleted(self):
        _, links = self.buyer_links()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.client.get(links['audio']).status_code, 404)
        self.user.is_active = True
        self.user.save()
        self.assertEqual(self.client.get(links['audio']).status_code, 200)
        self.user.delete()
        self.assertEqual(self.client.get(links['audio']).status_code, 404)

    def test_link_without_user_is_rejected(self):
        from django.core import signing
        from . import digital
        old = signing.dumps({'b': self.book.id, 'k': 'audio'}, salt=digital.SALT)  # eski format
        self.assertEqual(self.client.get(f'/api/files/{old}/').status_code, 404)
        stranger = User.objects.create_user(username='stranger', password='password123')
        forged = signing.dumps({'b': self.book.id, 'k': 'audio', 'u': stranger.id}, salt=digital.SALT)
        self.assertEqual(self.client.get(f'/api/files/{forged}/').status_code, 404)  # sotib olmagan

    def test_file_responses_send_no_referrer(self):
        audio = self.links()['audio']
        for extra in ({}, {'HTTP_RANGE': 'bytes=0-9'}, {'HTTP_RANGE': 'bytes=5000-6000'}):
            res = self.client.get(audio, **extra)
            self.assertEqual(res['Referrer-Policy'], 'no-referrer', extra)


class PanelExportAndPromoTests(TestCase):
    """ CSV yuklash va promo kodlarni boshqarish """

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', email='boss@example.com', password='password123', is_staff=True)
        PromoCode.objects.create(code='AKSIYA7', discount_percent=10)
        o1 = Order.objects.create(user=self.user, status='confirmed', promo_code='AKSIYA7', discount=9000, delivery_fee=20000)
        OrderItem.objects.create(order=o1, book=self.book, quantity=2)
        o2 = Order.objects.create(user=self.user, status='cancelled', promo_code='AKSIYA7', discount=4500, delivery_fee=20000)
        OrderItem.objects.create(order=o2, book=self.book, quantity=1)
        self.o1, self.o2 = o1, o2

    def read_csv(self, url):
        import csv
        import io
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res['Content-Type'].startswith('text/csv'))
        self.assertIn('attachment; filename=', res['Content-Disposition'])
        text = res.content.decode('utf-8')
        self.assertTrue(text.startswith('﻿'))  # Excel uchun BOM
        return list(csv.reader(io.StringIO(text.lstrip('﻿')), delimiter=';'))

    # --- CSV
    def test_export_requires_staff(self):
        for kind in ('orders', 'books', 'users'):
            self.assertEqual(self.client.get(f'/api/panel/export/{kind}/').status_code, 401)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get('/api/panel/export/orders/').status_code, 403)
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get('/api/panel/export/nomalum/').status_code, 404)

    def test_orders_csv_content_and_filters(self):
        self.client.force_authenticate(user=self.staff)
        rows = self.read_csv('/api/panel/export/orders/')
        self.assertEqual(rows[0][0], '№')
        by_id = {int(r[0]): r for r in rows[1:]}
        self.assertEqual(set(by_id), {self.o1.id, self.o2.id})
        row = by_id[self.o1.id]
        self.assertEqual(row[2:6], ['testuser', 'test@example.com', 'Tasdiqlangan', 'AKSIYA7'])
        self.assertIn("O'tkan kunlar x2 (45000)", row[6])
        self.assertEqual(row[7:12], ['2', '90000', '9000', '20000', '101000'])
        self.assertEqual(len(self.read_csv('/api/panel/export/orders/?status=cancelled')), 2)  # sarlavha + 1
        self.assertEqual(len(self.read_csv('/api/panel/export/orders/?q=AKSIYA7')), 3)

    def test_orders_date_filter_uses_tashkent_days(self):
        from datetime import timedelta
        from django.utils import timezone
        self.client.force_authenticate(user=self.staff)
        tomorrow = (timezone.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        yesterday = (timezone.now() - timedelta(days=2)).strftime('%Y-%m-%d')
        self.assertEqual(len(self.read_csv(f'/api/panel/export/orders/?from={tomorrow}')), 1)  # faqat sarlavha
        self.assertEqual(len(self.read_csv(f'/api/panel/export/orders/?to={yesterday}')), 1)
        self.assertEqual(len(self.read_csv(f'/api/panel/export/orders/?from={yesterday}&to={tomorrow}')), 3)
        self.assertEqual(len(self.read_csv('/api/panel/export/orders/?from=xato&to=xato')), 3)  # noto'g'ri sana e'tiborsiz
        self.assertEqual(self.client.get(f'/api/panel/orders/?from={tomorrow}').data['count'], 0)  # ro'yxatda ham ishlaydi

    def test_csv_cells_cannot_become_formulas(self):
        evil = User.objects.create_user(username='=HYPERLINK("x")', email='e@example.com', password='password123')
        order = Order.objects.create(user=evil, status='confirmed')
        OrderItem.objects.create(order=order, book=self.book, quantity=1)
        self.client.force_authenticate(user=self.staff)
        rows = self.read_csv('/api/panel/export/orders/')
        names = [r[2] for r in rows[1:]]
        self.assertIn("'=HYPERLINK(\"x\")", names)
        self.assertNotIn('=HYPERLINK("x")', names)

    def test_books_and_users_csv(self):
        self.client.force_authenticate(user=self.staff)
        books = self.read_csv('/api/panel/export/books/')
        self.assertEqual(books[0][1], 'Nomi')
        row = next(r for r in books[1:] if r[1] == "O'tkan kunlar")
        self.assertEqual((row[12], row[13], row[14]), ('2', '90000', '1'))  # bekor qilingani hisobga kirmaydi
        users = self.read_csv('/api/panel/export/users/?ordering=-spent')
        top = users[1]
        self.assertEqual((top[1], top[7], top[8]), ('testuser', '1', '101000'))

    # --- Promo kodlar
    URL = '/api/panel/promos/'

    def test_promos_require_staff(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(self.URL).status_code, 403)
        self.assertEqual(self.client.post(self.URL, {'code': 'XYZ', 'discount_percent': 5}, format='json').status_code, 403)

    def test_promo_usage_stats_skip_cancelled_orders(self):
        self.client.force_authenticate(user=self.staff)
        row = self.client.get(self.URL).data['results'][0]
        self.assertEqual(row['code'], 'AKSIYA7')
        self.assertEqual((row['orders_count'], row['discount_given'], row['revenue']), (1, 9000, 101000))

    def test_create_promo_normalizes_and_validates(self):
        self.client.force_authenticate(user=self.staff)
        ok = self.client.post(self.URL, {'code': ' yangi10 ', 'discount_percent': 10}, format='json')
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(ok.data['code'], 'YANGI10')
        self.assertTrue(ok.data['is_active'])
        self.assertEqual(ok.data['orders_count'], 0)
        self.assertEqual(self.client.post(self.URL, {'code': 'aksiya7', 'discount_percent': 5}, format='json').status_code, 400)  # takror
        for bad in ({'code': 'a b', 'discount_percent': 5}, {'code': 'XY', 'discount_percent': 5}, {'code': 'OK123', 'discount_percent': 0}, {'code': 'OK123', 'discount_percent': 101}):
            self.assertEqual(self.client.post(self.URL, bad, format='json').status_code, 400, bad)
        self.assertEqual(PromoCode.objects.count(), 2)

    def test_new_promo_works_in_checkout(self):
        self.client.force_authenticate(user=self.staff)
        self.client.post(self.URL, {'code': 'yoz2026', 'discount_percent': 20}, format='json')
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/quote/', {'items': [{'book_id': self.book.id, 'quantity': 1}], 'promo_code': 'YOZ2026', **DELIVERY}, format='json')
        self.assertEqual(res.data['discount'], 9000)

    def test_update_promo(self):
        self.client.force_authenticate(user=self.staff)
        promo = PromoCode.objects.get(code='AKSIYA7')
        url = f'{self.URL}{promo.id}/'
        res = self.client.patch(url, {'discount_percent': 25, 'is_active': False}, format='json')
        self.assertEqual(res.status_code, 200)
        promo.refresh_from_db()
        self.assertEqual((promo.discount_percent, promo.is_active), (25, False))
        self.assertEqual(self.client.patch(url, {'code': 'BOSHQA'}, format='json').status_code, 400)  # kod o'zgarmaydi
        self.assertEqual(self.client.patch(url, {'code': 'aksiya7'}, format='json').status_code, 200)  # o'sha kod: muammo yo'q
        self.assertEqual(self.client.patch(url, {'discount_percent': 500}, format='json').status_code, 400)

    def test_delete_only_unused_promo(self):
        self.client.force_authenticate(user=self.staff)
        used = PromoCode.objects.get(code='AKSIYA7')
        blocked = self.client.delete(f'{self.URL}{used.id}/')
        self.assertEqual(blocked.status_code, 400)
        self.assertTrue(PromoCode.objects.filter(pk=used.pk).exists())
        fresh = PromoCode.objects.create(code='YANGI', discount_percent=5)
        self.assertEqual(self.client.delete(f'{self.URL}{fresh.id}/').status_code, 204)
        self.assertFalse(PromoCode.objects.filter(pk=fresh.pk).exists())

    def test_promo_list_filters_and_ordering(self):
        PromoCode.objects.create(code='OFF1', discount_percent=5, is_active=False)
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get(f'{self.URL}?active=1').data['count'], 1)
        self.assertEqual(self.client.get(f'{self.URL}?active=0').data['count'], 1)
        self.assertEqual(self.client.get(f'{self.URL}?q=off').data['count'], 1)
        self.assertEqual(self.client.get(f'{self.URL}?ordering=-orders_count').data['results'][0]['code'], 'AKSIYA7')
        self.assertEqual(self.client.get(f'{self.URL}?ordering=hack').status_code, 200)


class NetRevenueTests(TestCase):
    """ Sof tushum: (sotuv - tannarx) * soni - chegirma; yetkazib berish kirmaydi; tannarxsiz qator hisobga olinmaydi """

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', email='boss@example.com', password='password123', is_staff=True)
        self.client.force_authenticate(user=self.staff)
        self.book.price, self.book.cost_price = 60000, 50000  # ustama 10000
        self.book.save()
        self.other = Book.objects.create(
            name='Tannarxsiz', category=self.book.category, author=self.book.author, language=self.book.language,
            price=30000, about='x', publisher='y', pages=10, photo='x.jpg', status='active',
        )

    def summary(self):
        return self.client.get('/api/panel/summary/').data

    def test_basic_net_revenue_excludes_delivery(self):
        o = Order.objects.create(user=self.user, status='confirmed', delivery_fee=20000)
        OrderItem.objects.create(order=o, book=self.book, quantity=3, price=60000, cost_price=50000)
        cur = self.summary()['current']
        self.assertEqual(cur['net_revenue'], 30000)
        self.assertEqual(cur['cost_total'], 150000)
        self.assertEqual(cur['delivery'], 20000)
        self.assertEqual(cur['missing_cost_count'], 0)

    def test_promo_discount_is_subtracted(self):
        o = Order.objects.create(user=self.user, status='confirmed', promo_code='X', discount=6000, delivery_fee=20000)
        OrderItem.objects.create(order=o, book=self.book, quantity=2, price=60000, cost_price=50000)
        self.assertEqual(self.summary()['current']['net_revenue'], 20000 - 6000)

    def test_missing_cost_excluded_and_reported(self):
        o = Order.objects.create(user=self.user, status='confirmed', discount=9000)
        OrderItem.objects.create(order=o, book=self.book, quantity=1, price=60000, cost_price=50000)
        OrderItem.objects.create(order=o, book=self.other, quantity=2, price=30000)
        cur = self.summary()['current']
        # tannarxsiz qator kirmaydi; chegirma faqat ma'lum qator ulushiga (60000/120000) ayriladi
        self.assertEqual(cur['net_revenue'], 10000 - 4500)
        self.assertEqual(cur['missing_cost_count'], 1)

    def test_cancelled_and_cart_not_counted(self):
        for st in ('cancelled', 'pending'):
            o = Order.objects.create(user=self.user, status=st)
            OrderItem.objects.create(order=o, book=self.book, quantity=1, price=60000, cost_price=50000)
        self.assertEqual(self.summary()['current']['net_revenue'], 0)

    def test_snapshot_not_changed_by_later_cost_edit(self):
        o = Order.objects.create(user=self.user, status='confirmed')
        OrderItem.objects.create(order=o, book=self.book, quantity=1, price=60000, cost_price=50000)
        self.client.patch(f'/api/panel/books/{self.book.id}/', {'cost_price': 55000}, format='json')
        self.assertEqual(self.summary()['current']['net_revenue'], 10000)

    def test_checkout_snapshots_cost(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 1}], **PICKUP}, format='json')
        self.assertEqual(res.status_code, 201)
        item = OrderItem.objects.get(order_id=res.data['id'])
        self.assertEqual(item.cost_price, 50000)
        self.book.cost_price = 1
        self.book.save()
        item.refresh_from_db()
        self.assertEqual(item.cost_price, 50000)

    def test_book_endpoint_markup_and_order_detail_profit(self):
        res = self.client.get('/api/panel/books/')
        rows = {r['id']: r for r in res.data['results']}
        self.assertEqual(rows[self.book.id]['markup'], 10000)
        self.assertIsNone(rows[self.other.id]['markup'])
        o = Order.objects.create(user=self.user, status='confirmed')
        OrderItem.objects.create(order=o, book=self.book, quantity=2, price=60000, cost_price=50000)
        det = self.client.get(f'/api/panel/orders/{o.id}/').data
        self.assertEqual(det['items'][0]['profit'], 20000)
        self.assertEqual(det['net_revenue'], 20000)

    def test_csv_has_cost_columns(self):
        self.assertIn('Ustama', self.client.get('/api/panel/export/books/').content.decode('utf-8-sig').splitlines()[0])
        self.assertIn('Sof tushum', self.client.get('/api/panel/export/orders/').content.decode('utf-8-sig').splitlines()[0])


class DeliveryMethodTests(BookShopAPITestCase):
    """ Olib ketish / yetkazib berish: narx, majburiy maydonlar va saqlash """
    ADDRESS = {
        'recipient_name': 'Ali Valiyev', 'recipient_phone': '+998 90 123-45-67',
        'city': 'Toshkent', 'district': 'Chilonzor', 'street': 'Bunyodkor 5', 'house': '12', 'delivery_comment': 'Qo\'ng\'iroq qiling',
    }

    def checkout(self, quantity=1, **extra):
        self.client.force_authenticate(user=self.user)
        return self.client.post(
            '/api/cart/checkout/',
            {'items': [{'book_id': self.book.id, 'quantity': quantity}], **extra},
            format='json',
        )

    def test_pickup_has_no_fee_and_needs_no_address(self):
        res = self.checkout(1, delivery_method='pickup')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['delivery_fee'], 0)
        self.assertEqual(res.data['total_price'], 45000)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual((order.delivery_method, order.city, order.street, order.address_text), ('pickup', '', '', ''))

    def test_pickup_ignores_sent_address(self):
        res = self.checkout(1, delivery_method='pickup', **self.ADDRESS)
        self.assertEqual(res.status_code, 201)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual((order.recipient_name, order.city, order.street), ('Ali Valiyev', '', ''))

    def test_delivery_requires_fields(self):
        for key in ('recipient_name', 'recipient_phone', 'city', 'street'):
            data = {k: v for k, v in self.ADDRESS.items() if k != key}
            res = self.checkout(1, delivery_method='delivery', **data)
            self.assertEqual(res.status_code, 400, key)
            self.assertIn(key, res.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_delivery_rejects_bad_phone(self):
        res = self.checkout(1, delivery_method='delivery', **{**self.ADDRESS, 'recipient_phone': 'abc'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('recipient_phone', res.data)

    def test_delivery_saves_address_and_charges_fee(self):
        res = self.checkout(1, delivery_method='delivery', **self.ADDRESS)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['delivery_fee'], 20000)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.delivery_method, 'delivery')
        self.assertEqual(order.address_text, 'Toshkent, Chilonzor, Bunyodkor 5, 12')
        self.assertEqual(order.recipient_phone, '+998 90 123-45-67')

    def test_fee_is_computed_on_server(self):
        # Mijoz yuborgan summaga e'tibor berilmaydi
        res = self.checkout(1, delivery_method='delivery', delivery_fee=0, total=1, **self.ADDRESS)
        self.assertEqual(res.data['delivery_fee'], 20000)
        res = self.checkout(1, delivery_method='pickup', delivery_fee=99999)
        self.assertEqual(res.data['delivery_fee'], 0)

    def test_quote_depends_on_method(self):
        body = {'items': [{'book_id': self.book.id, 'quantity': 1}]}
        self.assertEqual(self.client.post('/api/cart/quote/', {**body, 'delivery_method': 'pickup'}, format='json').data['delivery_fee'], 0)
        self.assertEqual(self.client.post('/api/cart/quote/', {**body, 'delivery_method': 'delivery'}, format='json').data['delivery_fee'], 20000)
        self.assertEqual(self.client.post('/api/cart/quote/', {**body, 'delivery_method': 'x'}, format='json').status_code, 400)

    def test_panel_detail_and_csv(self):
        staff = User.objects.create_user(username='boss2', email='b2@example.com', password='password123', is_staff=True)
        res = self.checkout(1, delivery_method='delivery', **self.ADDRESS)
        self.client.force_authenticate(user=staff)
        det = self.client.get(f"/api/panel/orders/{res.data['id']}/").data
        self.assertEqual(det['delivery_method'], 'delivery')
        self.assertEqual(det['recipient_name'], 'Ali Valiyev')
        self.assertEqual(det['address'], 'Toshkent, Chilonzor, Bunyodkor 5, 12')
        self.assertEqual(det['delivery_comment'], "Qo'ng'iroq qiling")
        lines = self.client.get('/api/panel/export/orders/').content.decode('utf-8-sig').splitlines()
        self.assertTrue(lines[0].endswith('Usul;Manzil') or lines[0].endswith('Usul,Manzil'))
        self.assertIn('Toshkent', lines[1])

    def test_coordinates_saved_for_delivery_only(self):
        res = self.checkout(1, delivery_method='delivery', delivery_lat=41.311158, delivery_lng=69.279737, **self.ADDRESS)
        self.assertEqual(res.status_code, 201)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual((float(order.delivery_lat), float(order.delivery_lng)), (41.311158, 69.279737))
        res = self.checkout(1, delivery_method='pickup', delivery_lat=41.3, delivery_lng=69.2)
        self.assertIsNone(Order.objects.get(id=res.data['id']).delivery_lat)
        # nuqta ixtiyoriy
        res = self.checkout(1, delivery_method='delivery', **self.ADDRESS)
        self.assertIsNone(Order.objects.get(id=res.data['id']).delivery_lat)

    def test_bad_coordinates_rejected(self):
        for extra in ({'delivery_lat': 123, 'delivery_lng': 69}, {'delivery_lat': 41.3}):
            res = self.checkout(1, delivery_method='delivery', **self.ADDRESS, **extra)
            self.assertEqual(res.status_code, 400, extra)

    def test_panel_detail_has_coordinates(self):
        staff = User.objects.create_user(username='boss3', email='b3@example.com', password='password123', is_staff=True)
        res = self.checkout(1, delivery_method='delivery', delivery_lat=41.3, delivery_lng=69.2, **self.ADDRESS)
        self.client.force_authenticate(user=staff)
        det = self.client.get(f"/api/panel/orders/{res.data['id']}/").data
        self.assertEqual((det['delivery_lat'], det['delivery_lng']), (41.3, 69.2))



import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

TEST_MEDIA = tempfile.mkdtemp(prefix='bookshop-test-media-')


def png_file(name='cover.png', size=(10, 10)):
    buffer = io.BytesIO()
    Image.new('RGB', size, 'brown').save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def csv_file(text, encoding='utf-8', name='kitoblar.csv'):
    return SimpleUploadedFile(name, text.encode(encoding) if isinstance(text, str) else text, content_type='text/csv')


@override_settings(MEDIA_ROOT=TEST_MEDIA)
class PanelBookAddTests(TestCase):
    """ Panel: bitta kitob qo'shish, rasm yuklash, ommaviy (CSV) qo'shish """

    URL = '/api/panel/books/'
    IMPORT = '/api/panel/books/import/'
    HEAD = 'nom;muallif;kategoriya;til;narx;tannarx;sahifalar;nashriyot;tavsif;ombor;holat\n'

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', password='password123', is_staff=True)
        self.client.force_authenticate(user=self.staff)
        self.payload = {'name': 'Yangi kitob', 'author': self.author.id, 'category': self.category.id, 'price': 50000, 'cost_price': 30000}

    # --- bitta kitob ---
    def test_create_success(self):
        res = self.client.post(self.URL, {**self.payload, 'pages': 100, 'stock': 5, 'status': 'deactive'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        book = Book.objects.get(pk=res.data['id'])
        self.assertEqual((book.price, book.cost_price, book.pages, book.stock, book.status), (50000, 30000, 100, 5, 'deactive'))
        self.assertEqual(book.publisher, '—')
        self.assertFalse(book.photo)

    def test_create_stock_null_is_unlimited(self):
        res = self.client.post(self.URL, {**self.payload, 'stock': None}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(Book.objects.get(pk=res.data['id']).stock)

    def test_create_requires_fields(self):
        for field in ('name', 'category', 'price', 'cost_price'):
            data = {k: v for k, v in self.payload.items() if k != field}
            res = self.client.post(self.URL, data, format='json')
            self.assertEqual(res.status_code, 400, field)
            self.assertIn(field, res.data)
        data = {k: v for k, v in self.payload.items() if k != 'author'}
        self.assertIn('author', self.client.post(self.URL, data, format='json').data)
        self.assertEqual(Book.objects.count(), 1)

    def test_create_invalid_price(self):
        for bad in (0, -5, 'abc', 10.5):
            res = self.client.post(self.URL, {**self.payload, 'price': bad}, format='json')
            self.assertEqual(res.status_code, 400, bad)
        self.assertEqual(self.client.post(self.URL, {**self.payload, 'cost_price': 0}, format='json').status_code, 400)

    def test_price_below_cost_warns_but_saves(self):
        res = self.client.post(self.URL, {**self.payload, 'price': 20000}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data['warnings'])

    def test_create_duplicate(self):
        data = {**self.payload, 'name': "  o'TKAN   kunlar "}
        res = self.client.post(self.URL, data, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('name', res.data)

    def test_create_forbidden_for_non_staff(self):
        self.client.force_authenticate(user=User.objects.create_user(username='u', password='password123'))
        self.assertEqual(self.client.post(self.URL, self.payload, format='json').status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(self.URL, self.payload, format='json').status_code, 401)
        self.assertEqual(Book.objects.count(), 1)

    def test_create_new_author(self):
        data = {k: v for k, v in self.payload.items() if k != 'author'}
        res = self.client.post(self.URL, {**data, 'new_author': 'Yangi Ismli'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Book.objects.get(pk=res.data['id']).author.full_name, 'Yangi Ismli')
        # bir xil ism (katta-kichik harf) bo'lsa, qayta yaratilmaydi
        self.client.post(self.URL, {**data, 'name': 'Ikkinchi', 'new_author': ' yangi  ISMLI'}, format='json')
        self.assertEqual(Author.objects.filter(full_name__iexact='Yangi Ismli').count(), 1)

    def test_create_with_photo_multipart(self):
        data = {**self.payload, 'photo': png_file(), 'stock': 3}
        res = self.client.post(self.URL, data, format='multipart')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(Book.objects.get(pk=res.data['id']).photo.name.startswith('photo_book/'))

    def test_photo_type_validation(self):
        fake = SimpleUploadedFile('shell.php', b'<?php echo 1;', content_type='image/png')
        self.assertEqual(self.client.post(self.URL, {**self.payload, 'photo': fake}, format='multipart').status_code, 400)
        svg = SimpleUploadedFile('a.svg', b'<svg xmlns="http://www.w3.org/2000/svg"/>', content_type='image/svg+xml')
        self.assertEqual(self.client.post(self.URL, {**self.payload, 'photo': svg}, format='multipart').status_code, 400)
        notimg = SimpleUploadedFile('a.png', b'not an image', content_type='image/png')
        self.assertEqual(self.client.post(self.URL, {**self.payload, 'photo': notimg}, format='multipart').status_code, 400)
        # test klienti MIME'ni fayl nomidan o'zi qo'yadi, shuning uchun MIME tekshiruvi to'g'ridan-to'g'ri sinaladi
        from rest_framework.serializers import ValidationError
        from .panel_books import validate_photo
        wrong_mime = png_file()
        wrong_mime.content_type = 'text/html'
        with self.assertRaises(ValidationError):
            validate_photo(wrong_mime)
        self.assertEqual(Book.objects.count(), 1)

    def test_photo_too_large(self):
        from unittest import mock
        with mock.patch('mainapp.panel_books.MAX_PHOTO_BYTES', 50):  # haqiqiy 5 MB rasm yaratmaslik uchun
            res = self.client.post(self.URL, {**self.payload, 'photo': png_file()}, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('photo', res.data)

    def test_patch_photo(self):
        res = self.client.patch(f'{self.URL}{self.book.id}/', {'photo': png_file()}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        self.book.refresh_from_db()
        self.assertTrue(self.book.photo)
        bad = SimpleUploadedFile('x.gif', b'GIF89a', content_type='image/gif')
        self.assertEqual(self.client.patch(f'{self.URL}{self.book.id}/', {'photo': bad}, format='multipart').status_code, 400)

    def test_options(self):
        res = self.client.get(f'{self.URL}options/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['categories'][0]['name'], 'Badiiy adabiyot')
        self.assertEqual(res.data['authors'][0]['name'], 'Abdulla Qodiriy')
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(f'{self.URL}options/').status_code, 403)

    # --- ommaviy ---
    def preview(self, text, **kw):
        return self.client.post(self.IMPORT, {'file': csv_file(text, **kw), 'mode': 'preview'}, format='multipart')

    def commit(self, text, **extra):
        return self.client.post(self.IMPORT, {'file': csv_file(text), 'mode': 'commit', **extra}, format='multipart')

    GOOD = HEAD + "Birinchi;abdulla qodiriy;BADIIY ADABIYOT;uzbek;40000;25000;100;Nashr;Tavsif;7;faol\n"

    def test_preview_rows(self):
        text = self.HEAD + (
            "Yangi 1;Yangi Muallif;Badiiy adabiyot;uzbek;40000;25000;100;;;;faol\n"
            "Yangi 2;yangi  muallif;Badiiy adabiyot;;1;1;;;;;\n"
            "Xato narx;Abdulla Qodiriy;Badiiy adabiyot;uzbek;abc;100;;;;;\n"
            "Xato kategoriya;Abdulla Qodiriy;Yo'q janr;uzbek;100;50;;;;;\n"
            "Xato til;Abdulla Qodiriy;Badiiy adabiyot;klingon;100;50;;;;;\n"
            "O'tkan KUNLAR;ABDULLA   qodiriy;Badiiy adabiyot;uzbek;100;50;;;;;\n"
            "Yangi 1;Yangi Muallif;Badiiy adabiyot;uzbek;1;1;;;;;\n"
        )
        res = self.preview(text)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual([r['status'] for r in res.data['rows']], ['new', 'new', 'error', 'error', 'error', 'duplicate', 'duplicate'])
        self.assertTrue(res.data['rows'][0]['new_author'])
        self.assertFalse(res.data['rows'][1]['new_author'])  # faylda bir marta yaratiladi
        self.assertEqual(res.data['summary'], {'total': 7, 'new': 2, 'duplicate': 2, 'error': 3, 'new_authors': 1})
        self.assertEqual(res.data['rows'][2]['row'], 4)
        # dry-run: hech narsa yozilmagan
        self.assertEqual(Book.objects.count(), 1)
        self.assertEqual(Author.objects.count(), 1)

    def test_commit_case_insensitive_author_and_category(self):
        res = self.commit(self.GOOD)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['created'], 1)
        book = Book.objects.get(name='Birinchi')
        self.assertEqual(book.author_id, self.author.id)
        self.assertEqual(book.category_id, self.category.id)
        self.assertEqual((book.stock, book.pages, book.publisher), (7, 100, 'Nashr'))
        self.assertFalse(book.photo)
        self.assertEqual(Author.objects.count(), 1)

    def test_commit_defaults_and_new_author(self):
        res = self.commit(self.HEAD + "Bo'sh;Yangi A;Badiiy adabiyot;;100;50;;;;;\n")
        self.assertEqual(res.status_code, 201, res.data)
        book = Book.objects.get(name="Bo'sh")
        self.assertEqual((book.language, book.status, book.stock, book.publisher, book.pages), ('uzbek', 'active', None, '—', 0))
        self.assertEqual(book.author.full_name, 'Yangi A')

    def test_commit_atomic_with_errors(self):
        text = self.GOOD + "Xato;Abdulla Qodiriy;Badiiy adabiyot;uzbek;abc;1;;;;;\n"
        res = self.commit(text)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Book.objects.count(), 1)  # hech narsa qo'shilmadi

    def test_commit_skip_errors_option(self):
        text = self.GOOD + "Xato;Abdulla Qodiriy;Badiiy adabiyot;uzbek;abc;1;;;;;\nO'tkan kunlar;Abdulla Qodiriy;Badiiy adabiyot;uzbek;5;5;;;;;\n"
        res = self.commit(text, skip_errors='1')
        self.assertEqual(res.status_code, 201)
        self.assertEqual((res.data['created'], res.data['skipped_errors'], res.data['skipped_duplicates']), (1, 1, 1))
        self.assertEqual(Book.objects.count(), 2)

    def test_commit_rolls_back_on_exception(self):
        from unittest import mock
        with mock.patch('mainapp.panel_books.Book.objects.create', side_effect=[self.book, RuntimeError('boom')]):
            text = self.HEAD + "A;Muallif X;Badiiy adabiyot;;1;1;;;;;\nB;Muallif X;Badiiy adabiyot;;1;1;;;;;\n"
            with self.assertRaises(RuntimeError):
                self.commit(text)
        self.assertFalse(Author.objects.filter(full_name='Muallif X').exists())

    def test_delimiters_and_bom(self):
        comma = self.GOOD.replace(';', ',')
        for text, encoding in ((self.GOOD, 'utf-8-sig'), (self.GOOD, 'utf-8'), (comma, 'utf-8'), (comma, 'utf-8-sig')):
            res = self.preview(text, encoding=encoding)
            self.assertEqual(res.status_code, 200, (encoding, res.data))
            self.assertEqual(res.data['rows'][0]['status'], 'new')

    def test_header_errors(self):
        self.assertEqual(self.preview('').status_code, 400)
        self.assertIn("bo'sh", self.preview('').data['detail'])
        res = self.preview('a;b;c\n1;2;3\n')
        self.assertEqual(res.status_code, 400)
        self.assertIn('majburiy ustun', res.data['detail'])
        self.assertEqual(self.preview(self.HEAD).status_code, 400)  # faqat sarlavha
        self.assertEqual(self.client.post(self.IMPORT, {'mode': 'preview'}, format='multipart').status_code, 400)

    def test_bad_encoding(self):
        res = self.preview(self.GOOD.replace('Tavsif', 'Тавсиф'), encoding='cp1251')
        self.assertEqual(res.status_code, 400)
        self.assertIn('UTF-8', res.data['detail'])

    def test_limits(self):
        rows = ''.join(f'Kitob {i};Muallif;Badiiy adabiyot;;1;1;;;;;\n' for i in range(501))
        res = self.preview(self.HEAD + rows)
        self.assertEqual(res.status_code, 400)
        self.assertIn('500', res.data['detail'])
        rows = ''.join(f'Kitob {i};Muallif;Badiiy adabiyot;;1;1;;;;;\n' for i in range(500))
        self.assertEqual(self.preview(self.HEAD + rows).status_code, 200)
        big = self.HEAD + 'x;' * (1024 * 1024 + 10)
        res = self.preview(big)
        self.assertEqual(res.status_code, 400)
        self.assertIn('2 MB', res.data['detail'])

    def test_import_permissions_and_template(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(self.IMPORT, {'file': csv_file(self.GOOD)}, format='multipart').status_code, 403)
        self.assertEqual(self.client.get('/api/panel/books/import-template/').status_code, 403)
        self.client.force_authenticate(user=self.staff)
        res = self.client.get('/api/panel/books/import-template/')
        self.assertEqual(res.status_code, 200)
        body = res.content.decode('utf-8')
        self.assertTrue(body.startswith('﻿nom;muallif;kategoriya'))
        # namunaning o'zi preview'dan xatosiz o'tadi (kategoriya mavjud bo'lsa)
        preview = self.preview(body)
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data['summary']['error'], 0)

    def test_formula_values_stored_as_text(self):
        res = self.commit(self.HEAD + "=1+1;Muallif;Badiiy adabiyot;;1;1;;;=HYPERLINK(1);;\n")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Book.objects.get(name='=1+1').about, '=HYPERLINK(1)')


class PanelBulkUpdateTests(TestCase):
    """ Panel: tanlangan kitoblarni ommaviy tahrirlash """

    URL = '/api/panel/books/bulk-update/'

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', password='password123', is_staff=True)
        self.client.force_authenticate(user=self.staff)
        Book.objects.filter(pk=self.book.pk).update(cost_price=30000, stock=5)
        self.second = Book.objects.create(
            name='Mehrobdan chayon', category=self.category, author=self.author, language='uzbek',
            price=20000, cost_price=15000, about='-', publisher='-', pages=10, status='active', stock=None,
        )
        self.ids = [self.book.id, self.second.id]

    def test_set_price_cost_status(self):
        res = self.client.post(self.URL, {'ids': self.ids, 'price_mode': 'set', 'price': 60000, 'cost_price': 40000, 'status': 'deactive'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['updated'], 2)
        self.assertEqual(res.data['books'][0]['markup'], 20000)
        for b in Book.objects.filter(pk__in=self.ids):
            self.assertEqual((b.price, b.cost_price, b.status), (60000, 40000, 'deactive'))

    def test_percent(self):
        res = self.client.post(self.URL, {'ids': self.ids, 'price_mode': 'percent', 'percent': 10}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual([b['price'] for b in res.data['books']], [49500, 22000])
        res = self.client.post(self.URL, {'ids': self.ids, 'price_mode': 'percent', 'percent': -50}, format='json')
        self.assertEqual([b['price'] for b in res.data['books']], [24750, 11000])
        for bad in (-91, 301):
            self.assertEqual(self.client.post(self.URL, {'ids': self.ids, 'price_mode': 'percent', 'percent': bad}, format='json').status_code, 400)

    def test_stock_modes(self):
        res = self.client.post(self.URL, {'ids': [self.book.id], 'stock_mode': 'add', 'stock': 10}, format='json')
        self.assertEqual(res.data['books'][0]['stock'], 15)
        res = self.client.post(self.URL, {'ids': self.ids, 'stock_mode': 'set', 'stock': 3}, format='json')
        self.assertEqual([b['stock'] for b in res.data['books']], [3, 3])
        res = self.client.post(self.URL, {'ids': self.ids, 'stock_mode': 'unlimited'}, format='json')
        self.assertEqual([b['stock'] for b in res.data['books']], [None, None])
        self.assertEqual(self.client.post(self.URL, {'ids': self.ids, 'stock_mode': 'set', 'stock': -1}, format='json').status_code, 400)

    def test_add_to_unlimited_rejected_atomically(self):
        res = self.client.post(self.URL, {'ids': self.ids, 'stock_mode': 'add', 'stock': 5, 'status': 'deactive'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.book.refresh_from_db()
        self.assertEqual((self.book.stock, self.book.status), (5, 'active'))

    def test_permissions(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(self.URL, {'ids': self.ids, 'status': 'deactive'}, format='json').status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(self.URL, {'ids': self.ids, 'status': 'deactive'}, format='json').status_code, 401)

    def test_bad_ids_and_empty_change(self):
        res = self.client.post(self.URL, {'ids': [self.book.id, 999999], 'price_mode': 'set', 'price': 1000}, format='json')
        self.assertEqual(res.status_code, 400)
        self.book.refresh_from_db()
        self.assertEqual(self.book.price, 45000)  # atomik: birinchisi ham o'zgarmadi
        self.assertEqual(self.client.post(self.URL, {'ids': [], 'status': 'active'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.URL, {'ids': list(range(1, 202)), 'status': 'active'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.URL, {'ids': self.ids}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.URL, {'ids': self.ids, 'price': 5}, format='json').status_code, 400)

    def test_loss_warning(self):
        res = self.client.post(self.URL, {'ids': self.ids, 'price_mode': 'set', 'price': 10000}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['warnings']), 2)


class PanelBulkItemsTests(TestCase):
    """ Har kitobga alohida narx (items) va aralash rejim """

    URL = '/api/panel/books/bulk-update/'

    def setUp(self):
        BookShopAPITestCase.setUp(self)
        self.staff = User.objects.create_user(username='boss', password='password123', is_staff=True)
        self.client.force_authenticate(user=self.staff)
        Book.objects.filter(pk=self.book.pk).update(cost_price=30000, stock=5)
        self.second = Book.objects.create(
            name='Mehrobdan chayon', category=self.category, author=self.author, language='uzbek',
            price=20000, cost_price=15000, about='-', publisher='-', pages=10, status='active', stock=None,
        )
        self.ids = [self.book.id, self.second.id]

    def test_items_individual_prices(self):
        items = [{'id': self.book.id, 'price': 50000}, {'id': self.second.id, 'price': 25000}]
        res = self.client.post(self.URL, {'items': items}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual([b['price'] for b in res.data['books']], [50000, 25000])
        self.book.refresh_from_db()
        self.assertEqual((self.book.price, self.book.cost_price, self.book.stock), (50000, 30000, 5))

    def test_mixed_shared_and_items(self):
        body = {
            'ids': self.ids, 'status': 'deactive', 'stock_mode': 'set', 'stock': 7,
            'items': [{'id': self.book.id, 'price': 51000}],
        }
        res = self.client.post(self.URL, body, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        by_id = {b['id']: b for b in res.data['books']}
        self.assertEqual(by_id[self.book.id]['price'], 51000)
        self.assertEqual(by_id[self.second.id]['price'], 20000)
        self.assertTrue(all(b['status'] == 'deactive' and b['stock'] == 7 for b in by_id.values()))

    def test_items_validation_and_atomicity(self):
        bad_price = [{'id': self.book.id, 'price': 0}]
        self.assertEqual(self.client.post(self.URL, {'items': bad_price}, format='json').status_code, 400)
        dup = [{'id': self.book.id, 'price': 100}, {'id': self.book.id, 'price': 200}]
        self.assertEqual(self.client.post(self.URL, {'items': dup}, format='json').status_code, 400)
        ghost = [{'id': self.book.id, 'price': 100}, {'id': 999999, 'price': 200}]
        self.assertEqual(self.client.post(self.URL, {'items': ghost}, format='json').status_code, 400)
        many = [{'id': i, 'price': 100} for i in range(1, 202)]
        self.assertEqual(self.client.post(self.URL, {'items': many}, format='json').status_code, 400)
        self.book.refresh_from_db()
        self.assertEqual(self.book.price, 45000)
        # umumiy qism xato bo'lsa, items ham yozilmaydi
        body = {'ids': self.ids, 'stock_mode': 'add', 'stock': 1, 'items': [{'id': self.book.id, 'price': 99999}]}
        self.assertEqual(self.client.post(self.URL, body, format='json').status_code, 400)
        self.book.refresh_from_db()
        self.assertEqual(self.book.price, 45000)

    def test_items_loss_warning_and_permission(self):
        res = self.client.post(self.URL, {'items': [{'id': self.book.id, 'price': 1000}]}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['warnings']), 1)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(self.URL, {'items': [{'id': self.book.id, 'price': 5}]}, format='json').status_code, 403)


# --- Sayt auditidan keyingi tezkor tuzatishlar ---
import json
import os
import subprocess
import sys

from django.conf import settings
from django.contrib import admin as django_admin
from django.test import RequestFactory
from rest_framework.permissions import AllowAny

from .admin import Book_Admin, BookAdminForm

REVIEW_MEDIA = tempfile.mkdtemp(prefix='bookshop-test-review-')
BIG_ID = '9' * 20  # bazaga sig'maydigan id


def noisy_png(name='big.png', side=900):
    """ Hajmi 2 MB dan katta haqiqiy PNG (tasodifiy piksellar siqilmaydi) """
    buffer = io.BytesIO()
    Image.frombytes('RGB', (side, side), os.urandom(side * side * 3)).save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


class RequirementsAndSettingsTests(TestCase):
    """ requirements.txt to'liqligi va production xavfsizlik sozlamalari """

    def test_requirements_has_jwt_packages(self):
        lines = [l.strip().lower() for l in (settings.BASE_DIR / 'requirements.txt').read_text().splitlines()]
        self.assertTrue(any(l.startswith('djangorestframework-simplejwt==') for l in lines))
        self.assertTrue(any(l.startswith('pyjwt==') for l in lines))

    def load_settings(self, drop=(), **env):
        """ Settings'ni alohida jarayonda berilgan muhit bilan yuklab, kerakli qiymatlarni qaytaradi """
        code = (
            "import json, sys; sys.path.insert(0, %r); import config.settings as s; "
            "names = ['DEBUG', 'SECURE_SSL_REDIRECT', 'SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE', "
            "'SECURE_HSTS_SECONDS', 'SECURE_HSTS_INCLUDE_SUBDOMAINS', 'SECURE_CONTENT_TYPE_NOSNIFF', "
            "'SECURE_PROXY_SSL_HEADER', 'CSRF_TRUSTED_ORIGINS']; "
            "print(json.dumps({n: getattr(s, n, None) for n in names}))"
        ) % str(settings.BASE_DIR)
        environment = {k: v for k, v in os.environ.items() if k not in drop}
        result = subprocess.run(
            [sys.executable, '-c', code], capture_output=True, text=True, check=True,
            env={**environment, 'SECRET_KEY': 'test-secret', **env},
        )
        return json.loads(result.stdout.strip().splitlines()[-1])

    def test_production_security_when_debug_off(self):
        # Standart qiymatlar: ixtiyoriy env o'zgaruvchilari berilmaydi
        data = self.load_settings(
            drop=('SECURE_SSL_REDIRECT', 'SECURE_HSTS_SECONDS', 'CSRF_TRUSTED_ORIGINS'), DEBUG='False',
        )
        self.assertFalse(data['DEBUG'])
        self.assertTrue(data['SECURE_SSL_REDIRECT'])
        self.assertTrue(data['SESSION_COOKIE_SECURE'])
        self.assertTrue(data['CSRF_COOKIE_SECURE'])
        self.assertEqual(data['SECURE_HSTS_SECONDS'], 3600)
        self.assertFalse(data['SECURE_HSTS_INCLUDE_SUBDOMAINS'])
        self.assertTrue(data['SECURE_CONTENT_TYPE_NOSNIFF'])
        self.assertEqual(data['SECURE_PROXY_SSL_HEADER'], ['HTTP_X_FORWARDED_PROTO', 'https'])
        self.assertEqual(data['CSRF_TRUSTED_ORIGINS'], [])

    def test_production_env_overrides_and_debug_on_untouched(self):
        data = self.load_settings(
            DEBUG='False', SECURE_SSL_REDIRECT='False', SECURE_HSTS_SECONDS='60',
            CSRF_TRUSTED_ORIGINS='https://a.example, https://b.example',
        )
        self.assertFalse(data['SECURE_SSL_REDIRECT'])
        self.assertEqual(data['SECURE_HSTS_SECONDS'], 60)
        self.assertEqual(data['CSRF_TRUSTED_ORIGINS'], ['https://a.example', 'https://b.example'])
        # Lokal (DEBUG=True): hech narsa yoqilmaydi
        local = self.load_settings(DEBUG='True')
        self.assertTrue(local['DEBUG'])
        self.assertFalse(local['SECURE_SSL_REDIRECT'])
        self.assertFalse(local['SESSION_COOKIE_SECURE'])
        self.assertFalse(local['SECURE_HSTS_SECONDS'])  # sozlanmagan (None) yoki 0


class SwaggerAccessTests(BookShopAPITestCase):
    """ /swagger/ productionda (DEBUG=False) faqat is_staff uchun """

    URLS = ['/swagger/', '/swagger/?format=openapi']

    def setUp(self):
        super().setUp()
        from config.urls import schema_view
        if AllowAny in schema_view.permission_classes:
            self.skipTest("Swagger DEBUG=True bilan yuklangan: ochiq (lokal rejim)")
        self.staff = User.objects.create_user(username='boss', password='password123', is_staff=True)

    def test_anonymous_denied(self):
        for url in self.URLS:
            self.assertIn(self.client.get(url).status_code, (401, 403, 404), url)

    def test_regular_user_denied(self):
        self.client.force_authenticate(user=self.user)
        for url in self.URLS:
            self.assertIn(self.client.get(url).status_code, (403, 404), url)

    def test_staff_allowed(self):
        self.client.force_authenticate(user=self.staff)
        for url in self.URLS:
            self.assertEqual(self.client.get(url).status_code, 200, url)


class QueryParamSafetyTests(BookShopAPITestCase):
    """ Noto'g'ri/juda katta id parametrlari 500 emas, 400 qaytarsin """

    def test_review_book_param(self):
        for bad in ('abc', BIG_ID, '-1', '0', '1.5', '%C2%B2', '9' * 5000):
            res = self.client.get(f'/api/review/?book={bad}')
            self.assertEqual(res.status_code, 400, bad[:30])
            self.assertIn('book', res.data)

    def test_review_book_param_valid_and_empty(self):
        Review.objects.create(user=self.user, book=self.book, rating=5, comment='ok')
        self.assertEqual(self.client.get(f'/api/review/?book={self.book.id}').data['count'], 1)
        self.assertEqual(self.client.get('/api/review/?book=').status_code, 200)
        self.assertEqual(self.client.get('/api/review/').status_code, 200)

    def test_review_mine_param(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get('/api/review/mine/?book=abc').status_code, 400)
        self.assertEqual(self.client.get(f'/api/review/mine/?book={BIG_ID}').status_code, 400)
        self.assertEqual(self.client.get(f'/api/review/mine/?book={self.book.id}').status_code, 200)

    def test_other_catalog_filters_do_not_500(self):
        for url in ('/api/book/?author=abc', f'/api/book/?author={BIG_ID}', f'/api/book/?category={BIG_ID}'):
            self.assertEqual(self.client.get(url).status_code, 400, url)

    def test_quote_and_checkout_reject_huge_book_id(self):
        body = {'items': [{'book_id': int(BIG_ID), 'quantity': 1}]}
        self.assertEqual(self.client.post('/api/cart/quote/', body, format='json').status_code, 400)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post('/api/cart/checkout/', body, format='json').status_code, 400)

    def test_panel_filters_do_not_500(self):
        staff = User.objects.create_user(username='boss', password='password123', is_staff=True)
        self.client.force_authenticate(user=staff)
        for url in (
            f'/api/panel/books/?category={BIG_ID}', '/api/panel/books/?category=%C2%B2',
            f'/api/panel/orders/?user={BIG_ID}', '/api/panel/orders/?q=%C2%B2', f'/api/panel/orders/?q=%23{BIG_ID}',
        ):
            self.assertEqual(self.client.get(url).status_code, 200, url)


class NullPriceTests(BookShopAPITestCase):
    """ Narxi NULL/0 faol kitob bepul sotilmasin """

    def setUp(self):
        super().setUp()
        self.free = Book.objects.create(
            name='Narxsiz', category=self.category, author=self.author, language='uzbek',
            price=None, about='-', publisher='-', pages=1, status='active',
        )
        self.staff = User.objects.create_user(username='boss', password='password123', is_staff=True)

    def items(self, *books):
        return {'items': [{'book_id': b.id, 'quantity': 1} for b in books], 'delivery_method': 'pickup'}

    def test_quote_puts_unpriced_into_missing(self):
        for price in (None, 0):
            Book.objects.filter(pk=self.free.pk).update(price=price)
            res = self.client.post('/api/cart/quote/', self.items(self.book, self.free), format='json')
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data['missing'], [self.free.id])
            self.assertEqual([i['id'] for i in res.data['items']], [self.book.id])
            self.assertEqual(res.data['subtotal'], 45000)

    def test_checkout_rejects_unpriced(self):
        self.client.force_authenticate(user=self.user)
        for price in (None, 0):
            Book.objects.filter(pk=self.free.pk).update(price=price)
            res = self.client.post('/api/cart/checkout/', self.items(self.book, self.free), format='json')
            self.assertEqual(res.status_code, 400, price)
            self.assertIn('error', res.data)
        self.assertEqual(Order.objects.exclude(status='pending').count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)

    def test_checkout_still_works_for_priced(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/checkout/', self.items(self.book), format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def test_panel_patch_rejects_null_and_zero_price(self):
        self.client.force_authenticate(user=self.staff)
        url = f'/api/panel/books/{self.book.id}/'
        for bad in (None, 0, ''):
            res = self.client.patch(url, {'price': bad}, format='json')
            self.assertEqual(res.status_code, 400, repr(bad))
            self.assertIn('price', res.data)
        self.book.refresh_from_db()
        self.assertEqual(self.book.price, 45000)

    def test_panel_patch_cost_price_null_still_allowed(self):
        self.client.force_authenticate(user=self.staff)
        Book.objects.filter(pk=self.book.pk).update(cost_price=30000)
        res = self.client.patch(f'/api/panel/books/{self.book.id}/', {'cost_price': None}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.book.refresh_from_db()
        self.assertIsNone(self.book.cost_price)
        self.assertEqual(self.client.patch(f'/api/panel/books/{self.book.id}/', {'price': 50000}, format='json').status_code, 200)

    def form_data(self, **extra):
        data = {
            'name': 'Forma', 'category': self.category.id, 'author': self.author.id, 'language': 'uzbek',
            'about': '-', 'publisher': '-', 'pages': 1, 'status': 'active',
        }
        data.update(extra)
        return data

    def test_admin_form_requires_price_for_active_book(self):
        form = BookAdminForm(data=self.form_data())
        self.assertFalse(form.is_valid())
        self.assertIn('price', form.errors)
        self.assertFalse(BookAdminForm(data=self.form_data(price=0)).is_valid())
        self.assertTrue(BookAdminForm(data=self.form_data(price=10000)).is_valid())
        # faol bo'lmagan kitobni narxsiz saqlash mumkin
        self.assertTrue(BookAdminForm(data=self.form_data(status='deactive')).is_valid())

    def test_admin_form_does_not_block_untouched_rows(self):
        # Narxsiz eski faol qator o'zgartirilmasa (jadvalda boshqa qator tahrirlanganda) xato bermaydi
        unchanged = {
            'name': self.free.name, 'category': self.category.id, 'author': self.author.id, 'language': 'uzbek',
            'about': '-', 'publisher': '-', 'pages': 1, 'status': 'active', 'price': '', 'cost_price': '', 'stock': '',
        }
        self.assertTrue(BookAdminForm(data=unchanged, instance=self.free).is_valid())
        # Tahrirlansa (masalan nomi o'zgarsa) narx talab qilinadi
        form = BookAdminForm(data={**unchanged, 'name': 'Yangi nom'}, instance=self.free)
        self.assertFalse(form.is_valid())
        self.assertIn('price', form.errors)

    def test_admin_changelist_uses_same_validation(self):
        model_admin = Book_Admin(Book, django_admin.site)
        request = RequestFactory().get('/admin/mainapp/book/')
        request.user = User.objects.create_superuser('root', 'root@example.com', 'rootpass123')
        self.assertTrue(issubclass(model_admin.get_changelist_form(request), BookAdminForm))


@override_settings(MEDIA_ROOT=REVIEW_MEDIA)
class ReviewInputTests(BookShopAPITestCase):
    """ Sharh rasmi (<= 2 MB, JPG/PNG/WEBP) va izoh uzunligi """

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(REVIEW_MEDIA, ignore_errors=True)

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def post(self, **extra):
        data = {'book': self.book.id, 'rating': 5, 'comment': 'Yaxshi kitob', **extra}
        return self.client.post('/api/review/', data, format='multipart')

    def test_big_photo_rejected(self):
        photo = noisy_png()
        self.assertGreater(photo.size, 2 * 1024 * 1024)
        res = self.post(photo=photo)
        self.assertEqual(res.status_code, 400)
        self.assertIn('photo', res.data)
        self.assertEqual(Review.objects.count(), 0)

    def test_wrong_extension_rejected(self):
        gif = io.BytesIO()
        Image.new('RGB', (5, 5)).save(gif, 'GIF')
        res = self.post(photo=SimpleUploadedFile('a.gif', gif.getvalue(), content_type='image/gif'))
        self.assertEqual(res.status_code, 400)
        self.assertIn('photo', res.data)

    def test_small_png_and_no_photo_accepted(self):
        res = self.post(photo=png_file())
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['photo_url'])
        Review.objects.all().delete()
        res = self.post()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data['photo_url'])

    def test_comment_max_length(self):
        res = self.post(comment='x' * 2001)
        self.assertEqual(res.status_code, 400)
        self.assertIn('comment', res.data)
        self.assertEqual(self.post(comment='x' * 2000).status_code, 201)


# --- Audit 2-bosqich (a): kirish, token va parol xavfsizligi ---
from unittest import mock

from django.db import IntegrityError, transaction
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .password_reset import check_code
from .serializer import Review_Serializer


def rates(**values):
    """ Throttle chastotalarini vaqtincha almashtiradi (class darajasidagi lug'at, override_settings unga ta'sir qilmaydi) """
    return mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, values)


class LoginRegisterThrottleTests(TestCase):
    """ /api/token/ va /api/register/: IP bo'yicha cheklov va noto'g'ri tana """

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user('thruser', 'thr@example.com', 'OldPassw0rd!x')

    def login(self, password='xato', **extra):
        return self.client.post('/api/token/', {'username': 'thruser', 'password': password}, format='json', **extra)

    def test_login_is_limited_per_ip(self):
        with rates(login='3/minute'):
            for _ in range(3):
                self.assertEqual(self.login().status_code, 401)
            blocked = self.login()
            self.assertEqual(blocked.status_code, 429)
            # To'g'ri parol ham cheklov tugamaguncha o'tmaydi
            self.assertEqual(self.login('OldPassw0rd!x').status_code, 429)
            # Boshqa IP ta'sirlanmaydi
            self.assertEqual(self.login('OldPassw0rd!x', REMOTE_ADDR='10.9.8.7').status_code, 200)

    def test_valid_bearer_token_does_not_bypass_login_throttle(self):
        other = User.objects.create_user('other', 'other@example.com', 'OtherPassw0rd!x')
        access = str(RefreshToken.for_user(other).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        with rates(login='3/minute'):
            for _ in range(3):
                self.assertEqual(self.login().status_code, 401)
            self.assertEqual(self.login().status_code, 429)

    def test_register_is_limited_per_ip(self):
        with rates(register='2/hour'):
            for number in range(2):
                res = self.client.post(
                    '/api/register/',
                    {'username': f'newbie{number}', 'email': f'newbie{number}@example.com', 'password': 'Str0ngPassw0rd!x'},
                    format='json',
                )
                self.assertEqual(res.status_code, 201, res.data)
            res = self.client.post(
                '/api/register/', {'username': 'newbie9', 'email': 'newbie9@example.com', 'password': 'Str0ngPassw0rd!x'}, format='json',
            )
            self.assertEqual(res.status_code, 429)
            self.assertFalse(User.objects.filter(username='newbie9').exists())

    def test_login_and_register_have_separate_counters(self):
        with rates(login='1/minute', register='5/hour'):
            self.assertEqual(self.login().status_code, 401)
            self.assertEqual(self.login().status_code, 429)
            res = self.client.post(
                '/api/register/', {'username': 'sep', 'email': 'sep@example.com', 'password': 'Str0ngPassw0rd!x'}, format='json',
            )
            self.assertEqual(res.status_code, 201)

    def test_login_with_non_object_body_is_400_not_500(self):
        for body in ('[1, 2]', '"matn"', '123', 'null', '[]'):
            res = self.client.post('/api/token/', body, content_type='application/json')
            self.assertEqual(res.status_code, 400, body)

    def test_login_with_odd_field_types_is_401_not_500(self):
        for payload in (
            {'username': 'thruser', 'password': 12345},
            {'username': 'thruser', 'password': ['a']},
            {'username': 'thruser', 'password': {'a': 1}},
            {'username': 'thruser', 'password': None},
            {'username': ['x'], 'password': 'xato'},
            {'password': 'xato'},
            {},
        ):
            self.assertEqual(self.client.post('/api/token/', payload, format='json').status_code, 401, payload)

    def test_login_with_null_byte_is_401_not_500(self):
        for name in ('thr\x00user', 'a@b.c\x00'):
            res = self.client.post('/api/token/', {'username': name, 'password': 'xato'}, format='json')
            self.assertEqual(res.status_code, 401, repr(name))

    def test_form_encoded_login_still_works(self):
        res = self.client.post('/api/token/', {'username': 'thruser', 'password': 'OldPassw0rd!x'})
        self.assertEqual(res.status_code, 200)

    def test_register_with_non_object_body_is_400(self):
        res = self.client.post('/api/register/', '[1]', content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_register_unique_race_gives_400(self):
        # Tekshiruv o'tib ketib, bazadagi unique buzilgan holat (ikki so'rov bir vaqtda)
        with mock.patch.object(User.objects, 'create_user', side_effect=IntegrityError('UNIQUE constraint failed')):
            res = self.client.post(
                '/api/register/', {'username': 'race', 'email': 'race@example.com', 'password': 'Str0ngPassw0rd!x'}, format='json',
            )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['username'], ['Bu username band.'])

    def load_rest_framework_settings(self, num_proxies):
        """ settings.py ni alohida jarayonda yuklab REST_FRAMEWORK sozlamasini qaytaradi """
        code = (
            "import json, sys; sys.path.insert(0, %r); import config.settings as s; "
            "print(json.dumps({'num_proxies': s.REST_FRAMEWORK.get('NUM_PROXIES', 'yoq'), "
            "'rates': s.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']}))"
        ) % str(settings.BASE_DIR)
        env = {k: v for k, v in os.environ.items() if k != 'NUM_PROXIES'}
        env.update(SECRET_KEY='test-secret', NUM_PROXIES=num_proxies)  # '' = bo'sh (.env dagi qiymatdan ustun)
        result = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, check=True, env=env)
        return json.loads(result.stdout.strip().splitlines()[-1])

    def test_num_proxies_is_optional_and_env_driven(self):
        self.assertEqual(self.load_rest_framework_settings('')['num_proxies'], 'yoq')  # bo'sh = o'rnatilmaydi
        self.assertEqual(self.load_rest_framework_settings('1')['num_proxies'], 1)
        self.assertEqual(self.load_rest_framework_settings('0')['num_proxies'], 0)


class TokenRevocationTests(TestCase):
    """ Parol o'zgarganda va logout'da JWT tokenlar bekor qilinadi """

    PASSWORD = 'OldPassw0rd!x'

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user('tokuser', 'tok@example.com', self.PASSWORD)

    def sign_in(self, client=None):
        res = (client or self.client).post('/api/token/', {'username': 'tokuser', 'password': self.PASSWORD}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def call(self, access, url='/api/profile/'):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        return client.get(url)

    def refresh(self, token):
        return APIClient().post('/api/token/refresh/', {'refresh': token}, format='json')

    def test_refresh_returns_only_access_and_it_works(self):
        tokens = self.sign_in()
        res = self.refresh(tokens['refresh'])
        self.assertEqual(res.status_code, 200)
        # ROTATE o'chiq: eski klient refresh'ni saqlamasa ham sessiya uzilmaydi
        self.assertNotIn('refresh', res.data)
        self.assertEqual(self.call(res.data['access']).status_code, 200)
        # Bir xil refresh bilan qayta yangilash mumkin
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 200)

    def test_tokens_carry_password_claim(self):
        tokens = self.sign_in()
        self.assertIn('hash_password', RefreshToken(tokens['refresh']).payload)

    def test_password_set_directly_revokes_old_tokens(self):
        tokens = self.sign_in()
        self.assertEqual(self.call(tokens['access']).status_code, 200)
        self.user.set_password('BrandNewPassw0rd!')
        self.user.save()
        self.assertEqual(self.call(tokens['access']).status_code, 401)
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 401)

    def test_password_reset_revokes_all_sessions(self):
        first, second = self.sign_in(), self.sign_in()  # ikki qurilma
        self.assertEqual(OutstandingToken.objects.filter(user=self.user).count(), 2)

        self.client.post('/api/password/forgot/', {'email': 'tok@example.com'}, format='json')
        code = re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)
        res = self.client.post(
            '/api/password/reset/', {'email': 'tok@example.com', 'code': code, 'password': 'BrandNewPassw0rd!'}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)

        for tokens in (first, second):
            self.assertEqual(self.call(tokens['access']).status_code, 401)
            self.assertEqual(self.refresh(tokens['refresh']).status_code, 401)
        self.assertEqual(BlacklistedToken.objects.filter(token__user=self.user).count(), 2)

        # Yangi parol bilan kirish va yangi tokenlar ishlaydi
        login = self.client.post('/api/token/', {'username': 'tokuser', 'password': 'BrandNewPassw0rd!'}, format='json')
        self.assertEqual(login.status_code, 200)
        self.assertEqual(self.call(login.data['access']).status_code, 200)
        self.assertEqual(self.refresh(login.data['refresh']).status_code, 200)

    def test_password_reset_keeps_other_users_tokens(self):
        other = User.objects.create_user('bystander', 'by@example.com', 'ByPassw0rd!xx')
        other_tokens = APIClient().post('/api/token/', {'username': 'bystander', 'password': 'ByPassw0rd!xx'}, format='json').data
        self.sign_in()
        self.client.post('/api/password/forgot/', {'email': 'tok@example.com'}, format='json')
        code = re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)
        self.client.post(
            '/api/password/reset/', {'email': 'tok@example.com', 'code': code, 'password': 'BrandNewPassw0rd!'}, format='json',
        )
        self.assertEqual(self.call(other_tokens['access']).status_code, 200)
        self.assertFalse(BlacklistedToken.objects.filter(token__user=other).exists())

    def test_token_without_password_claim_is_rejected(self):
        # CHECK_REVOKE_TOKEN yoqilishidan oldin berilgan tokenlar: access ham, refresh ham yaroqsiz (qayta kirish kerak)
        refresh = RefreshToken.for_user(self.user)
        del refresh['hash_password']
        self.assertEqual(self.call(str(refresh.access_token)).status_code, 401)
        self.assertEqual(self.refresh(str(refresh)).status_code, 401)

    def test_refresh_for_deleted_or_inactive_user_is_401_not_500(self):
        tokens = self.sign_in()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 401)
        self.user.delete()
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 401)

    def test_refresh_with_garbage_is_401(self):
        self.assertEqual(self.refresh('yaroqsiz').status_code, 401)
        self.assertEqual(self.refresh(self.sign_in()['access']).status_code, 401)  # access refresh o'rnida yaroqsiz

    def test_logout_blacklists_refresh(self):
        tokens = self.sign_in()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        res = client.post('/api/logout/', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(res.status_code, 205)
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 401)
        self.assertEqual(BlacklistedToken.objects.filter(token__user=self.user).count(), 1)
        # Takroran chiqish xavfsiz xato beradi (500 emas)
        self.assertEqual(client.post('/api/logout/', {'refresh': tokens['refresh']}, format='json').status_code, 400)

    def test_logout_only_ends_that_session(self):
        first, second = self.sign_in(), self.sign_in()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {first['access']}")
        self.assertEqual(client.post('/api/logout/', {'refresh': first['refresh']}, format='json').status_code, 205)
        self.assertEqual(self.refresh(first['refresh']).status_code, 401)
        self.assertEqual(self.refresh(second['refresh']).status_code, 200)

    def test_logout_requires_login(self):
        tokens = self.sign_in()
        self.assertEqual(APIClient().post('/api/logout/', {'refresh': tokens['refresh']}, format='json').status_code, 401)
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 200)  # bekor qilinmadi

    def test_logout_bad_input_is_400(self):
        tokens = self.sign_in()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        for payload in ({}, {'refresh': ''}, {'refresh': 'yaroqsiz'}, {'refresh': 123}, {'refresh': ['x']},
                        {'refresh': tokens['access']}):  # access token refresh o'rnida
            self.assertEqual(client.post('/api/logout/', payload, format='json').status_code, 400, payload)
        for body in ('[1]', '"matn"', 'null'):
            self.assertEqual(client.post('/api/logout/', body, content_type='application/json').status_code, 400, body)
        self.assertEqual(self.refresh(tokens['refresh']).status_code, 200)

    def test_cannot_logout_someone_elses_token(self):
        victim = User.objects.create_user('victim', 'v@example.com', 'VictimPassw0rd!x')
        victim_tokens = APIClient().post('/api/token/', {'username': 'victim', 'password': 'VictimPassw0rd!x'}, format='json').data
        mine = self.sign_in()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {mine['access']}")
        res = client.post('/api/logout/', {'refresh': victim_tokens['refresh']}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.refresh(victim_tokens['refresh']).status_code, 200)
        self.assertFalse(BlacklistedToken.objects.filter(token__user=victim).exists())

    def test_register_tokens_are_revocable(self):
        # Ro'yxatdan o'tishda berilgan tokenlar ham parol belgisini olib yuradi va OutstandingToken'ga yoziladi
        res = APIClient().post(
            '/api/register/', {'username': 'fresh1', 'email': 'fresh1@example.com', 'password': 'Str0ngPassw0rd!x'}, format='json',
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn('hash_password', RefreshToken(res.data['refresh']).payload)
        self.assertEqual(OutstandingToken.objects.filter(user__username='fresh1').count(), 1)


class PasswordResetHardeningTests(TestCase):
    """ Urinishlar atomik hisoblanadi; hisob bo'yicha soatlik yuborish limiti """

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user('hardened', 'hard@example.com', 'OldPassw0rd!x')

    def request_code(self, email='hard@example.com'):
        return self.client.post('/api/password/forgot/', {'email': email}, format='json')

    def sent_code(self):
        return re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)

    def age_codes(self, seconds):
        PasswordResetCode.objects.update(created_on=timezone.now() - timedelta(seconds=seconds))

    def test_stale_copy_cannot_exceed_attempt_limit(self):
        # Parallel so'rov holati: bu so'rov yozuvni attempts=0 deb o'qigan, lekin bazada limit allaqachon tugagan
        self.request_code()
        code = self.sent_code()
        stale = self.user.reset_codes.first()
        self.assertEqual(stale.attempts, 0)
        PasswordResetCode.objects.filter(pk=stale.pk).update(attempts=settings.PASSWORD_RESET_MAX_ATTEMPTS)
        fake_manager = mock.Mock()
        fake_manager.first.return_value = stale
        with mock.patch.object(User, 'reset_codes', new_callable=mock.PropertyMock, return_value=fake_manager):
            self.assertIsNone(check_code(self.user, code))  # to'g'ri kod ham o'tmaydi
        stale.refresh_from_db()
        self.assertEqual(stale.attempts, settings.PASSWORD_RESET_MAX_ATTEMPTS)  # limitdan oshib ketmadi

    def test_wrong_guess_counts_once_and_correct_code_does_not_burn_attempts(self):
        self.request_code()
        code = self.sent_code()
        wrong = '000000' if code != '000000' else '111111'
        self.assertIsNone(check_code(self.user, wrong))
        record = self.user.reset_codes.first()
        self.assertEqual(record.attempts, 1)
        self.assertIsNotNone(check_code(self.user, code))
        record.refresh_from_db()
        self.assertEqual(record.attempts, 1)  # to'g'ri kod urinish hisobiga kirmaydi

    def test_last_allowed_attempt_still_accepts_correct_code(self):
        self.request_code()
        code = self.sent_code()
        PasswordResetCode.objects.update(attempts=settings.PASSWORD_RESET_MAX_ATTEMPTS - 1)
        self.assertIsNotNone(check_code(self.user, code))

    def test_hourly_send_limit_per_account_with_identical_response(self):
        limit = settings.PASSWORD_RESET_MAX_PER_HOUR
        messages = set()
        for _ in range(limit + 1):
            res = self.request_code()
            self.assertEqual(res.status_code, 200)
            messages.add((res.data['message'], res.data['resend_after']))
            self.age_codes(120)  # 60 soniyalik qayta yuborish oralig'idan o'tadi, lekin soat ichida
        self.assertEqual(len(messages), 1)  # limitga yetgan hisobga ham javob bir xil (enumeratsiya yo'q)
        self.assertEqual(len(mail.outbox), limit)
        # Begona email bilan javob ham aynan shunday
        unknown = self.request_code('nobody@example.com')
        self.assertEqual((unknown.data['message'], unknown.data['resend_after']), next(iter(messages)))
        # Soat o'tgach yana yuboriladi
        self.age_codes(2 * 60 * 60)
        self.request_code()
        self.assertEqual(len(mail.outbox), limit + 1)
        self.assertEqual(self.user.reset_codes.count(), 1)  # soatdan eskilari tozalandi

    def test_limit_is_per_account_not_global(self):
        other = User.objects.create_user('second', 'second@example.com', 'OldPassw0rd!x')
        with rates(password='100/hour'):
            for _ in range(settings.PASSWORD_RESET_MAX_PER_HOUR + 1):
                self.request_code()
                self.age_codes(120)
            sent = len(mail.outbox)
            self.request_code('second@example.com')
        self.assertEqual(len(mail.outbox), sent + 1)
        self.assertEqual(other.reset_codes.count(), 1)


class UniqueRaceTests(BookShopAPITestCase):
    """ Bazadagi unique buzilishi (poyga) 500 emas, 400 qaytaradi """

    def test_review_unique_race_gives_400(self):
        self.client.force_authenticate(user=self.user)
        payload = {'book': self.book.id, 'rating': 5, 'comment': 'Birinchi'}
        self.assertEqual(self.client.post('/api/review/', payload, format='json').status_code, 201)
        # Ikkinchi so'rov validate() tekshiruvidan o'tib ketgan deb faraz qilamiz
        with mock.patch.object(Review_Serializer, 'validate', lambda self, attrs: attrs):
            res = self.client.post('/api/review/', {**payload, 'comment': 'Ikkinchi'}, format='json')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data['non_field_errors'], ['Siz bu kitobga allaqachon sharh yozgansiz.'])
        self.assertEqual(Review.objects.filter(user=self.user, book=self.book).count(), 1)
        # Tranzaksiya buzilmagan: keyingi so'rovlar ishlaydi
        self.assertEqual(self.client.get(f'/api/review/mine/?book={self.book.id}').status_code, 200)

    def test_review_normal_duplicate_message_unchanged(self):
        self.client.force_authenticate(user=self.user)
        payload = {'book': self.book.id, 'rating': 4, 'comment': 'Yaxshi'}
        self.client.post('/api/review/', payload, format='json')
        res = self.client.post('/api/review/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['non_field_errors'], ['Siz bu kitobga allaqachon sharh yozgansiz.'])

    def test_panel_promo_unique_race_gives_400(self):
        from .panel_promos import PanelPromoSerializer
        staff = User.objects.create_user(username='promoboss', password='password123', is_staff=True)
        self.client.force_authenticate(user=staff)
        self.assertEqual(self.client.post('/api/panel/promos/', {'code': 'RACE10', 'discount_percent': 10}, format='json').status_code, 201)
        # validate_code ikkinchi so'rovni o'tkazib yuborgan deb faraz qilamiz
        with mock.patch.object(PanelPromoSerializer, 'validate_code', lambda self, value: value.strip().upper()):
            res = self.client.post('/api/panel/promos/', {'code': 'RACE10', 'discount_percent': 20}, format='json')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn('code', res.data)
        self.assertEqual(PromoCode.objects.filter(code='RACE10').count(), 1)


class Stage2bReliabilityTests(BookShopAPITestCase):
    """ Savat/buyurtma/ombor ishonchliligi (2-bosqich b) """

    def setUp(self):
        super().setUp()
        self.staff = User.objects.create_user(username='boss2b', password='password123', is_staff=True)
        self.other = User.objects.create_user(username='other2b', password='password123')

    def place(self, qty=1, user=None, key=None, book=None, **extra):
        self.client.force_authenticate(user=user or self.user)
        headers = {'HTTP_IDEMPOTENCY_KEY': key} if key is not None else {}
        return self.client.post(
            '/api/cart/checkout/',
            {'items': [{'book_id': (book or self.book).id, 'quantity': qty}], **PICKUP, **extra},
            format='json', **headers,
        )

    # 1) bitta savat
    def test_second_pending_cart_violates_constraint(self):
        Order.objects.create(user=self.user, status='pending')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Order.objects.create(user=self.user, status='pending')
        Order.objects.create(user=self.other, status='pending')  # boshqa foydalanuvchi mumkin
        Order.objects.create(user=self.user, status='confirmed')  # buyurtmalar cheklanmagan
        Order.objects.create(user=self.user, status='confirmed')

    def test_get_cart_idempotent_and_survives_race(self):
        from .views import get_cart
        first = get_cart(self.user)
        self.assertEqual(get_cart(self.user).pk, first.pk)
        # get_or_create poyga tufayli IntegrityError berganda mavjud savat qaytadi
        with mock.patch.object(Order.objects, 'get_or_create', side_effect=IntegrityError):
            self.assertEqual(get_cart(self.user).pk, first.pk)

    # 2) idempotentlik
    def test_same_idempotency_key_creates_one_order(self):
        self.book.stock = 10
        self.book.save()
        first = self.place(3, key='abcd-1234-efgh')
        second = self.place(3, key='abcd-1234-efgh')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Order.objects.exclude(status='pending').count(), 1)
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 7)

    def test_idempotency_key_is_per_user_and_optional(self):
        a = self.place(1, key='shared-key-123')
        b = self.place(1, user=self.other, key='shared-key-123')
        self.assertEqual((a.status_code, b.status_code), (201, 201))
        self.assertNotEqual(a.data['id'], b.data['id'])
        # kalitsiz so'rovlar avvalgidek alohida buyurtma beradi
        self.assertEqual(self.place(1).status_code, 201)
        self.assertEqual(self.place(1).status_code, 201)
        self.assertEqual(Order.objects.filter(user=self.user).exclude(status='pending').count(), 3)

    def test_bad_idempotency_key_is_400(self):
        for key in ('short', 'x' * 81, 'bad key with space'):
            self.assertEqual(self.place(1, key=key).status_code, 400, key)
        self.assertEqual(Order.objects.exclude(status='pending').count(), 0)

    def test_idempotency_race_returns_existing_and_restores_stock(self):
        self.book.stock = 10
        self.book.save()
        self.assertEqual(self.place(2, key='race-key-0001').status_code, 201)
        # Ikkinchi so'rov oldindan tekshiruvdan o'tib ketgan deb faraz qilamiz
        real = Order.objects.filter
        calls = {'n': 0}

        def fake_filter(*args, **kwargs):
            if kwargs.get('idempotency_key') and calls['n'] == 0:
                calls['n'] += 1
                return Order.objects.none()
            return real(*args, **kwargs)

        with mock.patch.object(Order.objects, 'filter', side_effect=fake_filter):
            res = self.place(2, key='race-key-0001')
        self.assertEqual(res.status_code, 200, res.data)
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 8)

    # 3) holat o'tishlari
    def patch_status(self, order, status):
        self.client.force_authenticate(user=self.staff)
        return self.client.patch(f'/api/panel/orders/{order.id}/', {'status': status}, format='json')

    def test_panel_transitions(self):
        allowed = {
            'confirmed': ['processing', 'cancelled'], 'processing': ['shipped', 'cancelled'],
            'shipped': ['delivered', 'cancelled'], 'delivered': [], 'cancelled': ['confirmed'],
        }
        for old, new_list in allowed.items():
            for new in ('confirmed', 'processing', 'shipped', 'delivered', 'cancelled'):
                if new == old:
                    continue
                order = Order.objects.create(user=self.user, status=old)
                res = self.patch_status(order, new)
                self.assertEqual(res.status_code, 200 if new in new_list else 400, (old, new, res.data))
                order.refresh_from_db()
                self.assertEqual(order.status, new if new in new_list else old)

    def test_panel_illegal_transition_message(self):
        order = Order.objects.create(user=self.user, status='delivered')
        res = self.patch_status(order, 'cancelled')
        self.assertEqual(res.status_code, 400)
        self.assertIn("Bu holatga o'tib bo'lmaydi", str(res.data))

    def test_repeated_cancel_does_not_restock_twice(self):
        self.book.stock = 10
        self.book.save()
        order = Order.objects.get(pk=self.place(4).data['id'])
        self.assertEqual(self.patch_status(order, 'cancelled').status_code, 200)
        self.assertEqual(self.patch_status(order, 'cancelled').status_code, 200)  # o'zgarmagan holat: no-op
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock, 10)

    # 4) ombor
    def test_reserve_shortage_and_unlimited(self):
        from . import stock as stock_module
        limited = Book.objects.create(name='Cheklangan', category=self.category, author=self.author, pages=100, price=1000, stock=2, status='active')
        unlimited = Book.objects.create(name='Cheksiz', category=self.category, author=self.author, pages=100, price=1000, stock=None, status='active')
        self.assertEqual(stock_module.reserve({limited.id: 3, unlimited.id: 50}), [
            {'book_id': limited.id, 'name': 'Cheklangan', 'available': 2}])
        limited.refresh_from_db()
        self.assertEqual(limited.stock, 2)
        self.assertEqual(stock_module.reserve({limited.id: 2, unlimited.id: 50}), [])
        limited.refresh_from_db()
        unlimited.refresh_from_db()
        self.assertEqual((limited.stock, unlimited.stock), (0, None))

    def test_reserve_rolls_back_partial_take(self):
        from . import stock as stock_module
        ok = Book.objects.create(name='Yetarli', category=self.category, author=self.author, pages=100, price=1000, stock=5, status='active')
        low = Book.objects.create(name='Kam', category=self.category, author=self.author, pages=100, price=1000, stock=1, status='active')
        self.assertEqual(self.place(2, book=low).status_code, 409)
        # ok oldin, low keyin: ok ayirilib bo'lgach low yetishmasa ok ham qaytadi
        self.assertEqual(stock_module.reserve({ok.id: 2, low.id: 9})[0]['book_id'], low.id)
        ok.refresh_from_db()
        self.assertEqual(ok.stock, 5)

    # 5) nofaol kitoblar
    def test_inactive_book_hidden_from_public(self):
        hidden = Book.objects.create(name='Yashirin', category=self.category, author=self.author, pages=100, price=1000, status='deactive')
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f'/api/book/{hidden.id}/').status_code, 404)
        ids = [b['id'] for b in self.client.get('/api/book/').data['results']]
        self.assertNotIn(hidden.id, ids)
        self.assertIn(self.book.id, ids)
        self.assertEqual(self.client.get('/api/book/?search=Yashirin').data['count'], 0)
        self.assertEqual(self.client.get('/api/book/?status=deactive').data['count'], 0)
        self.assertEqual(self.client.get('/api/book/?status=active').data['count'], 1)
        # savat va checkout nofaol kitobni rad etadi
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post('/api/cart/add/', {'book_id': hidden.id, 'quantity': 1}, format='json').status_code, 404)
        self.assertEqual(self.place(1, book=hidden).status_code, 404)
        self.client.force_authenticate(user=None)
        q = self.client.post('/api/cart/quote/', {'items': [{'book_id': hidden.id, 'quantity': 1}], **PICKUP}, format='json')
        self.assertEqual(q.data['missing'], [hidden.id])

    def test_staff_still_sees_inactive_book(self):
        hidden = Book.objects.create(name='Yashirin', category=self.category, author=self.author, pages=100, price=1000, status='deactive')
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get(f'/api/book/{hidden.id}/').status_code, 200)
        self.assertEqual(self.client.get('/api/book/?status=deactive').data['count'], 1)
        self.assertEqual(self.client.get('/api/panel/books/?status=deactive').status_code, 200)

    # 6) buyurtmalar tarixi
    def test_order_history_excludes_cart(self):
        self.client.force_authenticate(user=self.user)
        self.client.post('/api/cart/add/', {'book_id': self.book.id, 'quantity': 1}, format='json')
        self.assertEqual(self.client.get('/api/order/').data['count'], 0)
        self.assertEqual(self.client.get('/api/cart/').status_code, 200)
        self.place(1)
        data = self.client.get('/api/order/').data
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['status'], 'confirmed')

    # 7) PROTECT
    def test_book_in_order_cannot_be_deleted(self):
        from django.db.models import ProtectedError
        self.place(1)
        with self.assertRaises(ProtectedError):
            self.book.delete()
        fresh = Book.objects.create(name='Buyurtmasiz', category=self.category, author=self.author, pages=100, price=1000, status='active')
        fresh.delete()

    # 8) delivery_method majburiy
    def test_delivery_method_required(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 1}]}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['delivery_method'][0], 'Qabul qilish usulini tanlang')
        self.assertEqual(Order.objects.exclude(status='pending').count(), 0)

    # 9, 10) throttle
    def test_panel_login_throttle_ignores_bearer(self):
        from .panel import PanelLoginThrottle
        from .views import IPRateThrottle
        self.assertTrue(issubclass(PanelLoginThrottle, IPRateThrottle))
        self.assertEqual(PanelLoginThrottle.scope, 'panel_login')
        self.client.force_authenticate(user=self.user)  # yaroqli kirgan foydalanuvchi ham sanaladi
        with rates(panel_login='2/minute'):
            codes = [self.client.post('/api/panel/login/', {'username': 'x', 'password': 'y'}, format='json').status_code for _ in range(3)]
        self.assertEqual(codes, [401, 401, 429])

    def test_quote_throttle(self):
        body = {'items': [{'book_id': self.book.id, 'quantity': 1}], **PICKUP}
        with rates(quote='2/minute'):
            codes = [self.client.post('/api/cart/quote/', body, format='json').status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        self.assertEqual(SimpleRateThrottle.THROTTLE_RATES['quote'], '60/minute')

    def test_panel_promo_min_length_only_for_new_codes(self):
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.post('/api/panel/promos/', {'code': 'ABC12', 'discount_percent': 5}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/panel/promos/', {'code': 'ABC123', 'discount_percent': 5}, format='json').status_code, 201)
        short = PromoCode.objects.create(code='OLD8', discount_percent=10)  # eski qisqa kod
        res = self.client.patch(f'/api/panel/promos/{short.id}/', {'discount_percent': 15}, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    # 11) N+1
    def test_book_list_query_count_and_rating_values(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        for i in range(35):
            Book.objects.create(name=f'Kitob {i}', category=self.category, author=self.author, pages=100, price=1000, status='active')
        for i, rating in enumerate((5, 4)):
            u = User.objects.create_user(username=f'rev{i}', password='password123')
            Review.objects.create(user=u, book=self.book, rating=rating, comment='ok')
        self.client.force_authenticate(user=None)
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get('/api/book/?page_size=100')
        self.assertEqual(res.status_code, 200)
        self.assertLessEqual(len(ctx), 10, [q['sql'][:80] for q in ctx])
        by_id = {b['id']: b for b in res.data['results']}
        self.assertEqual((by_id[self.book.id]['avg_rating'], by_id[self.book.id]['reviews_count']), (4.5, 2))
        other = next(b for i, b in by_id.items() if i != self.book.id)
        self.assertEqual((other['avg_rating'], other['reviews_count']), (0, 0))
        detail = self.client.get(f'/api/book/{self.book.id}/').data
        self.assertEqual((detail['avg_rating'], detail['reviews_count']), (4.5, 2))


class Stage3BackendTests(BookShopAPITestCase):
    """ 3-bosqich (backend): qidiruv, profil emaili, bulk foiz, savat """

    def setUp(self):
        super().setUp()
        self.hoshimov = Author.objects.create(full_name="O'tkir Hoshimov", status='active')
        Book.objects.create(name='Dunyoning ishlari', category=self.category, author=self.hoshimov,
                            pages=100, price=1000, status='active')

    def names(self, q):
        res = self.client.get('/api/book/', {'search': q})
        self.assertEqual(res.status_code, 200)
        return sorted(b['name'] for b in res.data['results'])

    # 1) qidiruv
    def test_search_apostrophe_variants_and_spaces(self):
        expected = ['Dunyoning ishlari']
        for q in ("O'tkir", '\u2018tkir'.replace('\u2018', 'O\u2018'), 'O\u2019tkir', 'O\u02bbtkir', 'O\u02bctkir',
                  'O`tkir', 'otkir', 'OTKIR', '  otkir  ', "o'tkir  hoshimov", 'hoshimov otkir'):
            self.assertEqual(self.names(q), expected, q)

    def test_search_stored_variant_matches_plain_query(self):
        Book.objects.create(name='O\u02bbtkan', category=self.category, author=self.author, pages=1, price=1, status='active')
        self.assertIn('O\u02bbtkan', self.names("O'tkan"))
        self.assertIn('O\u02bbtkan', self.names('otkan'))

    def test_search_trimmed_and_other_fields(self):
        self.assertEqual(self.names('  qodiriy  '), ["O'tkan kunlar"])
        self.assertEqual(self.names('Badiiy'), sorted(["O'tkan kunlar", 'Dunyoning ishlari']))
        self.assertEqual(self.names('yo\'q-kitob'), [])
        self.assertEqual(self.client.get('/api/book/?search=%20%20').data['count'], 2)  # bo'sh qidiruv = hammasi

    def test_author_search_variants(self):
        for q in ('O\u2019tkir', 'otkir', '  hoshimov '):
            res = self.client.get('/api/author/', {'search': q})
            self.assertEqual([a['full_name'] for a in res.data['results']], ["O'tkir Hoshimov"], q)

    # 2) profil emaili
    def test_email_change_requires_current_password(self):
        self.client.force_authenticate(user=self.user)
        for body in ({'email': 'new@example.com'}, {'email': 'new@example.com', 'current_password': 'xato'},
                     {'email': 'new@example.com', 'current_password': ''}):
            res = self.client.patch('/api/profile/', body, format='json')
            self.assertEqual(res.status_code, 400, body)
            self.assertEqual(res.data['current_password'], ["Joriy parolni to'g'ri kiriting."])
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'test@example.com')

    def test_email_change_with_password_and_unchanged_cases(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.patch('/api/profile/', {'email': 'new@example.com', 'current_password': 'password123'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['email'], 'new@example.com')
        self.assertNotIn('current_password', res.data)
        # o'sha email yoki boshqa maydon: parol shart emas
        self.assertEqual(self.client.patch('/api/profile/', {'email': 'new@example.com'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch('/api/profile/', {'phone': '1'}, format='json').status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('password123'))  # current_password saqlanmadi/almashmadi

    # 4) bulk foiz yaxlitlash
    def test_bulk_percent_rounds_half_up(self):
        staff = User.objects.create_user(username='boss3', password='password123', is_staff=True)
        self.client.force_authenticate(user=staff)
        b35 = Book.objects.create(name='35', category=self.category, author=self.author, pages=1, price=35, status='active')
        b1 = Book.objects.create(name='uno', category=self.category, author=self.author, pages=1, price=1, status='active')
        res = self.client.post('/api/panel/books/bulk-update/', {'ids': [b35.id], 'price_mode': 'percent', 'percent': 10}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        b35.refresh_from_db()
        self.assertEqual(b35.price, 39)  # 38.5 -> 39 (round() 38 berardi)
        res = self.client.post('/api/panel/books/bulk-update/', {'ids': [b1.id], 'price_mode': 'percent', 'percent': -90}, format='json')
        self.assertEqual(res.status_code, 400)  # 0.1 -> 0: 1 so'mdan past bo'lib qoladi, rad etiladi
        b1.refresh_from_db()
        self.assertEqual(b1.price, 1)

    # 5) savat
    def test_add_to_cart_rejects_unsellable(self):
        self.client.force_authenticate(user=self.user)
        free = Book.objects.create(name='Narxsiz', category=self.category, author=self.author, pages=1, status='active')
        zero = Book.objects.create(name='Nol', category=self.category, author=self.author, pages=1, price=0, status='active')
        for book in (free, zero):
            res = self.client.post('/api/cart/add/', {'book_id': book.id, 'quantity': 1}, format='json')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.data['error'], 'Kitob sotuvda emas')
        self.assertEqual(OrderItem.objects.count(), 0)
