from django.contrib import admin
from .models import Category, Author, Book, Order, OrderEvent, OrderItem, Profile, PromoCode, Review


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    can_delete = False
    readonly_fields = ('status', 'created_on')

    def has_add_permission(self, request, obj=None):
        return False


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ('book', 'quantity', 'price')


@admin.register(Category)
class Category_Admin(admin.ModelAdmin):
    list_display = ('id', 'name', 'status', 'created_on')
    list_filter = ('status',)
    search_fields = ('name',)
    ordering = ('-created_on',)


@admin.register(Author)
class Author_Admin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'status', 'created_on')
    list_filter = ('status',)
    search_fields = ('full_name',)
    ordering = ('-created_on',)


@admin.register(Book)
class Book_Admin(admin.ModelAdmin):
    list_display = ('id', 'name', 'author', 'category', 'price', 'cost_price', 'stock', 'language', 'status', 'created_on')
    list_editable = ('price', 'cost_price', 'stock', 'status')
    list_filter = ('status', 'category', 'language')
    search_fields = ('name', 'author__full_name')
    ordering = ('-created_on',)


@admin.register(Order)
class Order_Admin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'delivery_method', 'total', 'created_on')
    list_editable = ('status',)
    list_filter = ('status', 'delivery_method', 'created_on')
    search_fields = ('user__username', 'recipient_name', 'recipient_phone')
    inlines = [OrderItemInline, OrderEventInline]
    ordering = ('-created_on',)
    actions = ['mark_confirmed', 'mark_processing', 'mark_shipped', 'mark_delivered', 'mark_cancelled']

    @admin.display(description="Jami (so'm)")
    def total(self, obj):
        items = sum(i.unit_price * i.quantity for i in obj.items.all())
        return max(items - obj.discount, 0) + obj.delivery_fee

    def _set_status(self, queryset, status):
        # update() signal'larni ishga tushirmaydi, shuning uchun har birini saqlaymiz (tarix yoziladi)
        for order in queryset.exclude(status='pending'):
            order.status = status
            order.save()

    @admin.action(description='Tasdiqlangan qilish')
    def mark_confirmed(self, request, queryset):
        self._set_status(queryset, 'confirmed')

    @admin.action(description="Yig'ilmoqda qilish")
    def mark_processing(self, request, queryset):
        self._set_status(queryset, 'processing')

    @admin.action(description="Yo'lda qilish")
    def mark_shipped(self, request, queryset):
        self._set_status(queryset, 'shipped')

    @admin.action(description='Yetkazildi qilish')
    def mark_delivered(self, request, queryset):
        self._set_status(queryset, 'delivered')

    @admin.action(description='Bekor qilish')
    def mark_cancelled(self, request, queryset):
        self._set_status(queryset, 'cancelled')


@admin.register(PromoCode)
class PromoCode_Admin(admin.ModelAdmin):
    list_display = ('code', 'discount_percent', 'is_active', 'created_on')
    list_editable = ('is_active',)
    list_filter = ('is_active',)
    search_fields = ('code',)
    actions = ['activate', 'deactivate']

    @admin.action(description='Tanlanganlarni yoqish')
    def activate(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="Tanlanganlarni o'chirish (faolsiz qilish)")
    def deactivate(self, request, queryset):
        queryset.update(is_active=False)


@admin.register(OrderItem)
class OrderItem_Admin(admin.ModelAdmin):
    list_display = ('id', 'order', 'book', 'quantity')
    search_fields = ('order__user__username', 'book__name')


@admin.register(Review)
class Review_Admin(admin.ModelAdmin):
    list_display = ('id', 'user', 'book', 'rating', 'created_on')
    list_filter = ('rating', 'created_on')
    search_fields = ('user__username', 'comment', 'book__name')
    ordering = ('-created_on',)


@admin.register(Profile)
class Profile_Admin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'phone', 'address')
    search_fields = ('user__username', 'full_name', 'phone')
