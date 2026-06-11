from django.shortcuts import render
from .serializer import Category_Serializer, Author_Serializer, Book_Serializer
from .models import Category, Author, Book
from rest_framework import viewsets, pagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter



"Pagination class "
class our_pagination(pagination.PageNumberPagination):
    page_size = 1
    page_size_query_param ='page_size'
    max_page_size = 10000



""" Throttling """
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
class Our_throttle(AnonRateThrottle):
    scope = 'example'



class Category_ViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = Category_Serializer

    """ Pagination """
    pagination_class = our_pagination

    """ Throttling """
    throttle_classes = [Our_throttle,]

    """ Search va Filter"""
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
    ]

    filterset_fields = ['name', 'status']
    search_fields = ['name']




class Author_ViewSet(viewsets.ModelViewSet):
    queryset = Author.objects.all()
    serializer_class = Author_Serializer

    """ Pagination """
    pagination_class = our_pagination

    """ Throttling """
    throttle_classes = [Our_throttle,]

    """ Search va Filter"""
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
    ]

    filterset_fields = ['full_name', 'status']
    search_fields = ['full_name']




class Book_ViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = Book_Serializer

    """ Pagination """
    pagination_class = our_pagination

    """ Throttling """
    throttle_classes = [Our_throttle,]

    """ Search va Filter"""
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
    ]

    filterset_fields = ['name', 'author','category']
    search_fields = ['name']
