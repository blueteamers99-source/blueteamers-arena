from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

def health(request):
    return JsonResponse({
        "status": "success",
        "message": "Blueteamers Arena Backend is Running 🚀"
    })

urlpatterns = [
    path("", health),

    path("admin/", admin.site.urls),

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(), name="redoc"),

    path("metrics/", include("django_prometheus.urls")),

    path("api/", include("apps.api.urls")),
]
