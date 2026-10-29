#!/bin/sh
# One image, two roles. PROCESS_TYPE=web (default) or worker.
set -e
case "${PROCESS_TYPE:-web}" in
  worker)
    # Beat runs inside the worker: one small process instead of two services.
    exec celery -A config worker -B -l info --concurrency "${CELERY_CONCURRENCY:-2}"
    ;;
  *)
    python manage.py migrate --noinput
    # Demo travelers and locals (idempotent). Needs DEMO_PASSWORD when DJANGO_DEBUG is off.
    if [ "${SEED_DEMO:-0}" = "1" ]; then
      python manage.py seed_demo
    fi
    exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
    ;;
esac
