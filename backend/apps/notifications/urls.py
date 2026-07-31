from rest_framework.routers import DefaultRouter
from apps.notifications.viewsets.notification_viewset import NotificationViewSet

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
