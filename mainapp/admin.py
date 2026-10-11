from django.contrib import admin
from .models import Category, Author, Book, Order, OrderItem, PromoCode, Review


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
    list_filter = ('status', 'category', 'language')
    search_fields = ('name', 'author__full_name')
    ordering = ('-created_on',)


@admin.register(Order)
class Order_Admin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'created_on')
    list_filter = ('status', 'created_on')
    search_fields = ('user__username',)
    inlines = [OrderItemInline]
    ordering = ('-created_on',)


@admin.register(PromoCode)
class PromoCode_Admin(admin.ModelAdmin):
    list_display = ('code', 'discount_percent', 'is_active', 'created_on')
    list_filter = ('is_active',)
    search_fields = ('code',)


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
