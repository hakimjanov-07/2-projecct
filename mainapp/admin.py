from django.contrib import admin
from .models import Category, Author, Book, Order, OrderItem, Profile, PromoCode, Review


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


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
    list_display = ('id', 'name', 'author', 'category', 'price', 'language', 'status', 'created_on')
    list_editable = ('price', 'status')
    list_filter = ('status', 'category', 'language')
    search_fields = ('name', 'author__full_name')
    ordering = ('-created_on',)


@admin.register(Order)
class Order_Admin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'total', 'created_on')
    list_editable = ('status',)
    list_filter = ('status', 'created_on')
    search_fields = ('user__username',)
    inlines = [OrderItemInline]
    ordering = ('-created_on',)
    actions = ['mark_confirmed', 'mark_cancelled']

    @admin.display(description="Jami (so'm)")
    def total(self, obj):
        items = sum((i.book.price or 0) * i.quantity for i in obj.items.all())
        return max(items - obj.discount, 0) + obj.delivery_fee

    @admin.action(description='Tanlanganlarni tasdiqlash')
    def mark_confirmed(self, request, queryset):
        queryset.update(status='confirmed')

    @admin.action(description='Tanlanganlarni bekor qilish')
    def mark_cancelled(self, request, queryset):
        queryset.update(status='cancelled')


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
