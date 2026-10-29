"""Tour-ops was renamed Tour-op: move demo accounts from @tour-ops.local to @tour-op.local.

Verification targets move too, otherwise the renamed emails would lose their verified badge.
"""
from django.db import migrations

OLD, NEW = "@tour-ops.local", "@tour-op.local"


def forwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Verification = apps.get_model("accounts", "Verification")
    for user in User.objects.filter(email__endswith=OLD):
        new_email = user.email[: -len(OLD)] + NEW
        if User.objects.filter(email=new_email).exists():
            continue
        Verification.objects.filter(user=user, target=user.email).update(target=new_email)
        user.email = new_email
        user.save(update_fields=["email"])


def backwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Verification = apps.get_model("accounts", "Verification")
    for user in User.objects.filter(email__endswith=NEW):
        old_email = user.email[: -len(NEW)] + OLD
        Verification.objects.filter(user=user, target=user.email).update(target=old_email)
        user.email = old_email
        user.save(update_fields=["email"])


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [migrations.RunPython(forwards, backwards)]
