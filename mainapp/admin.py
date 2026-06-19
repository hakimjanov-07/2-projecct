from django.contrib import admin
from .models import Category,Author, Book
# Register your models here.

@admin.register(Category)
class Category_Admin(admin.ModelAdmin):
    list_display = ('name','status', 'created_on')
    list_filter = ('name','status')

@admin.register(Author)
class Author_Admin(admin.ModelAdmin):
    list_display = ('full_name','photo')
    list_filter = ('status',)
    search_fields = ('full_name', )

@admin.register(Book)
class Book_Admin(admin.ModelAdmin):
    list_display = ('name','status', 'author','price')
    list_filter = ('name','status')
    search_fields = ('name','author')

