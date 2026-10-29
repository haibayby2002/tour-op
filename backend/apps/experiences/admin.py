from django.contrib import admin

from .models import LocalService, ServiceCategory, ServicePhoto


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "name_vi")
    prepopulated_fields = {"slug": ("name",)}


class ServicePhotoInline(admin.TabularInline):
    model = ServicePhoto
    extra = 0


@admin.register(LocalService)
class LocalServiceAdmin(admin.ModelAdmin):
    list_display = ("title", "local", "category", "city", "price", "currency", "status", "created_at")
    list_filter = ("status", "category", "city")
    search_fields = ("title", "local__email", "local__full_name")
    inlines = [ServicePhotoInline]
