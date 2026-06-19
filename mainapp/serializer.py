
from .models import Category, Book, Author
from rest_framework import serializers


# Serializers define the API representation.
class Category_Serializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "status", "created_on"]

class Author_Serializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ["id", "full_name", 'photo', 'about',"status", "created_on"]

class Book_Serializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ["id", "name", 'category','author','language','price','about','publisher','pages','audio_file','pdf_file','photo',"status", "created_on"]
