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
