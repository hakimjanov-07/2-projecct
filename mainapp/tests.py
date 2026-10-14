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


class BookShopAPITestCase(TestCase):
    def setUp(self):
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
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 3}]}, format='json')
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
            {'items': [{'book_id': self.book.id, 'quantity': quantity}], 'promo_code': promo},
            format='json',
        )

    def test_quote_is_public_and_charges_delivery(self):
        res = self.quote(2)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['subtotal'], 90000)
        self.assertEqual(res.data['discount'], 0)
        self.assertEqual(res.data['delivery_fee'], 20000)
        self.assertEqual(res.data['total'], 110000)

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
            {'items': [{'book_id': self.book.id, 'quantity': 2}], 'promo_code': 'bookuz10'},
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
            {'items': [{'book_id': self.book.id, 'quantity': 1}], 'promo_code': 'NOPE'},
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
        self.request_code()
        self.assertEqual(len(mail.outbox), 1)
        PasswordResetCode.objects.update(created_on=timezone.now() - timedelta(seconds=120))
        self.request_code()
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(PasswordResetCode.objects.filter(user=self.user).count(), 1)

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
        res = self.client.patch(self.url, {'email': 'TAKEN@example.com'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)

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
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 2}]}, format='json')
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
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 1}]}, format='json')
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
        return self.client.post('/api/cart/checkout/', {'items': items}, format='json')

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
        bad = self.client.patch(f'/api/panel/books/{self.book.id}/', {'stock': -1}, format='json')
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
        self.assertEqual(row[7:], ['2', '90000', '9000', '20000', '101000'])
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
        self.assertEqual((row[10], row[11], row[12]), ('2', '90000', '1'))  # bekor qilingani hisobga kirmaydi
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
        self.client.post(self.URL, {'code': 'yoz20', 'discount_percent': 20}, format='json')
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/cart/quote/', {'items': [{'book_id': self.book.id, 'quantity': 1}], 'promo_code': 'YOZ20'}, format='json')
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
        res = self.client.post('/api/cart/checkout/', {'items': [{'book_id': self.book.id, 'quantity': 1}]}, format='json')
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
