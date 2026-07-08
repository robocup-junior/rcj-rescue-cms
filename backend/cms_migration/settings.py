import os
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'development-only-rcj-rescue-cms-migration')
DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'rest_framework',
    'compat_auth',
    'competitions',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'cms_migration.urls'
# W002 (leading slash in a sub-pattern) is intentional here: several apps
# mount their urls.py against a no-trailing-slash prefix (e.g. 'api/rounds',
# not 'api/rounds/') to match Express's exact no-trailing-slash routes
# without triggering an APPEND_SLASH redirect that would break POST/DELETE.
SILENCED_SYSTEM_CHECKS = ['urls.W002']
TEMPLATES = []
WSGI_APPLICATION = 'cms_migration.wsgi.application'
ASGI_APPLICATION = 'cms_migration.asgi.application'

DEFAULT_DATABASE_URL = 'postgresql://rcj_rescue_cms_user:rcj_rescue_cms_password@localhost:5432/rcj_rescue_cms'
DATABASE_URL = os.environ.get('DATABASE_URL', DEFAULT_DATABASE_URL)


def postgres_database_config(url):
    parsed = urlparse(url)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/'),
        'USER': parsed.username or '',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or 'localhost',
        'PORT': str(parsed.port or 5432),
    }


DATABASES = {
    'default': postgres_database_config(DATABASE_URL),
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'

SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_NAME = 'connect.sid'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

REST_FRAMEWORK = {
    'UNAUTHENTICATED_USER': None,
}
